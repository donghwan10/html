import { app, BrowserWindow, ipcMain, protocol, session } from "electron";
import { join } from "node:path";
import type { PreviewZoomCommand } from "../shared/types";
import { copyHtml } from "./clipboardService";
import { exportImage, exportPdf } from "./exportService";
import { chooseLocalImage, openInBrowser, openSourceFile, saveHtml } from "./fileService";
import {
  handlePreviewProtocol,
  registerPreviewDocumentHtml,
  revokePreviewDocumentHtml
} from "./previewProtocolService";

let mainWindow: BrowserWindow | null = null;

const previewZoomChannel = "previewer:preview-zoom-command";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "preview",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

function sendPreviewZoomCommand(window: BrowserWindow, command: PreviewZoomCommand): void {
  if (!window.webContents.isDestroyed()) {
    window.webContents.send(previewZoomChannel, command);
  }
}

function registerPreviewZoomShortcuts(window: BrowserWindow): void {
  window.webContents.on("before-input-event", (event, input) => {
    const isControlKey = input.key === "Control" || input.code === "ControlLeft" || input.code === "ControlRight";

    if (isControlKey) {
      sendPreviewZoomCommand(window, input.type === "keyUp" ? "control-up" : "control-down");
      return;
    }

    const isCtrlOnly = input.control && !input.alt && !input.meta;
    const isZoomIn = input.key === "=" || input.key === "+" || input.code === "Equal" || input.code === "NumpadAdd";
    const isZoomOut = input.key === "-" || input.key === "_" || input.code === "Minus" || input.code === "NumpadSubtract";
    const isZoomReset = input.key === "0" || input.code === "Digit0" || input.code === "Numpad0";

    if (!isCtrlOnly || (!isZoomIn && !isZoomOut && !isZoomReset)) {
      return;
    }

    event.preventDefault();

    if (input.type !== "keyDown") {
      return;
    }

    if (isZoomIn) {
      sendPreviewZoomCommand(window, "zoom-in");
      return;
    }

    if (isZoomOut) {
      sendPreviewZoomCommand(window, "zoom-out");
      return;
    }

    sendPreviewZoomCommand(window, "zoom-reset");
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 720,
    title: "LLM HTML Previewer",
    backgroundColor: "#f5f6f8",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  registerPreviewZoomShortcuts(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    const targetUrl = event.url;
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    const allowed = devUrl ? targetUrl.startsWith(new URL(devUrl).origin) : targetUrl.startsWith("file://");
    if (!allowed) {
      event.preventDefault();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle("previewer:open-source-file", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    return openSourceFile(parent ?? undefined);
  });

  ipcMain.handle("previewer:choose-local-image", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    return chooseLocalImage(parent ?? undefined);
  });

  ipcMain.handle("previewer:save-html", async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    return saveHtml(parent ?? undefined, payload);
  });

  ipcMain.handle("previewer:export-pdf", async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    return exportPdf(parent ?? undefined, payload);
  });

  ipcMain.handle("previewer:export-image", async (event, payload) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    return exportImage(parent ?? undefined, payload);
  });

  ipcMain.handle("previewer:copy-html", async (_event, payload) => copyHtml(payload));

  ipcMain.handle("previewer:register-preview-document", async (_event, payload) => {
    if (!payload || typeof payload.html !== "string") {
      return null;
    }
    return registerPreviewDocumentHtml(payload.html, payload.mode);
  });

  ipcMain.handle("previewer:revoke-preview-document", async (_event, id) => {
    if (typeof id === "string") {
      revokePreviewDocumentHtml(id);
    }
  });

  ipcMain.handle("previewer:open-in-browser", async (_event, payload) => openInBrowser(payload));
}

app.whenReady().then(() => {
  protocol.handle("preview", handlePreviewProtocol);

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
