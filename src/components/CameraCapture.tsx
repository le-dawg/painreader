import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { preprocessDocument } from "../lib/preprocess";
import { CaptureState, UploadReceipt } from "../lib/types";
import { ScanPreview } from "./ScanPreview";

const initialState: CaptureState = {
  originalBlob: null,
  processedBlob: null,
  originalUrl: null,
  processedUrl: null,
  status: "idle",
  error: null,
  receipt: null
};

async function generateSyntheticLetterBlob(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.fillStyle = "#dfd0b9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((-6 * Math.PI) / 180);
  context.fillStyle = "#ffffff";
  context.fillRect(-420, -580, 840, 1160);
  context.strokeStyle = "#17130f";
  context.lineWidth = 5;
  context.strokeRect(-420, -580, 840, 1160);
  context.fillStyle = "#17130f";
  context.font = "bold 62px Arial";
  context.fillText("KSP", -300, -420);
  context.font = "52px Arial";
  context.fillText("Aktenzeichen: GK2791048", -300, -290);
  context.fillText("Betrag: EUR 905,32", -300, -190);
  context.fillText("Frist: 07.10.2026", -300, -90);
  context.fillText("PayPal Forderung", -300, 10);
  context.restore();

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode synthetic letter"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function uploadProcessedScan(blob: Blob): Promise<UploadReceipt> {
  const bridgeBase =
    new URLSearchParams(window.location.search).get("bridge") ??
    window.localStorage.getItem("ksp-scan-bridge-url") ??
    window.location.origin;

  if (!bridgeBase) {
    throw new Error("Set a bridge URL before uploading");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuffer));
  const response = await fetch(`${bridgeBase.replace(/\/$/, "")}/upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      filename: "ksp-letter-scan.png",
      mimeType: "image/png",
      bytes
    })
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  const receipt = (await response.json()) as UploadReceipt;

  await fetch(`${bridgeBase.replace(/\/$/, "")}${receipt.callbackUrl}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(receipt)
  });

  return receipt;
}

export function CameraCapture() {
  const [state, setState] = useState<CaptureState>(initialState);
  const bridgeUrl = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("bridge") ??
      window.localStorage.getItem("ksp-scan-bridge-url") ??
      window.location.origin,
    []
  );

  const statusLabel = useMemo(() => {
    switch (state.status) {
      case "captured":
        return "Foto übernommen.";
      case "processing":
        return "Wird kurz vorbereitet.";
      case "ready":
        return "Bereit zum Senden.";
      case "uploading":
        return "Wird gesendet.";
      case "uploaded":
        return "Fertig hochgeladen.";
      case "error":
        return state.error ?? "Something went wrong.";
      default:
        return "Hey, bitte einfach hier hochladen.";
    }
  }, [state.error, state.status]);

  async function processBlob(file: Blob) {
    const originalUrl = URL.createObjectURL(file);
    setState({
      originalBlob: file,
      processedBlob: null,
      originalUrl,
      processedUrl: null,
      status: "captured",
      error: null,
      receipt: null
    });

    setState((current) => ({ ...current, status: "processing" }));
    const processedBlob = await preprocessDocument(file);
    const processedUrl = URL.createObjectURL(processedBlob);
    setState((current) => ({
      ...current,
      processedBlob,
      processedUrl,
      status: "ready"
    }));
    return processedBlob;
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await processBlob(file);
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Processing failed"
      }));
    }
  }

  async function handleUpload() {
    if (!state.processedBlob) return;
    try {
      window.localStorage.setItem("ksp-scan-bridge-url", bridgeUrl);
      setState((current) => ({ ...current, status: "uploading", error: null }));
      const receipt = await uploadProcessedScan(state.processedBlob);
      setState((current) => ({
        ...current,
        receipt,
        status: "uploaded"
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed"
      }));
    }
  }

  useEffect(() => {
    const globalTarget = window as Window & {
      __scanTestHook?: {
        runSyntheticCaptureAndUpload: () => Promise<UploadReceipt>;
      };
    };

    globalTarget.__scanTestHook = {
      runSyntheticCaptureAndUpload: async () => {
        const syntheticBlob = await generateSyntheticLetterBlob();
        const processedBlob = await processBlob(syntheticBlob);
        window.localStorage.setItem("ksp-scan-bridge-url", bridgeUrl);
        setState((current) => ({ ...current, status: "uploading", error: null }));
        const receipt = await uploadProcessedScan(processedBlob);
        setState((current) => ({
          ...current,
          receipt,
          status: "uploaded"
        }));
        return receipt;
      }
    };

    return () => {
      delete globalTarget.__scanTestHook;
    };
  }, [bridgeUrl]);

  return (
    <section className="capture-panel">
      <div className="capture-copy">
        <h1>KSP Letter Scan</h1>
        <p className="intro">Hey, bitte einfach hier hochladen.</p>
      </div>
      <label className="capture-picker">
        <span>Kamera öffnen</span>
        <input accept="image/*" capture="environment" type="file" onChange={handleFileChange} />
      </label>
      <p className={`status status-${state.status}`}>{statusLabel}</p>
      {state.status !== "idle" ? (
        <div className="mini-preview-row">
          <ScanPreview imageUrl={state.processedUrl ?? state.originalUrl} compact />
        </div>
      ) : null}
      {state.status === "ready" || state.status === "uploading" || state.status === "uploaded" ? (
        <button
          className="upload-button"
          disabled={!state.processedBlob || state.status === "uploading" || !bridgeUrl}
          onClick={handleUpload}
        >
          Senden
        </button>
      ) : null}
      {state.receipt ? (
        <div className="done-pill" aria-live="polite">
          Gesendet
        </div>
      ) : null}
    </section>
  );
}
