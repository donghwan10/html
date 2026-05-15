import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  CopyHtmlPayload,
  ExportImagePayload,
  ExportPdfPayload,
  OpenInBrowserPayload,
  PreviewDocumentRegistrationPayload,
  PreviewZoomCommand,
  SaveHtmlPayload
} from "../shared/types";

const previewZoomChannel = "previewer:preview-zoom-command";

contextBridge.exposeInMainWorld("previewerApi", {
  openSourceFile: () => ipcRenderer.invoke("previewer:open-source-file"),
  chooseLocalImage: () => ipcRenderer.invoke("previewer:choose-local-image"),
  saveHtml: (payload: SaveHtmlPayload) => ipcRenderer.invoke("previewer:save-html", payload),
  exportPdf: (payload: ExportPdfPayload) => ipcRenderer.invoke("previewer:export-pdf", payload),
  exportImage: (payload: ExportImagePayload) => ipcRenderer.invoke("previewer:export-image", payload),
  copyHtml: (payload: CopyHtmlPayload) => ipcRenderer.invoke("previewer:copy-html", payload),
  registerPreviewDocument: (payload: PreviewDocumentRegistrationPayload) =>
    ipcRenderer.invoke("previewer:register-preview-document", payload),
  revokePreviewDocument: (id: string) => ipcRenderer.invoke("previewer:revoke-preview-document", id),
  openInBrowser: (payload: OpenInBrowserPayload) => ipcRenderer.invoke("previewer:open-in-browser", payload),
  onPreviewZoomCommand: (callback: (command: PreviewZoomCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: PreviewZoomCommand): void => callback(command);
    ipcRenderer.on(previewZoomChannel, listener);
    return () => ipcRenderer.removeListener(previewZoomChannel, listener);
  }
});
