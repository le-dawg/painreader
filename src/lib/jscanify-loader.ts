declare global {
  interface Window {
    cv: unknown;
    jscanify: new () => {
      extractPaper(image: HTMLCanvasElement | HTMLImageElement, width: number, height: number): HTMLCanvasElement;
    };
  }
}

const OPENCV_URL = "https://docs.opencv.org/4.7.0/opencv.js";
const JSCANIFY_URL = "https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js";

let loadPromise: Promise<void> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      if ((existing as any).dataset.loaded === "true") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      (script as any).dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export async function ensureScannerRuntime() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    await injectScript(OPENCV_URL);
    await injectScript(JSCANIFY_URL);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    if (!window.jscanify) {
      throw new Error("jscanify runtime unavailable");
    }
  })();

  await loadPromise;
}
