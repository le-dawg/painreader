import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadQueueConfig, queueProcessedEvent, shouldQueueEvent } from "./codex-queue.mjs";

const rootDir = process.cwd();
const runtimeRoot = process.env.PAINREADER_RUNTIME_DIR
  ? path.resolve(process.env.PAINREADER_RUNTIME_DIR)
  : rootDir;
const eventsDir = path.join(runtimeRoot, ".runtime-events");
const queueAuditDir = path.join(runtimeRoot, ".runtime-codex-queue");
const queueConfig = await loadQueueConfig(rootDir, process.env);

await mkdir(queueAuditDir, { recursive: true });

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await readFile(targetPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

const entries = await readdir(eventsDir).catch(() => []);
const events = entries.filter((entry) => entry.endsWith(".json")).sort();

let queued = 0;
let queueFailures = 0;
let queueSkips = 0;
for (const eventFile of events) {
  const eventPath = path.join(eventsDir, eventFile);
  const payload = JSON.parse(await readFile(eventPath, "utf8"));

  if (!shouldQueueEvent(eventFile, payload)) {
    continue;
  }

  const queueResult = await queueProcessedEvent({
    auditDir: queueAuditDir,
    config: queueConfig,
    eventFile,
    eventPath,
      imagePath: payload.assetUrl,
      payload,
      rootDir
    });

  if (queueResult.status === "queued" || queueResult.status === "already-queued") {
    queued += 1;
  } else if (queueResult.status === "failed") {
    queueFailures += 1;
  } else {
    queueSkips += 1;
  }
}

console.log(
  JSON.stringify({
    ok: true,
    queued,
    queueFailures,
    queueSkips,
    queueConfigPath: queueConfig.configPath
  })
);
