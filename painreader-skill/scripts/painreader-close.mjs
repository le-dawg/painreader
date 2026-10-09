import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const stateRoot = path.join(repoRoot, ".painreader-state");

function normalizeThread(value) {
  const raw = (value || "").trim();
  const prefix = "codex://threads/";
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function parseArgs(argv) {
  const threadIndex = argv.indexOf("--thread");
  if (threadIndex === -1 || !argv[threadIndex + 1]) {
    throw new Error("Missing --thread");
  }
  return normalizeThread(argv[threadIndex + 1]);
}

function tryKill(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

const threadId = parseArgs(process.argv.slice(2));
const statePath = path.join(stateRoot, `${threadId}.json`);
let state = null;
try {
  state = JSON.parse(await readFile(statePath, "utf8"));
} catch {
  console.log(
    JSON.stringify(
      {
        threadId,
        serverStopped: false,
        ngrokStopped: false,
        runtimeRemoved: false,
        alreadyClosed: true
      },
      null,
      2
    )
  );
  process.exit(0);
}

const serverStopped = tryKill(state.serverPid);
const ngrokStopped = tryKill(state.ngrokPid);
await rm(state.runtimeDir, { recursive: true, force: true });
await rm(statePath, { force: true });

console.log(
  JSON.stringify(
    {
      threadId,
      serverStopped,
      ngrokStopped,
      runtimeRemoved: true
    },
    null,
    2
  )
);
