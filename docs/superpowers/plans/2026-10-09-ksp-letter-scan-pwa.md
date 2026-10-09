# KSP Letter Scan PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a public no-auth PWA for iOS/iPadOS document capture that preprocesses scans for OCR quality, uploads them through a callback-capable backend, and proves the OCR-trigger workflow end to end.

**Architecture:** Use a greenfield TypeScript web app with a mobile-first capture UI, client-side preprocessing, and a thin deployable backend for upload intake and event callbacks. Keep the core scanning pipeline on-device for responsiveness and privacy, and isolate the event-trigger bridge so the thread-callback limitation can be handled explicitly.

**Tech Stack:** Vite, React, TypeScript, PWA plugin, HTML5 camera APIs, canvas/OpenCV-style client preprocessing, Node serverless routes, Vercel preview deployment.

## Global Constraints

- Public URL must be accessible without auth.
- UX must work from iOS / iPadOS camera capture.
- Captured pages must be auto-cropped, straightened, and thresholded for OCR quality.
- Successful upload must emit a deterministic event/callback.
- Solution must be reviewed at least twice against:
  - public accessibility
  - scan quality for OCR
  - trigger behavior into the OCR workflow
- Keep user-facing upload flow as low-friction as possible.
- If exact callback into the currently open chat thread is impossible with available interfaces, preserve a deterministic callback bridge and make the limitation explicit.

---

### Task 1: Research Feasibility and Lock Architecture

**Files:**
- Create: `research/feasibility-notes.md`
- Create: `research/architecture-decision.md`

**Interfaces:**
- Consumes: current user requirements from this plan
- Produces: approved architecture, explicit callback limitation statement, chosen scan pipeline

- [ ] **Step 1: Record hard requirements**

Create `research/feasibility-notes.md` with:

```md
# Feasibility Notes

## Hard requirements

- Public no-auth URL
- iOS/iPadOS camera capture
- Auto-crop
- Deskew / straighten
- Threshold / scan look
- Upload callback
- OCR trigger path for KSP-letter workflow
- Two review passes
```

- [ ] **Step 2: Write architecture decision record**

Create `research/architecture-decision.md` with:

```md
# Architecture Decision

## Candidate shape

- Frontend PWA handles capture and preprocessing
- Backend handles upload intake and callback emission
- OCR trigger bridge is isolated from upload backend

## Open question

- Can callback target the currently open chat thread directly?
```

- [ ] **Step 3: Capture final architecture decision**

Update `research/architecture-decision.md` after research with:

```md
## Decision

- Chosen frontend stack: <fill from research>
- Chosen preprocessing stack: <fill from research>
- Chosen backend/deploy path: <fill from research>
- Chosen OCR trigger bridge: <fill from research>

## Constraint decision

- Direct callback into current thread: yes/no
- If no: exact fallback bridge
```

- [ ] **Step 4: Verify files exist**

Run: `ls -la research && sed -n '1,220p' research/architecture-decision.md`
Expected: both files present and architecture decision written


### Task 2: Scaffold the App and Backend

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/components/CameraCapture.tsx`
- Create: `src/components/ScanPreview.tsx`
- Create: `src/lib/preprocess.ts`
- Create: `src/lib/types.ts`
- Create: `api/upload.ts`
- Create: `api/callback.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`

**Interfaces:**
- Consumes: architecture decision from Task 1
- Produces: runnable local app and deployable backend endpoints

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ksp-letter-scan-pwa",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Create core frontend entrypoints**

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```tsx
// src/App.tsx
import { CameraCapture } from "./components/CameraCapture";

