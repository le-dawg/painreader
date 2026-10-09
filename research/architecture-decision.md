# Architecture Decision

## Candidate shape

- frontend PWA handles capture and preprocessing
- local bridge handles upload intake and callback emission
- Codex thread handoff happens through `codex queue`

## Decision

- chosen frontend stack: Vite + React + TypeScript + PWA plugin
- chosen preprocessing stack: client-side canvas pipeline with document extraction via jscanify, then grayscale + thresholding
- chosen bridge/deploy path: public Vercel-hosted frontend plus temporary local bridge exposed through ngrok when running in `/painreader` mode
- chosen thread handoff: `codex queue` with image filepath + event metadata

## Constraint decision

- direct callback into the currently open thread with raw image upload: no
- exact fallback bridge:
  - upload endpoint writes a success event payload
  - callback endpoint acknowledges receipt
  - local bridge preserves the uploaded image on disk
  - local bridge queues the image filepath plus event metadata into the target Codex thread
  - downstream OCR is done in-thread by Codex, not by the bridge
