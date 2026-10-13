// src/index.ts
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import path from "node:path";

// src/zh-setup-b64.ts
var ZH_SETUP_B64 = "IyEvYmluL3NoCiMgWmhhb0h1YSBzYW5kYm94IHRvb2xib3ggaW5zdGFsbGVyIOKAlCBydW5zIElOU0lERSB0aGUgQWxwaW5lIGFhcmNoNjQgcm9vdGZzLgojCiMgVXNhZ2UgKGluc2lkZSB0aGUgc2FuZGJveCk6CiMgICB6aC1zZXR1cCAgICAgICAgICAgICAgICAgICMgZGVmYXVsdDogYmFzZStidWlsZCtweXRob24rbm9kZStiaW51dGlscytuZXQrcmUKIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIyAgICAgICAgICArZWZmaWNpZW5jeStweXJlIChjYXBzdG9uZS9wd250b29scykKIyAgIHpoLXNldHVwIC0td2l0aC1qYXZhICAgICAgIyBhbHNvIGluc3RhbGwgYSBKUkUKIyAgIHpoLXNldHVwIC0tb25seT1nb3J1c3QgICAgIyBvbmx5IHRoZSBuYW1lZCBzZWN0aW9ucyAoZ29ydXN0IGlzIG9wdC1pbikKIyAgIHpoLXNldHVwIC0tZHJ5LXJ1biAgICAgICAgIyBwcmludCB0aGUgcGxhbiwgaW5zdGFsbCBub3RoaW5nCiMgICB6aC1zZXR1cCAtLWxpc3QgICAgICAgICAgICMgc2hvdyBzZWN0aW9ucyBhbmQgdGhlaXIgcHJvYmUgY29tbWFuZHMKIwojIElkZW1wb3RlbnQ6IGEgc2VjdGlvbiB3aG9zZSBwcm9iZSBjb21tYW5kIGFscmVhZHkgZXhpc3RzIGlzIHNraXBwZWQuCnNldCAtdQoKUkVQT1JUPS9yb290L3poLXRvb2xib3gtcmVwb3J0LnR4dApMT0c9L3Jvb3Qvemgtc2V0dXAubG9nCkRSWT0wCldJVEhfSkFWQT0wCk9OTFk9IiIKTElTVD0wCgpmb3IgYSBpbiAiJEAiOyBkbwogIGNhc2UgIiRhIiBpbgogICAgLS1kcnktcnVuKSAgIERSWT0xIDs7CiAgICAtLXdpdGgtamF2YSkgV0lUSF9KQVZBPTEgOzsKICAgIC0tb25seT0qKSAgICBPTkxZPSIke2EjLS1vbmx5PX0iIDs7CiAgICAtLWxpc3QpICAgICAgTElTVD0xIDs7CiAgICAqKSBlY2hvICJ6aC1zZXR1cDogdW5rbm93biBhcmc6ICRhIiA+JjI7IGV4aXQgNjQgOzsKICBlc2FjCmRvbmUKCmlmICEgY29tbWFuZCAtdiBhcGsgPi9kZXYvbnVsbCAyPiYxOyB0aGVuCiAgZWNobyAiemgtc2V0dXA6IGFwayBub3QgZm91bmQg4oCUIG5vdCBhbiBBbHBpbmUgcm9vdGZzPyIgPiYyCiAgZXhpdCAxCmZpCgpoYXZlKCkgeyBjb21tYW5kIC12ICIkMSIgPi9kZXYvbnVsbCAyPiYxOyB9CgojIG5hbWV8cHJvYmV8cGFja2FnZXMKIyBEZWZhdWx0IHNlY3Rpb25zOiBiYXNlIGJ1aWxkIHB5dGhvbiBub2RlIGJpbnV0aWxzIG5ldCByZSBlZmZpY2llbmN5IHB5cmUKIyBPcHQtaW4gc2VjdGlvbnM6ICBqYXZhIGdvcnVzdApTRUNUSU9OUz0nCmJhc2V8Z2l0fGJhc2ggZ2l0IGN1cmwgd2dldCB1bnppcCB6aXAgdGFyIGd6aXAgeHogZmlsZSBqcSBwcm9jcHMKYnVpbGR8Z2NjfGJ1aWxkLWJhc2UgZ2NjIGcrKyBtYWtlIGNtYWtlIG5pbmphIHBrZ2NvbmYKcHl0aG9ufHB5dGhvbjN8cHl0aG9uMyBweTMtcGlwIHB5My12aXJ0dWFsZW52Cm5vZGV8bm9kZXxub2RlanMgbnBtCmJpbnV0aWxzfG5hc218YmludXRpbHMgbmFzbQpuZXR8dGNwZHVtcHxuZXRjYXQtb3BlbmJzZCB0Y3BkdW1wIGJpbmQtdG9vbHMKcmV8cmFkYXJlMnxyYWRhcmUyIGdkYiBsdHJhY2UgcGF0Y2hlbGYKZWZmaWNpZW5jeXxodG9wfGh0b3AgdmltIG5hbm8gbGVzcyB0cmVlIGRpZmZ1dGlscyBwYXRjaCByc3luYyBvcGVuc3NoLWNsaWVudCBzcWxpdGUgb3BlbnNzbC1kZXYKcHlyZXxwaXAzfHB5dGhvbjMtZGV2ICYmIHBpcCBpbnN0YWxsIC0tcXVpZXQgY2Fwc3RvbmUgcHdudG9vbHMKZ29ydXN0fGdvfGdvIHJ1c3QgY2FyZ28KamF2YXxqYXZhfG9wZW5qZGsyMS1qcmUtaGVhZGxlc3MKJwoKd2FudF9zZWN0aW9uKCkgewogIFsgLXogIiRPTkxZIiBdIHx8IGNhc2UgIiwkT05MWSwiIGluICoiLCQxLCIqKSByZXR1cm4gMCA7OyAqKSByZXR1cm4gMSA7OyBlc2FjCn0KCmlmIFsgIiRMSVNUIiA9ICIxIiBdOyB0aGVuCiAgcHJpbnRmICclc1xuJyAiJFNFQ1RJT05TIiB8IHdoaWxlIElGUz0nfCcgcmVhZCAtciBuYW1lIHByb2JlIHBrZ3M7IGRvCiAgICBbIC1uICIkbmFtZSIgXSB8fCBjb250aW51ZQogICAgaWYgaGF2ZSAiJHByb2JlIjsgdGhlbiBzdD0iaW5zdGFsbGVkIjsgZWxzZSBzdD0ibWlzc2luZyI7IGZpCiAgICBwcmludGYgJyUtOXMgcHJvYmU9JS0xMHMgJS0xMHMgJXNcbicgIiRuYW1lIiAiJHByb2JlIiAiJHN0IiAiJHBrZ3MiCiAgZG9uZQogIGV4aXQgMApmaQoKbWtkaXIgLXAgL3Jvb3Qvd29yayAvcm9vdC9zaGFyZSAyPi9kZXYvbnVsbAo6ID4gIiRMT0ciIDI+L2Rldi9udWxsIHx8IHRydWUKCiMgRE5TIGZvciB0aGUgc2FuZGJveCAodGhlIHJvb3RmcyBoYXMgbm8gL2V0Yy9yZXNvbHYuY29uZiBvZiBpdHMgb3duKQppZiBbICEgLXMgL2V0Yy9yZXNvbHYuY29uZiBdOyB0aGVuCiAgcHJpbnRmICduYW1lc2VydmVyIDEuMS4xLjFcbm5hbWVzZXJ2ZXIgOC44LjguOFxuJyA+IC9ldGMvcmVzb2x2LmNvbmYgMj4vZGV2L251bGwgfHwgdHJ1ZQpmaQoKZWNobyAiPT0gWmhhb0h1YSBzYW5kYm94IHRvb2xib3ggPT0iCmVjaG8gImFscGluZTogJChjYXQgL2V0Yy9hbHBpbmUtcmVsZWFzZSAyPi9kZXYvbnVsbCkgIGFyY2g6ICQodW5hbWUgLW0pIgplY2hvICJyZXBvczogICQodHIgJ1xuJyAnICcgPCAvZXRjL2Fway9yZXBvc2l0b3JpZXMgMj4vZGV2L251bGwpIgoKIyBiYXNoIGlzIG5vdCBpbiB0aGUgQWxwaW5lIG1pbmlyb290ZnMsIGJ1dCB0aGUgc2hlbGwgcm91dGVyIHJ1bnMKIyBgYmFzaCAtYyA8Y29tbWFuZD5gIGluc2lkZSB0aGUgc2FuZGJveCDigJQgd2l0aG91dCBpdCBldmVyeSByb3V0ZWQgY29tbWFuZCBmYWlscy4KaWYgISBoYXZlIGJhc2ggJiYgWyAiJERSWSIgIT0gIjEiIF07IHRoZW4KICBlY2hvICJbaW5zdGFsbF0gYmFzaCAocmVxdWlyZWQgYnkgdGhlIHNoZWxsIHJvdXRlcikiCiAgYXBrIGFkZCAtLW5vLWNhY2hlIGJhc2ggPj4iJExPRyIgMj4mMSAmJiBlY2hvICJbb2tdICAgICBiYXNoIiB8fCB7IGVjaG8gIltGQUlMXSAgIGJhc2giOyB0YWlsIC01ICIkTE9HIjsgfQpmaQoKIyBBbHBpbmUgbWFya3MgdGhlIHN5c3RlbSBweXRob24gYXMgZXh0ZXJuYWxseSBtYW5hZ2VkIChQRVAgNjY4KSwgc28gYSBwbGFpbgojIGBwaXAgaW5zdGFsbCB4YCBhYm9ydHMgd2l0aCBleHRlcm5hbGx5LW1hbmFnZWQtZW52aXJvbm1lbnQuIFRoaXMgc2FuZGJveCBleGlzdHMKIyBmb3IgYWQtaG9jIHRvb2xpbmcg4oCUIGxldCBpdCB3cml0ZSB0byB0aGUgc3lzdGVtIHByZWZpeC4KaWYgWyAhIC1mIC9ldGMvcGlwLmNvbmYgXTsgdGhlbgogIHByaW50ZiAnW2dsb2JhbF1cbmJyZWFrLXN5c3RlbS1wYWNrYWdlcyA9IHRydWVcbicgPiAvZXRjL3BpcC5jb25mIDI+L2Rldi9udWxsIFwKICAgICYmIGVjaG8gIltva10gICAgIC9ldGMvcGlwLmNvbmYgKFBFUCA2NjggYnlwYXNzIGZvciB0aGUgc2FuZGJveCkiCmZpCgpET05FPSIiClNLSVA9IiIKRkFJTD0iIgpQSVBfRkFJTEVEPSIiCgpwcmludGYgJyVzXG4nICIkU0VDVElPTlMiIHwgd2hpbGUgSUZTPSd8JyByZWFkIC1yIG5hbWUgcHJvYmUgcGtnczsgZG8KICBbIC1uICIkbmFtZSIgXSB8fCBjb250aW51ZQogIGlmICEgd2FudF9zZWN0aW9uICIkbmFtZSI7IHRoZW4KICAgIGVjaG8gIltza2lwXSAgICRuYW1lIChub3Qgc2VsZWN0ZWQpIgogICAgY29udGludWUKICBmaQogIGlmIFsgIiRuYW1lIiA9ICJqYXZhIiBdICYmIFsgIiRXSVRIX0pBVkEiICE9ICIxIiBdOyB0aGVuCiAgICBlY2hvICJbc2tpcF0gICBqYXZhIChvcHQtaW46IHpoLXNldHVwIC0td2l0aC1qYXZhKSIKICAgIGNvbnRpbnVlCiAgZmkKICBpZiBbICIkbmFtZSIgPSAiZ29ydXN0IiBdICYmIFsgLXogIiRPTkxZIiBdOyB0aGVuCiAgICBlY2hvICJbc2tpcF0gICBnb3J1c3QgKG9wdC1pbjogemgtc2V0dXAgLS1vbmx5PWdvcnVzdCkiCiAgICBjb250aW51ZQogIGZpCiAgIyBTZWN0aW9uIGFscmVhZHkgZnVsbHkgc2F0aXNmaWVkPwogIGNhc2UgIiRwcm9iZSIgaW4KICAgICoiJiYiKikKICAgICAgIyBjb21wb3VuZCBwcm9iZTogZXZlcnkgY29tbWFuZCBtdXN0IGV4aXN0CiAgICAgIG9rPTEKICAgICAgZm9yIGMgaW4gJChwcmludGYgJyVzJyAiJHByb2JlIiB8IHNlZCAncy8gKiYmICovXG4vZycpOyBkbwogICAgICAgIGhhdmUgIiRjIiB8fCBvaz0wCiAgICAgIGRvbmUKICAgICAgOzsKICAgICopIG9rPTE7IGhhdmUgIiRwcm9iZSIgfHwgb2s9MCA7OwogIGVzYWMKICBpZiBbICIkb2siID0gIjEiIF0gJiYgWyAiJG5hbWUiICE9ICJweXJlIiBdOyB0aGVuCiAgICBlY2hvICJbaGF2ZV0gICAkbmFtZSIKICAgIGNvbnRpbnVlCiAgZmkKICBpZiBbICIkRFJZIiA9ICIxIiBdOyB0aGVuCiAgICBlY2hvICJbZHJ5XSAgICAkbmFtZTogJHBrZ3MiCiAgICBjb250aW51ZQogIGZpCiAgIyBwaXAtYmFzZWQgc2VjdGlvbiAocHlyZSkgaW5zdGFsbHMgdmlhIHBpcCwgbm90IGFwawogIGlmIFsgIiRuYW1lIiA9ICJweXJlIiBdOyB0aGVuCiAgICBlY2hvICJbaW5zdGFsbF0gJG5hbWUgKHBpcCkiCiAgICBpZiAhIGhhdmUgcGlwMzsgdGhlbgogICAgICBhcGsgYWRkIC0tbm8tY2FjaGUgcHl0aG9uMyBweTMtcGlwID4+IiRMT0ciIDI+JjEgfHwgeyBlY2hvICJbRkFJTF0gICAkbmFtZSAocGlwMyBtaXNzaW5nKSI7IGNvbnRpbnVlOyB9CiAgICBmaQogICAgaWYgcGlwIGluc3RhbGwgLS1xdWlldCBjYXBzdG9uZSBwd250b29scyA+PiIkTE9HIiAyPiYxOyB0aGVuCiAgICAgIGVjaG8gIltva10gICAgICRuYW1lIChjYXBzdG9uZSwgcHdudG9vbHMpIgogICAgZWxzZQogICAgICBlY2hvICJbRkFJTF0gICAkbmFtZSAocGlwOyBzZWUgJExPRykiCiAgICBmaQogICAgY29udGludWUKICBmaQogIGVjaG8gIltpbnN0YWxsXSAkbmFtZSIKICAjIHNoZWxsY2hlY2sgZGlzYWJsZT1TQzIwODYKICBpZiBhcGsgYWRkIC0tbm8tY2FjaGUgJHBrZ3MgPj4iJExPRyIgMj4mMTsgdGhlbgogICAgZWNobyAiW29rXSAgICAgJG5hbWUiCiAgZWxzZQogICAgZWNobyAiW0ZBSUxdICAgJG5hbWUgKHNlZSAkTE9HKSIKICBmaQpkb25lCgojIFN1bW1hcnkKZWNobwplY2hvICI9PSBzdW1tYXJ5ID09Igpmb3IgYyBpbiBnaXQgZ2NjIGcrKyBtYWtlIGNtYWtlIG5pbmphIHB5dGhvbjMgcGlwMyBub2RlIG5wbSBvYmpkdW1wIG5hc20gZ2RiIHJhZGFyZTIgbHRyYWNlIHBhdGNoZWxmIGh0b3AgcnN5bmMgc3NoIHNxbGl0ZTMgZ28gY2FyZ28gamF2YTsgZG8KICBpZiBoYXZlICIkYyI7IHRoZW4KICAgIHY9JCgiJGMiIC0tdmVyc2lvbiAyPi9kZXYvbnVsbCB8IGhlYWQgLTEpCiAgICBwcmludGYgJ1tva10gICUtMTBzICVzXG4nICIkYyIgIiR7djotaW5zdGFsbGVkfSIKICBmaQpkb25lCmlmIGhhdmUgcHl0aG9uMyAmJiBweXRob24zIC1jICdpbXBvcnQgY2Fwc3RvbmUnIDI+L2Rldi9udWxsOyB0aGVuCiAgcHJpbnRmICdbb2tdICAlLTEwcyAlc1xuJyAiY2Fwc3RvbmUiICIkKHB5dGhvbjMgLWMgJ2ltcG9ydCBjYXBzdG9uZTsgcHJpbnQoY2Fwc3RvbmUuX192ZXJzaW9uX18pJyAyPi9kZXYvbnVsbCkiCmZpCmlmIHB5dGhvbjMgLWMgJ2ltcG9ydCBwd24nIDI+L2Rldi9udWxsOyB0aGVuCiAgcHJpbnRmICdbb2tdICAlLTEwcyAlc1xuJyAicHdudG9vbHMiICJpbnN0YWxsZWQiCmZpCmVjaG8gIj09IGVuZCA9PSIK";

