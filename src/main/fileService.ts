import { BrowserWindow, dialog, shell } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import type {
  InputMode,
  LocalImageResult,
  OpenInBrowserPayload,
  OpenSourceFileResult,
  SaveHtmlPayload
} from "../shared/types";

const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"]
]);

export async function openSourceFile(parent?: BrowserWindow): Promise<OpenSourceFileResult | null> {
  const options: OpenDialogOptions = {
    title: "HTML 또는 Markdown 열기",
    properties: ["openFile"],
    filters: [
      { name: "HTML and Markdown", extensions: ["html", "htm", "md", "markdown", "txt"] },
      { name: "HTML", extensions: ["html", "htm"] },
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const path = result.filePaths[0];
  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  const suggestedMode: InputMode = extension === ".md" || extension === ".markdown" ? "markdown" : "auto";

  return {
    path,
    name: basename(path),
    content,
    suggestedMode
  };
}

export async function chooseLocalImage(parent?: BrowserWindow): Promise<LocalImageResult | null> {
  const options: OpenDialogOptions = {
    title: "로컬 이미지 삽입",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const path = result.filePaths[0];
  const extension = extname(path).toLowerCase();
  const mimeType = imageMimeByExtension.get(extension) ?? "application/octet-stream";
  const bytes = await readFile(path);

  return {
    fileName: basename(path),
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`
  };
}

export async function saveHtml(parent: BrowserWindow | undefined, payload: SaveHtmlPayload): Promise<boolean> {
  if (!payload || typeof payload.html !== "string") {
    return false;
  }

  const options: SaveDialogOptions = {
    title: "HTML 저장",
    defaultPath: payload.defaultName || "preview.html",
    filters: [
      { name: "HTML", extensions: ["html"] },
      { name: "All Files", extensions: ["*"] }
    ]
  };
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return false;
  }

  await writeFile(result.filePath, payload.html, "utf8");
  return true;
}

function safeTempName(name: string): string {
  const base = basename(name || "preview.html")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "preview"}-${Date.now()}.html`;
}

export async function openInBrowser(payload: OpenInBrowserPayload): Promise<boolean> {
  if (!payload || typeof payload.html !== "string") {
    return false;
  }

  const dir = join(tmpdir(), "llm-html-previewer");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, safeTempName(payload.defaultName));
  await writeFile(filePath, payload.html, "utf8");
  const error = await shell.openPath(filePath);
  return error.length === 0;
}
