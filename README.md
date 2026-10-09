# painreader

Temporary document upload bridge and PWA for routing image file paths into a Codex thread.

## What it does

- serves a simple mobile-first upload page
- accepts iOS / iPadOS camera captures
- preprocesses the image client-side for OCR-friendly contrast and deskew
- stores the uploaded file locally
- writes upload and callback event records
- queues the uploaded **file path** plus event metadata into a target Codex thread

## Important constraint

`codex queue` does not support image attachments, so the bridge sends file paths and metadata, not raw image bytes.

## Skill

The local Codex skill lives in `painreader-skill/` and supports:

- `/painreader`
- `/painreader close`