// src/index.ts
var name = "zhbox";
var inject = ["webServer", "connection"];
var statePath = () => path.join(process.env.DSH_HOME ?? process.cwd(), "zhaohua-sandbox.state");
var sandboxDir = () => path.join(process.env.DSH_HOME ?? process.cwd(), "zh-sandbox");
var payloadDir = () => path.resolve(process.env.DSH_HOME ?? process.cwd(), "..");
var payloadBin = () => path.join(payloadDir(), "bin");
var filesDir = () => process.env.DSH_HOME ?? payloadDir();
function run(file, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, [...args], { timeout: timeoutMs, maxBuffer: 4 << 20, encoding: "utf8" }, (error, stdout, stderr) => {
      const code = error?.code;
      resolve({ code: typeof code === "number" ? code : error ? 1 : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}
async function status() {
  let toggle = "off";
  try {
    toggle = (await readFile(statePath(), "utf8")).trim().toLowerCase() === "on" ? "on" : "off";
  } catch {
  }
  let rootfs = false;
  try {
    await readFile(path.join(sandboxDir(), "rootfs/usr/bin/zh-setup"));
    rootfs = true;
  } catch {
  }
  const probe = await run(path.join(payloadBin(), "proot"), ["--version"], 8e3);
  return {
    toggle,
    rootfsReady: rootfs,
    prootVersion: probe.code === 0 ? probe.stdout.split("\n")[0] : `unavailable: ${(probe.stderr.split("\n")[0] ?? "").trim()}`
  };
}
async function testSandbox() {
  const zhbox = await ensureZhbox();
  const r = await run("sh", [zhbox, "/bin/bash", "-c", "id -u; cat /etc/alpine-release 2>/dev/null; gcc --version 2>/dev/null | head -1; python3 -V 2>/dev/null; node -v 2>/dev/null"], 6e4);
  return { code: r.code, output: `${r.stdout}${r.stderr}`.trim() };
}
async function ensureSetupScript() {
  const target = path.join(filesDir(), "zh-setup-runtime.sh");
  await writeFile(target, Buffer.from(ZH_SETUP_B64, "base64"));
  await chmod(target, 493).catch(() => {
  });
  return target;
}
async function ensureZhbox() {
  const sbx = sandboxDir();
  const zhbox = path.join(sbx, "zhbox.sh");
  const files = filesDir();
  const script = `#!/system/bin/sh
# ZhaoHua sandbox runner (generated by the zhbox settings plugin).
PAYLOAD=${JSON.stringify(payloadDir())}
S=${JSON.stringify(sbx)}
FILES=${JSON.stringify(files)}
export LD_LIBRARY_PATH="$PAYLOAD/bin"
export PROOT_LOADER="$PAYLOAD/bin/proot-loader"
export PROOT_TMP_DIR="$S/tmp"
exec timeout 1800 "$PAYLOAD/bin/proot"   -r "$S/rootfs" -0 -w /root --link2symlink --kill-on-exit   -b /dev -b /proc -b /sys -b /sdcard   -b "$FILES":"$FILES"   -b "$S/tmp":"/tmp"   /usr/bin/env -i TERM=xterm HOME=/root   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin   PROOT_TMP_DIR="$S/tmp" TMPDIR=/tmp   "$@"
`;
  await mkdir(sbx, { recursive: true });
  await writeFile(zhbox, script);
  await chmod(zhbox, 493).catch(() => {
  });
  return zhbox;
}
async function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(body));
  });
}
async function handle(ctx, req, res) {
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  const url = new URL(String(req.url), "http://localhost");
  const action = url.pathname.replace("/api/zhbox", "").replace(/^\//, "") || "status";
  try {
    if (req.method === "GET" && action === "status") return send(200, await status());
    if (req.method === "POST" && action === "toggle") {
      const current = await status();
      const next = current.toggle === "on" ? "off" : "on";
      await writeFile(statePath(), `${next}
`);
      return send(200, { toggle: next });
    }
    if (req.method === "POST" && action === "install") {
      const sbx = sandboxDir();
      await mkdir(path.join(sbx, "rootfs"), { recursive: true });
      await mkdir(path.join(sbx, "tmp"), { recursive: true });
      let seeded = false;
      try {
        await readFile(path.join(sbx, "rootfs/usr/bin/zh-setup"));
        seeded = true;
      } catch {
      }
      if (!seeded) {
        const tar = path.join(filesDir(), "zh-rootfs.tar.gz");
        const x = await run("tar", ["xzf", tar, "-C", path.join(sbx, "rootfs")], 3e5);
        if (x.code !== 0) return send(500, { error: `rootfs extract failed: ${x.stderr.slice(0, 400)}` });
      }
      await chmod(path.join(payloadBin(), "proot"), 493).catch(() => {
      });
      await chmod(path.join(payloadBin(), "proot-loader"), 493).catch(() => {
      });
      const resolv = path.join(sbx, "rootfs/etc/resolv.conf");
      await writeFile(resolv, "nameserver 1.1.1.1\nnameserver 8.8.8.8\n").catch(() => {
      });
      const zhbox = await ensureZhbox();
      const setupScript = await ensureSetupScript();
      const install = await run("sh", [zhbox, "sh", setupScript], 6e5);
      return send(200, { code: install.code, output: `${install.stdout}${install.stderr}`.trim().slice(-4e3) });
    }
    if (req.method === "POST" && action === "gorust") {
      const sbx = sandboxDir();
      await mkdir(path.join(sbx, "rootfs"), { recursive: true });
      await mkdir(path.join(sbx, "tmp"), { recursive: true });
      const zhbox = await ensureZhbox();
      const setupScript = await ensureSetupScript();
      const install = await run("sh", [zhbox, "sh", setupScript, "--only=gorust"], 6e5);
      return send(200, { code: install.code, output: `${install.stdout}${install.stderr}`.trim().slice(-4e3) });
    }
    if (req.method === "POST" && action === "test") return send(200, await testSandbox());
    return send(404, { error: `unknown action: ${action}` });
  } catch (error) {
    return send(500, { error: error instanceof Error ? error.message : String(error) });
  }
}
function apply(ctx) {
  const rejected = (req, res) => {
    const rejection = ctx.connection.requestRejection(req);
    if (rejection === void 0) return false;
    res.statusCode = rejection;
    res.end();
    return true;
  };
  ctx.webServer.register({
    kind: "prefix",
    path: "/api/zhbox",
    handler: async (req, res) => {
      if (rejected(req, res)) return;
      if (req.method === "POST" && ["toggle", "install", "test", "gorust"].includes(new URL(String(req.url), "http://localhost").pathname.replace("/api/zhbox", "").replace(/^\//, ""))) {
        await readBody(req);
      }
      await handle(ctx, req, res);
    }
  }, "zhbox: sandbox control route");
}
export {
  apply,
  inject,
  name
};
