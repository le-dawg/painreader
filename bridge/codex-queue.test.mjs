import test from "node:test";
import assert from "node:assert/strict";

import { buildCodexQueueArgs, buildQueueMessage, updateQueueAuditState } from "./codex-queue.mjs";

test("buildQueueMessage includes file references without local OCR dependency", () => {
  const message = buildQueueMessage(
    {
      eventPath: "/tmp/runtime-events/upload.json",
      imagePath: "/tmp/runtime-uploads/scan.png",
      payload: {
        uploadId: "upload-123",
        source: "ksp-letter-scan-pwa",
        timestamp: "2026-10-09T12:00:00.000Z"
      }
    },
    {
      promptTemplate:
        "Thread task for {{uploadId}}\nImage: {{imagePath}}\nEvent: {{eventPath}}\nSource: {{source}}\nCaptured: {{timestamp}}"
    }
  );

  assert.match(message, /Thread task for upload-123/);
  assert.match(message, /Image: \/tmp\/runtime-uploads\/scan\.png/);
  assert.match(message, /Event: \/tmp\/runtime-events\/upload\.json/);
  assert.match(message, /Source: ksp-letter-scan-pwa/);
  assert.match(message, /Captured: 2026-10-09T12:00:00.000Z/);
});

test("updateQueueAuditState appends attempts and updates latest status", () => {
  const nextState = updateQueueAuditState(
    {
      eventFile: "1791538979733-upload.json",
      uploadId: "upload-123",
      attempts: [
        {
          at: "2026-10-09T12:00:00.000Z",
          status: "skipped"
        }
      ]
    },
    {
      at: "2026-10-09T12:05:00.000Z",
      status: "queued",
      thread: "thread-abc"
    }
  );

  assert.equal(nextState.latestStatus, "queued");
  assert.equal(nextState.latestThread, "thread-abc");
  assert.equal(nextState.attempts.length, 2);
  assert.deepEqual(nextState.attempts.at(-1), {
    at: "2026-10-09T12:05:00.000Z",
    status: "queued",
    thread: "thread-abc"
  });
});

test("buildCodexQueueArgs creates a text-only queue command", () => {
  const args = buildCodexQueueArgs({
    thread: "01a10c3b-c29c-7f70-a1b1-7da53619b823",
    message: "queue this OCR payload"
  });

  assert.deepEqual(args, [
    "queue",
    "--thread",
    "01a10c3b-c29c-7f70-a1b1-7da53619b823",
    "--message",
    "queue this OCR payload"
  ]);
});
