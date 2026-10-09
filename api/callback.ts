import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function json(response: any, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

async function readJson(request: any): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    json(response, 405, { ok: false, message: "Method not allowed" });
    return;
  }

  const payload = await readJson(request);
  const outputDir = path.join(process.cwd(), ".runtime-callbacks");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${Date.now()}.json`), JSON.stringify(payload, null, 2));

  json(response, 200, { ok: true, received: true });
}
