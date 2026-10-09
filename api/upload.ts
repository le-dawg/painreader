import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function json(response: any, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

async function readBody(request: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    json(response, 405, { ok: false, message: "Method not allowed" });
    return;
  }

  const uploadId = randomUUID();
  const body = await readBody(request);
  const outputDir = path.join(process.cwd(), ".runtime-uploads");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${uploadId}.bin`), body);

  const callbackPath = path.join(outputDir, `${uploadId}.json`);
  const payload = {
    ok: true,
    event: "upload.succeeded",
    uploadId,
    source: "ksp-letter-scan-pwa",
    assetUrl: `/api/uploads/${uploadId}`,
    callbackUrl: "/api/callback",
    threadTriggerMode: "local-poller",
    timestamp: new Date().toISOString()
  };
  await writeFile(callbackPath, JSON.stringify(payload, null, 2));

  json(response, 200, payload);
}
