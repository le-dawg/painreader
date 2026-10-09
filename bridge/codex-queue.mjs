import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_QUEUE_PROMPT_TEMPLATE = [
  "A new local-bridge scan is ready.",
  "",
  "Use the image file at the path below as the primary source document.",
  "Event file: {{eventPath}}",
  "Image path: {{imagePath}}",
  "Upload ID: {{uploadId}}",
  "Source: {{source}}",
  "Captured at: {{timestamp}}",
  "",
  "No local OCR was performed by the bridge.",
  "Do OCR from the image file yourself in this Codex thread and continue the downstream automation flow."
].join("\n");

const DEFAULT_CONFIG_PATH = path.join("bridge", "codex-queue.config.json");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeThread(value) {
  const normalized = normalizeString(value);
  const prefix = "codex://threads/";
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length);
  }
  return normalized;
}

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

export function shouldQueueEvent(eventFile, payload) {
  return Boolean(payload?.event === "upload.succeeded" && !eventFile.endsWith("-callback.json"));
}

export function buildQueueMessage(context, config = {}) {
  const payload = context.payload ?? {};
  const template = normalizeString(config.promptTemplate) || DEFAULT_QUEUE_PROMPT_TEMPLATE;
  const replacements = {
    eventPath: context.eventPath ?? "",
    imagePath: context.imagePath ?? "",
    source: payload.source ?? "unknown",
    timestamp: payload.timestamp ?? "",
    uploadId: payload.uploadId ?? ""
  };

  return Object.entries(replacements).reduce(function replaceToken(message, entry) {
    const key = entry[0];
    const value = entry[1];
    return message.replaceAll("{{" + key + "}}", String(value));
  }, template);
}

export function updateQueueAuditState(currentState = {}, attempt) {
  const attempts = Array.isArray(currentState.attempts) ? currentState.attempts.concat(attempt) : [attempt];
  return {
    ...currentState,
    attempts,
    latestStatus: attempt.status,
    latestThread: attempt.thread ?? null,
    updatedAt: attempt.at
  };
}

export async function loadQueueConfig(rootDir = process.cwd(), env = process.env) {
  const configPath = path.resolve(rootDir, env.CODEX_QUEUE_CONFIG_PATH ?? DEFAULT_CONFIG_PATH);
  const fileConfig = (await readJsonIfExists(configPath)) ?? {};

  return {
    enabled: env.CODEX_QUEUE_ENABLED ? env.CODEX_QUEUE_ENABLED !== "0" : fileConfig.enabled !== false,
    thread: normalizeThread(env.CODEX_QUEUE_THREAD ?? fileConfig.thread),
    promptTemplate: env.CODEX_QUEUE_PROMPT ?? fileConfig.promptTemplate ?? DEFAULT_QUEUE_PROMPT_TEMPLATE,
    configPath
  };
}

export async function isReadableFile(targetPath) {
  if (!normalizeString(targetPath)) {
    return false;
  }

  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeQueueAudit(auditDir, eventFile, payload, attempt) {
  await mkdir(auditDir, { recursive: true });
  const auditPath = path.join(auditDir, eventFile);
  const currentState = (await readJsonIfExists(auditPath)) ?? {
    eventFile,
    uploadId: payload?.uploadId ?? null,
    source: payload?.source ?? null,
    createdAt: attempt.at,
    attempts: []
  };
  const nextState = updateQueueAuditState(currentState, attempt);
  await writeFile(auditPath, JSON.stringify(nextState, null, 2));
  return {
    auditPath,
    state: nextState
  };
}

export function buildCodexQueueArgs({ thread, message }) {
  return ["queue", "--thread", thread, "--message", message];
}

function resolveCodexBinary() {
  if (normalizeString(process.env.CODEX_BIN)) {
    return process.env.CODEX_BIN;
  }

  const home = normalizeString(process.env.HOME);
  if (home) {
    const voltaCodex = path.join(home, ".volta", "bin", "codex");
    return voltaCodex;
  }

  return "codex";
}

export async function runCodexQueue({ thread, message, cwd }) {
  return await new Promise((resolve) => {
    const args = buildCodexQueueArgs({ thread, message });
    const codexBinary = resolveCodexBinary();
    const child = spawn(codexBinary, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr: stderr || (error instanceof Error ? error.message : String(error)),
        args
      });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
        args,
        codexBinary
      });
    });
  });
}

export async function queueProcessedEvent({
  auditDir,
  config,
  eventFile,
  eventPath,
  imagePath,
  payload,
  rootDir
}) {
  const existingAuditPath = path.join(auditDir, eventFile);
  const existingAudit = await readJsonIfExists(existingAuditPath);
  if (existingAudit?.latestStatus === "queued") {
    return {
      status: "already-queued",
      auditPath: existingAuditPath,
      attempt: Array.isArray(existingAudit.attempts) ? existingAudit.attempts.at(-1) ?? null : null
    };
  }

  const attemptBase = {
    at: new Date().toISOString(),
    thread: config.thread || null,
    imagePath,
    eventPath
  };

  if (!config.enabled) {
    const attempt = { ...attemptBase, status: "skipped", reason: "queue disabled" };
    return {
      status: attempt.status,
      ...(await writeQueueAudit(auditDir, eventFile, payload, attempt)),
      attempt
    };
  }

  if (!config.thread) {
    const attempt = {
      ...attemptBase,
      status: "skipped",
      reason: "missing thread in " + config.configPath
    };
    return {
      status: attempt.status,
      ...(await writeQueueAudit(auditDir, eventFile, payload, attempt)),
      attempt
    };
  }

  if (!(await isReadableFile(imagePath))) {
    const attempt = { ...attemptBase, status: "failed", reason: "processed image file is not readable" };
    return {
      status: attempt.status,
      ...(await writeQueueAudit(auditDir, eventFile, payload, attempt)),
      attempt
    };
  }

  const message = buildQueueMessage(
    {
      eventPath,
      imagePath,
      payload
    },
    config
  );

  const commandResult = await runCodexQueue({
    thread: config.thread,
    message,
    cwd: rootDir
  });

  const attempt = {
    ...attemptBase,
      status: commandResult.ok ? "queued" : "failed",
      message,
      command: [commandResult.codexBinary ?? "codex"].concat(commandResult.args).join(" "),
      exitCode: commandResult.exitCode,
      stdout: commandResult.stdout || null,
      stderr: commandResult.stderr || null
  };

  return {
    status: attempt.status,
    ...(await writeQueueAudit(auditDir, eventFile, payload, attempt)),
    attempt
  };
}
