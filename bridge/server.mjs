import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.PORT || 4319);
const HOST = "0.0.0.0";
const repoRoot = process.cwd();
const runtimeRoot = process.env.PAINREADER_RUNTIME_DIR
  ? path.resolve(process.env.PAINREADER_RUNTIME_DIR)
  : repoRoot;
const webRoot = process.env.PAINREADER_WEB_ROOT
  ? path.resolve(process.env.PAINREADER_WEB_ROOT)
  : path.join(repoRoot, "dist");
const uploadsDir = path.join(runtimeRoot, ".runtime-uploads");
const eventsDir = path.join(runtimeRoot, ".runtime-events");

await mkdir(uploadsDir, { recursive: true });
await mkdir(eventsDir, { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function triggerQueueBridge() {
  const child = spawn("node", [path.join(repoRoot, "bridge", "ocr-trigger.js")], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      PAINREADER_RUNTIME_DIR: runtimeRoot
    },
    stdio: "ignore"
  });
  child.unref();
}

async function serveStatic(request, response) {
  const incomingPath = (request.url || "/").split("?")[0];
  const requestPath = incomingPath === "/" ? "/index.html" : incomingPath;
  const candidatePath = path.join(webRoot, requestPath);
  const fallbackPath = path.join(webRoot, "index.html");
  const filePath =
    fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()
      ? candidatePath
      : fallbackPath;
  const extension = path.extname(filePath);
  response.writeHead(200, {
    "content-type": contentTypes[extension] || "application/octet-stream"
  });
  response.end(await readFile(filePath));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && request.url === "/upload") {
    try {
      const body = JSON.parse((await readBody(request)).toString("utf8"));
      const uploadId = randomUUID();
      const bytes = Array.isArray(body.bytes) ? Uint8Array.from(body.bytes) : new Uint8Array();
      const filename = body.filename || `${uploadId}.png`;
      const targetPath = path.join(uploadsDir, filename);
      await writeFile(targetPath, bytes);

      const event = {
        ok: true,
        event: "upload.succeeded",
        uploadId,
        source: "ksp-letter-scan-pwa",
        assetUrl: targetPath,
        callbackUrl: "/callback",
        threadTriggerMode: "local-poller",
        timestamp: new Date().toISOString()
      };
      await writeFile(path.join(eventsDir, `${Date.now()}-${uploadId}.json`), JSON.stringify(event, null, 2));
      sendJson(response, 200, event);
      return;
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "upload failed" });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/callback") {
    try {
      const payload = JSON.parse((await readBody(request)).toString("utf8"));
      await writeFile(path.join(eventsDir, `${Date.now()}-callback.json`), JSON.stringify(payload, null, 2));
      triggerQueueBridge();
      sendJson(response, 200, { ok: true, received: true });
      return;
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "callback failed" });
      return;
    }
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }

  sendJson(response, 404, { ok: false, message: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      ok: true,
      port: PORT,
      uploadUrl: `http://127.0.0.1:${PORT}/upload`,
      webUrl: `http://127.0.0.1:${PORT}/`
    })
  );
});