export default function App() {
  return (
    <main className="app-shell">
      <section className="app-panel">
        <h1>KSP Letter Scan</h1>
        <p>Capture, clean up, and upload a letter page for OCR.</p>
        <CameraCapture />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create upload API placeholders**

```ts
// api/upload.ts
export default async function handler(req: any, res: any) {
  res.status(501).json({ ok: false, message: "Not implemented yet" });
}
```

```ts
// api/callback.ts
export default async function handler(req: any, res: any) {
  res.status(501).json({ ok: false, message: "Not implemented yet" });
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: install completes and lockfile is created

- [ ] **Step 5: Verify local scaffold**

Run: `npm run build`
Expected: initial scaffold builds successfully


### Task 3: Implement Camera Capture for iOS/iPadOS

**Files:**
- Modify: `src/components/CameraCapture.tsx`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: frontend scaffold from Task 2
- Produces: captured source image blob and metadata

- [ ] **Step 1: Define capture state types**

```ts
// src/lib/types.ts
export type CaptureState = {
  originalBlob: Blob | null;
  processedBlob: Blob | null;
  originalUrl: string | null;
  processedUrl: string | null;
  status: "idle" | "captured" | "processing" | "ready" | "uploading" | "uploaded" | "error";
  error: string | null;
};
```

- [ ] **Step 2: Implement file/camera capture UI**

```tsx
// key UI contract inside CameraCapture.tsx
<input
  accept="image/*"
  capture="environment"
  type="file"
  onChange={handleFileChange}
/>
```

- [ ] **Step 3: Store selected image and preview**

```tsx
const file = event.target.files?.[0];
if (!file) return;
const url = URL.createObjectURL(file);
setCaptureState({
  originalBlob: file,
  processedBlob: null,
  originalUrl: url,
  processedUrl: null,
  status: "captured",
  error: null
});
```

- [ ] **Step 4: Verify capture flow**

Run: `npm run build`
Expected: build passes with capture component wired


### Task 4: Implement OCR-Oriented Preprocessing

**Files:**
- Modify: `src/lib/preprocess.ts`
- Modify: `src/components/CameraCapture.tsx`
- Modify: `src/components/ScanPreview.tsx`

**Interfaces:**
- Consumes: source image blob from Task 3
- Produces: processed image blob with crop/deskew/threshold pipeline

- [ ] **Step 1: Build preprocessing function signature**

```ts
// src/lib/preprocess.ts
export async function preprocessDocument(input: Blob): Promise<Blob> {
  throw new Error("not implemented");
}
```

- [ ] **Step 2: Implement the image pipeline**

The implementation must perform:

```ts
// required stages
// 1. decode image
// 2. detect document bounds
// 3. perspective correction
// 4. grayscale conversion
// 5. thresholding
// 6. encode PNG
```

- [ ] **Step 3: Call preprocessing after capture**

```tsx
setCaptureState((s) => ({ ...s, status: "processing", error: null }));
const processedBlob = await preprocessDocument(file);
const processedUrl = URL.createObjectURL(processedBlob);
setCaptureState((s) => ({
  ...s,
  processedBlob,
  processedUrl,
  status: "ready"
}));
```

- [ ] **Step 4: Show before/after previews**

```tsx
// ScanPreview.tsx contract
type ScanPreviewProps = {
  originalUrl: string | null;
  processedUrl: string | null;
};
```

- [ ] **Step 5: Verify processed output path**

Run: `npm run build`
Expected: build passes with preprocessing wired in


### Task 5: Implement Upload, Event Callback, and OCR Bridge Contract

**Files:**
- Modify: `api/upload.ts`
- Modify: `api/callback.ts`
- Create: `bridge/ocr-trigger-contract.md`
- Create: `bridge/ocr-trigger.js`

**Interfaces:**
- Consumes: processed image blob from Task 4
- Produces: successful upload event, callback payload, OCR bridge hook

- [ ] **Step 1: Define callback contract**

Create `bridge/ocr-trigger-contract.md`:

```md
# OCR Trigger Contract

## Upload success event

- event: upload.succeeded
- includes upload id
- includes public asset URL or payload handle
- includes timestamp
- includes source = ksp-letter-scan-pwa

## OCR bridge behavior

- receive upload success payload
- trigger OCR worker/subagent path
- persist result or failure log
```

- [ ] **Step 2: Implement upload endpoint success payload**

```ts
res.status(200).json({
  ok: true,
  event: "upload.succeeded",
  uploadId,
  assetUrl,
  source: "ksp-letter-scan-pwa",
  timestamp: new Date().toISOString()
});
```

- [ ] **Step 3: Implement callback endpoint**

```ts
res.status(200).json({
  ok: true,
  received: true
});
```

- [ ] **Step 4: Implement local OCR bridge stub**

```js
// bridge/ocr-trigger.js
console.log(JSON.stringify({
  ok: true,
  bridge: "received-upload-success-event"
}));
```

- [ ] **Step 5: Verify endpoints compile**

Run: `npm run build`
Expected: build passes and bridge contract exists


### Task 6: PWA Hardening and Mobile UX

**Files:**
- Modify: `public/manifest.webmanifest`
- Modify: `public/sw.js`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: working scan/upload app from Tasks 2-5
- Produces: installable PWA behavior and mobile-first layout

- [ ] **Step 1: Add manifest basics**

```json
{
  "name": "KSP Letter Scan",
  "short_name": "KSP Scan",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#ffffff",
  "theme_color": "#111111"
}
```

- [ ] **Step 2: Make mobile layout explicit**

```css
.app-shell {
  min-height: 100vh;
  padding: 1rem;
}

.app-panel {
  max-width: 42rem;
  margin: 0 auto;
}
```

- [ ] **Step 3: Verify production build**

Run: `npm run build`
Expected: frontend and API build cleanly


### Task 7: Deploy Public Preview and Capture Public URL

**Files:**
- Create: `.vercelignore`
- Create: `docs/deploy-log.md`

**Interfaces:**
- Consumes: full app from Tasks 1-6
- Produces: public URL, deploy evidence, rollback notes

- [ ] **Step 1: Create deploy log**

```md
# Deploy Log

- target platform: Vercel preview
- team: dawid-ai-raadgivnis-projects
- date: 2026-10-09
```

- [ ] **Step 2: Deploy preview**

Run: `vercel deploy /Users/thedawgctor/Desktop/tempfuk/5Oct-maltaskprep -y --no-wait --scope dawid-ai-raadgivnis-projects`
Expected: Vercel returns a preview deployment URL

- [ ] **Step 3: Inspect deploy**

Run: `vercel inspect <deployment-url> --scope dawid-ai-raadgivnis-projects`
Expected: deployment is reachable and build is ready

- [ ] **Step 4: Record public URL**

Append to `docs/deploy-log.md`:

```md
- preview url: <url>
- inspect status: ready
```


### Task 8: Review Pass 1 and Review Pass 2

**Files:**
- Create: `qa/review-pass-1.md`
- Create: `qa/review-pass-2.md`

**Interfaces:**
- Consumes: public deployment and QA matrix
- Produces: two explicit gate decisions

- [ ] **Step 1: Record first pass**

```md
# Review Pass 1

- public url reachable: pass/fail
- iOS/iPadOS camera capture flow: pass/fail
- crop/straighten/threshold quality: pass/fail
- upload success callback: pass/fail
- OCR bridge behavior: pass/fail
```

- [ ] **Step 2: Fix any critical failures from pass 1**

Run only targeted fixes needed to move failed gates to passing.

- [ ] **Step 3: Record second pass**

```md
# Review Pass 2

- public url reachable: pass/fail
- scan output acceptable for OCR: pass/fail
- callback/trigger contract works: pass/fail
- release decision: ship / blocked
```

- [ ] **Step 4: Final verification**

Run:

```bash
cat docs/deploy-log.md
printf '\n---\n'
cat qa/review-pass-1.md
printf '\n---\n'
cat qa/review-pass-2.md
```

Expected: both review passes documented and critical gates explicitly marked
