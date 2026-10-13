import { readFile, mkdir, access, accessSync, constants } from "node:fs";
import { readFile as rf, mkdir as mk, access as ac } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { LocalBashExecutor, assertServiceableBashConfig } from "@deepseek-ai/dsh-bash-local";

/**
 * ZhaoHua dual-track bash executor (v18.1 lite6 · fully local proot edition).
 *
 * Track 1 (default): phone-local bash — parent's semantics, untouched.
 * Track 2: fully local proot sandbox — Alpine aarch64 rootfs via the bundled
 *   Android proot. No network dependency, no VPS, self-contained on-device.
 *
 * Routing rules (in order):
 *   1. Escape — commands mentioning zhaohua-sandbox.state / zhaohua-setup
 *      always run locally (toggle + installer control).
 *   2. Toggle on — $DSH_HOME/zhaohua-sandbox.state contains `on`: everything
 *      runs in the sandbox.
 *   3. Route table — command hits a toolchain pattern: sandbox.
 *   4. Otherwise local.
 *
 * Sandbox layout:
 *   payload/bin/proot          NDK PIE proot executable (5.1.107.92)
 *   payload/bin/proot-loader   static ELF loader (PROOT_LOADER target)
 *   payload/dshhome/zh-rootfs.tar.gz  Alpine minirootfs + /usr/bin/zh-setup
 *   extracted rootfs           $ZH_SANDBOX_DIR/rootfs (default
 *                              /sdcard/DeepSeekHarness/zh-sandbox — survives
 *                              reinstall; fallback $DSH_HOME/zh-sandbox)
 *
 * Invocation (validated on-device against Milk Code's identical build):
 *   PROOT_LOADER=<loader> PROOT_TMP_DIR=<sandbox>/tmp \
 *     proot -r <rootfs> -0 -w /root --link2symlink --kill-on-exit \
 *       -b /dev -b /proc -b /sys -b /sdcard \
 *       /usr/bin/env -i TERM=xterm HOME=/root PATH=... bash -c <command>
 *
 * Fallback: proot missing / rootfs broken -> local with a stderr notice.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
// lib -> dsh-bash-router -> @zhaohua -> node_modules -> @deepseek-ai -> node_modules -> dsh -> node_modules -> lib -> dshroot = 9 ups to payload/
const PAYLOAD = path.resolve(HERE, "../".repeat(9));

const DEFAULT_ROUTES = [
	"git", "gcc", "g++", "cc", "c++", "clang", "clang++", "make", "cmake",
	"ninja", "meson", "cargo", "rustc", "go", "javac", "mvn", "gradle",
	"kotlinc", "apt", "apt-get", "dpkg", "apk ", "pip", "pip3", "qemu-",
	"nasm", "objdump", "readelf", "gdb", "strip", "pkg-config", "openssl",
	"valgrind", "strace", "xxd"
];

const ESCAPE_RE = /zhaohua-sandbox\.(state|json)|zhaohua-setup\b/;

function shquote(s) {
	return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function escPattern(p) {
	return String(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRouteResolvers(patterns) {
	return patterns.map((p) => {
		const tail = p.endsWith(" ") ? "" : "(?=[\\s;|&]|$)";
		return new RegExp("(?:^|[\\s;|&(`\u0022\u0027])" + escPattern(p) + tail);
	});
}

function note(message) {
	return "echo " + shquote("[zhaohua-sandbox] " + message) + " >&2; ";
}

async function exists(p) {
	try { await ac(p); return true; } catch { return false; }
}

function existsSync(p) {
	try { accessSync(p, constants.F_OK); return true; } catch { return false; }
}

var ZhaohuaBashRouter = class ZhaohuaBashRouter extends LocalBashExecutor {
	static inject = ["subprocess"];

	get sandboxMode() {
		return "workspace-write";
	}

	static Config = z.object({
		cwd: z.string().volatile(),
		timeoutMs: z.number().default(12e4).volatile(),
		maxTimeoutMs: z.number().default(6e5).volatile(),
		maxOutputBytes: z.number().default(64e3).volatile(),
		maxSpillBytes: z.number().default(67108864).volatile(),
		graceMs: z.number().default(3000).volatile(),
		routePatterns: z.array(z.string()).default(DEFAULT_ROUTES).volatile(),
		sandboxCwd: z.string().default("/root").volatile(),
		stateFile: z.string().default("").volatile(),
		stateCacheMs: z.number().default(5000).volatile()
	});

	constructor(ctx, config) {
		super(ctx, config);
		this._resolvers = buildRouteResolvers(config.routePatterns.get());
		this._stateCache = null;
		this._readyPromise = null;
	}

	homePath(basename) {
		const home = process.env.DSH_HOME || process.cwd();
		return path.join(home, basename);
	}

	externalDir() {
		if (process.env.ZH_SANDBOX_DIR) return process.env.ZH_SANDBOX_DIR;
		// /sdcard is FUSE (noexec, no hard links) and a stale half-extracted
		// rootfs there would shadow the good one — app-private only.
		return this.homePath("zh-sandbox");
	}

	async sandboxOn() {
		const now = Date.now();
		const ttl = this.config.stateCacheMs.get();
		if (this._stateCache && now - this._stateCache.at < ttl) return this._stateCache.val;
		let val = false;
		try {
			const file = this.config.stateFile.get() || this.homePath("zhaohua-sandbox.state");
			val = (await rf(file, "utf8")).trim().toLowerCase() === "on";
		} catch {
			val = false;
		}
		this._stateCache = { at: now, val };
		return val;
	}

	matchesRoutes(command) {
		for (const re of this._resolvers) {
			if (re.test(command)) return true;
		}
		return false;
	}

	/** Ensure the sandbox is extracted and return resolved paths. */
	async ensureReady() {
		if (this._readyPromise) return this._readyPromise;
		this._readyPromise = (async () => {
			const sbx = this.externalDir();
			const rootfsDir = path.join(sbx, "rootfs");
			const tmpDir = path.join(sbx, "tmp");
			const payloadProot = path.join(PAYLOAD, "bin", "proot");
			const payloadLoader = path.join(PAYLOAD, "bin", "proot-loader");
			const marker = path.join(rootfsDir, "usr", "bin", "zh-setup");
			if (!(await exists(marker))) {
				const tar = this.homePath("zh-rootfs.tar.gz");
				if (!(await exists(tar))) throw new Error("zh-rootfs.tar.gz 不存在");
				if (!(await exists(sbx))) await mk(sbx, { recursive: true });
				if (!(await exists(rootfsDir))) await mk(rootfsDir, { recursive: true });
				if (!(await exists(tmpDir))) await mk(tmpDir, { recursive: true });
				await new Promise((resolve, reject) => {
					// GNU tar hardlink-optimizes the busybox applet links; devices
					// that reject link(2) (f2fs inline_data / FUSE) fail every one.
					// The bundled extractor copies instead of linking.
					const extractor = path.join(PAYLOAD, "bin", "zh-extract.py");
					execFile("python3", [extractor, tar, rootfsDir], { maxBuffer: 8 << 20 }, (err, so, se) =>
						err ? reject(new Error("rootfs 解包失败: " + (se || err.message))) : resolve());
				});
			}
			if (!(await exists(tmpDir))) await mk(tmpDir, { recursive: true });
			if (!(await exists(payloadProot))) throw new Error("proot 不存在");
			if (!(await exists(payloadLoader))) throw new Error("proot-loader 不存在");
			return { sbx, rootfsDir, tmpDir, prootBin: payloadProot, loaderBin: payloadLoader };
		})();
		return this._readyPromise;
	}

	async route(spec) {
		const command = spec.command;
		if (ESCAPE_RE.test(command)) return null;
		const want = (await this.sandboxOn()) || this.matchesRoutes(command);
		if (!want) return null;

		let ready;
		try {
			ready = await this.ensureReady();
		} catch (e) {
			return { command: note("沙箱初始化失败（" + e.message + "），已回落本地执行") + command, env: null };
		}

		const timeoutSec = Math.max(10, Math.floor(Number(spec.timeoutMs || 120000) / 1000));
		const bashCmd =
			"echo '[zhaohua-sandbox] proot alpine-arm64 /root' >&2\n" + command;

		const argv = [
			"-r", ready.rootfsDir,
			"-0",
			"-w", "/root",
			"--link2symlink",
			"--kill-on-exit",
			"-b", "/dev",
			"-b", "/proc",
			"-b", "/sys",
			"-b", "/sdcard",
			"-b", ready.tmpDir + ":/tmp",
			"/usr/bin/env", "-i",
			"TERM=xterm",
			"HOME=/root",
			"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
			"PROOT_TMP_DIR=" + ready.tmpDir,
			"TMPDIR=/tmp",
			"bash", "-c", bashCmd
		];

		const local =
			// `env` must be a real program: toybox timeout does not accept
			// VAR=value prefixes. bionic does not search the executable's
			// dir, so proot's DT_NEEDED libs need LD_LIBRARY_PATH.
			"env LD_LIBRARY_PATH=" + shquote(path.dirname(ready.prootBin)) + " " +
			"PROOT_LOADER=" + shquote(ready.loaderBin) + " " +
			"PROOT_TMP_DIR=" + shquote(ready.tmpDir) + " " +
			shquote(ready.prootBin) + " " +
			argv.map(shquote).join(" ");

		return { command: "timeout " + timeoutSec + " " + local, env: null };
	}

	async execute(spec) {
		assertServiceableBashConfig(this.config);
		const routed = await this.route(spec);
		if (!routed) return super.execute(spec);
		const next = { ...spec, command: routed.command };
		if (routed.env) next.env = { ...(spec.env || {}), ...routed.env };
		return super.execute(next);
	}
};

export { ZhaohuaBashRouter, ZhaohuaBashRouter as default };
