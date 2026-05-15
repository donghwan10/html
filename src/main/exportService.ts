import { BrowserWindow, dialog } from "electron";
import type { SaveDialogOptions } from "electron";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { CaptureMode, ExportImagePayload, ExportPdfPayload } from "../shared/types";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const maxFullDocumentHeight = 80000;

class FullDocumentTooTallError extends Error {
  constructor(public readonly height: number) {
    super(`Full document capture is too tall: ${height}px`);
    this.name = "FullDocumentTooTallError";
  }
}

interface PageMetrics {
  width: number;
  height: number;
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

async function createExportWindow(width = 1280, height = 900): Promise<BrowserWindow> {
  return new BrowserWindow({
    width,
    height,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });
}

async function loadUrlAndWaitForFinish(window: BrowserWindow, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      window.webContents.removeListener("did-finish-load", handleFinish);
      window.webContents.removeListener("did-fail-load", handleFailure);
    };

    const handleFinish = (): void => {
      cleanup();
      resolve();
    };

    const handleFailure = (
      _event: unknown,
      errorCode: number,
      errorDescription: string,
      validatedUrl: string
    ): void => {
      cleanup();
      reject(new Error(`Failed to load export document (${errorCode}): ${errorDescription} ${validatedUrl}`));
    };

    window.webContents.once("did-finish-load", handleFinish);
    window.webContents.once("did-fail-load", handleFailure);
    window.loadURL(url).catch((error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function loadPreviewDocument(window: BrowserWindow, html: string): Promise<void> {
  await loadUrlAndWaitForFinish(window, `data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await window.webContents.executeJavaScript(
    "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true"
  );
  await window.webContents.executeJavaScript(`Promise.race([
    Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) {
        return true;
      }
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    })),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]).then(() => true)`);
  await delay(120);
}

async function getPageBackground(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(`(() => {
    const candidates = [document.body, document.documentElement].filter(Boolean);
    for (const element of candidates) {
      const color = getComputedStyle(element).backgroundColor;
      if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
        return color;
      }
    }
    return "#ffffff";
  })()`);
}

async function getPageMetrics(window: BrowserWindow): Promise<PageMetrics> {
  return window.webContents.executeJavaScript(`(() => {
    const doc = document.documentElement;
    const body = document.body || doc;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth, doc.offsetWidth, body.offsetWidth);
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight, doc.offsetHeight, body.offsetHeight);
    return {
      width: Math.ceil(scrollWidth),
      height: Math.ceil(scrollHeight),
      scrollWidth: Math.ceil(scrollWidth),
      scrollHeight: Math.ceil(scrollHeight),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  })()`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function captureViewport(window: BrowserWindow, format: "png" | "jpg", background: string): Promise<Buffer> {
  const image = await window.webContents.capturePage();
  return format === "png"
    ? image.toPNG()
    : sharp(image.toPNG()).flatten({ background }).jpeg({ quality: 92 }).toBuffer();
}

async function captureFullDocument(window: BrowserWindow, format: "png" | "jpg", background: string): Promise<Buffer> {
  const firstMetrics = await getPageMetrics(window);
  const targetWidth = clamp(firstMetrics.scrollWidth, 900, 2400);
  const tileHeight = 1400;

  window.setContentSize(targetWidth, tileHeight);
  await delay(120);

  const metrics = await getPageMetrics(window);
  if (metrics.scrollHeight > maxFullDocumentHeight) {
    throw new FullDocumentTooTallError(metrics.scrollHeight);
  }

  const fullHeight = Math.max(1, metrics.scrollHeight);
  const composites: sharp.OverlayOptions[] = [];
  let outputWidth = targetWidth;
  let scaledHeight = fullHeight;
  let y = 0;
  let previousActualY = -1;

  while (y < fullHeight) {
    await window.webContents.executeJavaScript(`window.scrollTo(0, ${Math.floor(y)}); window.scrollY;`);
    await delay(80);

    const actualY = await window.webContents.executeJavaScript("Math.round(window.scrollY)");
    if (actualY === previousActualY && actualY !== 0) {
      break;
    }
    previousActualY = actualY;

    const remaining = Math.max(1, fullHeight - actualY);
    const captureHeight = Math.min(tileHeight, remaining);
    const nativeImage = await window.webContents.capturePage({
      x: 0,
      y: 0,
      width: targetWidth,
      height: captureHeight
    });
    const size = nativeImage.getSize();
    const scale = size.width / targetWidth;
    outputWidth = size.width;
    scaledHeight = Math.ceil(fullHeight * scale);

    const scaledCaptureHeight = Math.min(size.height, Math.ceil(captureHeight * scale));
    const input = await sharp(nativeImage.toPNG())
      .extract({
        left: 0,
        top: 0,
        width: size.width,
        height: scaledCaptureHeight
      })
      .png()
      .toBuffer();

    composites.push({
      input,
      left: 0,
      top: Math.round(actualY * scale)
    });

    if (actualY + captureHeight >= fullHeight) {
      break;
    }

    y = actualY + captureHeight;
  }

  const image = sharp({
    create: {
      width: outputWidth,
      height: scaledHeight,
      channels: 4,
      background
    }
  }).composite(composites);

  return format === "png"
    ? image.png().toBuffer()
    : image.flatten({ background }).jpeg({ quality: 92 }).toBuffer();
}

async function captureDocument(
  html: string,
  format: "png" | "jpg",
  captureMode: CaptureMode
): Promise<Buffer> {
  const window = await createExportWindow();
  try {
    await loadPreviewDocument(window, html);
    const background = await getPageBackground(window);
    return captureMode === "fullDocument"
      ? captureFullDocument(window, format, background)
      : captureViewport(window, format, background);
  } finally {
    if (!window.isDestroyed()) {
      window.close();
    }
  }
}

export async function exportPdf(parent: BrowserWindow | undefined, payload: ExportPdfPayload): Promise<boolean> {
  if (!payload || typeof payload.previewDocumentHtml !== "string") {
    return false;
  }

  const options: SaveDialogOptions = {
    title: "PDF 저장",
    defaultPath: payload.defaultName || "preview.pdf",
    filters: [
      { name: "PDF", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return false;
  }

  const window = await createExportWindow();
  try {
    await loadPreviewDocument(window, payload.previewDocumentHtml);
    const pdf = await window.webContents.printToPDF({
      pageSize: "A4",
      landscape: false,
      printBackground: true,
      margins: {
        top: 0.47,
        right: 0.47,
        bottom: 0.47,
        left: 0.47
      }
    });
    await writeFile(result.filePath, pdf);
    return true;
  } finally {
    if (!window.isDestroyed()) {
      window.close();
    }
  }
}

export async function exportImage(parent: BrowserWindow | undefined, payload: ExportImagePayload): Promise<boolean> {
  if (!payload || typeof payload.previewDocumentHtml !== "string") {
    return false;
  }

  const extension = payload.format === "jpg" ? "jpg" : "png";
  const options: SaveDialogOptions = {
    title: `${extension.toUpperCase()} 저장`,
    defaultPath: payload.defaultName || `preview.${extension}`,
    filters: [
      { name: extension.toUpperCase(), extensions: [extension] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return false;
  }

  let image: Buffer;
  try {
    image = await captureDocument(payload.previewDocumentHtml, extension, payload.captureMode);
  } catch (error) {
    if (!(error instanceof FullDocumentTooTallError) || payload.captureMode !== "fullDocument") {
      throw error;
    }

    const messageOptions = {
      type: "warning" as const,
      title: "전체 문서 캡처 제한",
      message: "문서가 너무 길어 현재 화면만 저장합니다.",
      detail: `전체 문서 높이가 ${error.height.toLocaleString()}px라 안정적인 이미지 병합 한도를 넘었습니다.`
    };
    if (parent) {
      await dialog.showMessageBox(parent, messageOptions);
    } else {
      await dialog.showMessageBox(messageOptions);
    }
    image = await captureDocument(payload.previewDocumentHtml, extension, "viewport");
  }

  await writeFile(result.filePath, image);
  return true;
}
