import { spawn } from "node:child_process";
import fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const stateRoot = path.join(repoRoot, ".painreader-state");
const runtimeRootBase = path.join(repoRoot, ".painreader-runtime");

function normalizeThread(value) {
  const raw = (value || "").trim();
  const prefix = "codex://threads/";
  if (raw.startsWith(prefix)) {
    return { threadUri: raw, threadId: raw.slice(prefix.length) };
  }
  return { threadUri: `${prefix}${raw}`, threadId: raw };
}

function parseArgs(argv) {
  const threadIndex = argv.indexOf("--thread");
  if (threadIndex === -1 || !argv[threadIndex + 1]) {
    throw new Error("Missing --thread");
  }
  return normalizeThread(argv[threadIndex + 1]);
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate port"));
      });
    });
    server.on("error", reject);
  });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForTunnel(port, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      const data = await response.json();
      const tunnel = (data.tunnels || []).find((entry) => entry.config?.addr === `http://localhost:${port}`);
      if (tunnel?.public_url) return tunnel.public_url;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for ngrok tunnel");
}

async function readExistingState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return null;
  }
}

const { threadId, threadUri } = parseArgs(process.argv.slice(2));
await mkdir(stateRoot, { recursive: true });
await mkdir(runtimeRootBase, { recursive: true });

const runtimeDir = path.join(runtimeRootBase, threadId);
await mkdir(runtimeDir, { recursive: true });

const statePath = path.join(stateRoot, `${threadId}.json`);
const existingState = await readExistingState(statePath);
if (existingState?.publicUrl && existingState?.port) {
  try {
    await waitForHttp(`http://127.0.0.1:${existingState.port}/`, 2000);
    console.log(JSON.stringify(existingState, null, 2));
    process.exit(0);
  } catch {
    // fall through and replace stale state
  }
}

const port = await getFreePort();
const serverLog = path.join(runtimeDir, "server.log");
const ngrokLog = path.join(runtimeDir, "ngrok.log");

const serverProc = spawn("node", [path.join(repoRoot, "bridge", "server.mjs")], {
  cwd: repoRoot,
  detached: true,
  env: {
    ...process.env,
    PORT: String(port),
    PAINREADER_RUNTIME_DIR: runtimeDir,
    PAINREADER_WEB_ROOT: path.join(repoRoot, "dist"),
    CODEX_QUEUE_THREAD: threadUri
  },
  stdio: ["ignore", fs.openSync(serverLog, "a"), fs.openSync(serverLog, "a")]
});
serverProc.unref();

await waitForHttp(`http://127.0.0.1:${port}/`);

let publicUrl;
let ngrokPid = existingState?.ngrokPid ?? null;
try {
  publicUrl = await waitForTunnel(port, 2000);
} catch {
  const ngrokProc = spawn("ngrok", ["http", String(port)], {
    cwd: repoRoot,
    detached: true,
    env: process.env,
    stdio: ["ignore", fs.openSync(ngrokLog, "a"), fs.openSync(ngrokLog, "a")]
  });
  ngrokProc.unref();
  ngrokPid = ngrokProc.pid;
  publicUrl = await waitForTunnel(port);
}

const state = {
  threadId,
  threadUri,
  port,
  publicUrl,
  runtimeDir,
  serverPid: serverProc.pid,
  ngrokPid,
  startedAt: new Date().toISOString(),
  serverLog,
  ngrokLog
};

await writeFile(statePath, JSON.stringify(state, null, 2));
console.log(JSON.stringify(state, null, 2));
