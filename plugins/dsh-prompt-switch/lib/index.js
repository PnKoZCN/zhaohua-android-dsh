import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "zprompt-switch";
export const inject = ["systemPrompt", "webServer", "connection"];

const HERE = path.dirname(fileURLToPath(import.meta.url));
// lib/ 上一级即插件根（payload/dshroot/lib/node_modules/@zhaohua/dsh-prompt-switch/）
const PROMPTS = path.join(HERE, "..", "prompts");
const homeFile = (n) => path.join(process.env.DSH_HOME ?? process.cwd(), n);

const MODES = { default: "default.txt", regular: "regular.txt", claude: "claude.txt" };

function readMode() {
  try {
    const m = readFileSync(homeFile("zh-prompt.mode"), "utf8").trim().toLowerCase();
    return Object.hasOwn(MODES, m) ? m : "default";
  } catch {
    return "default";
  }
}

const textCache = new Map();
function readPrompt(file) {
  if (textCache.has(file)) return textCache.get(file);
  const t = readFileSync(path.join(PROMPTS, file), "utf8");
  textCache.set(file, t);
  return t;
}

// 每次会话装配都会调用：模式文件改动即下一条消息生效（热切换）
export function promptProvider() {
  const mode = readMode();
  const file = MODES[mode];
  return readPrompt(file);
}

/** 首次挂载把激活能力清单种到 DSH_HOME（claude 模式 §8 引用）。 */
async function seedCapability() {
  const dst = homeFile("zh-capability.txt");
  try {
    const src = path.join(PROMPTS, "capability.txt");
    const text = await readFile(src, "utf8");
    if (!existsSync(dst) || readFileSync(dst, "utf8") !== text) writeFileSync(dst, text);
  } catch {}
}

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.variable("zhaohua_prompt", promptProvider), "zprompt: persona variable");
  seedCapability();

  const connection = ctx.connection;
  const rejected = (req, res) => {
    const code = connection?.requestRejection?.(req);
    if (code === undefined || code === null) return false;
    res.statusCode = code;
    res.end();
    return true;
  };

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/api/zprompt",
    handler: (req, res) => {
      if (rejected(req, res)) return;
      const url = new URL(String(req.url), "http://localhost");
      const action = url.pathname.replace("/api/zprompt", "").replace(/^\//, "") || "status";
      const send = (code, body) => {
        res.statusCode = code;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(body));
      };
      if (req.method === "GET" && action === "status") {
        const mode = readMode();
        const file = MODES[mode];
        const text = readPrompt(file);
        const size = text.length;
        const firstLine = text.split("\n")[0];
        return send(200, { mode, size, firstLine });
      }
      if (req.method === "POST" && action === "set-mode") {
        const mode = String(url.searchParams.get("mode") ?? "");
        if (!Object.hasOwn(MODES, mode)) return send(400, { error: "unknown mode: " + mode });
        writeFileSync(homeFile("zh-prompt.mode"), mode + "\n");
        return send(200, { mode });
      }
      return send(404, { error: "unknown action: " + action });
    },
  }), "zprompt: control route");
}
