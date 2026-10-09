# Queue Trigger Contract

## Upload success event

- event: upload.succeeded
- includes upload id
- includes public asset URL or payload handle
- includes timestamp
- includes source = ksp-letter-scan-pwa

## Queue bridge behavior

- receive upload success payload
- preserve the uploaded image on local disk
- queue a text message into the configured Codex thread
- include event file path, image file path, upload id, source, and timestamp
- do not perform local OCR inside the bridge
