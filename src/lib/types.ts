export type CaptureStatus =
  | "idle"
  | "captured"
  | "processing"
  | "ready"
  | "uploading"
  | "uploaded"
  | "error";

export type UploadReceipt = {
  ok: boolean;
  event: "upload.succeeded";
  uploadId: string;
  source: "ksp-letter-scan-pwa";
  assetUrl: string;
  callbackUrl: string;
  threadTriggerMode: "local-poller";
  timestamp: string;
};

export type CaptureState = {
  originalBlob: Blob | null;
  processedBlob: Blob | null;
  originalUrl: string | null;
  processedUrl: string | null;
  status: CaptureStatus;
  error: string | null;
  receipt: UploadReceipt | null;
};
