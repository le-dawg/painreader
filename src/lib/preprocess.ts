import { ensureScannerRuntime } from "./jscanify-loader";

function drawThreshold(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let sum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    sum += gray;
  }

  const threshold = sum / (data.length / 4);
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preprocessDocument(input: Blob): Promise<Blob> {
  await ensureScannerRuntime();
  const scanner = new window.jscanify();
  const image = await blobToImage(input);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Canvas context unavailable");
  }

  sourceContext.drawImage(image, 0, 0);

  let resultCanvas: HTMLCanvasElement;
  try {
    resultCanvas = scanner.extractPaper(sourceCanvas, image.width, image.height);
  } catch {
    resultCanvas = sourceCanvas;
  }

  drawThreshold(resultCanvas);

  return await new Promise((resolve, reject) => {
    resultCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode processed image"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
