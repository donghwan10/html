import type {
  CopyHtmlPayload,
  ExportImagePayload,
  ExportPdfPayload,
  LocalImageResult,
  OpenInBrowserPayload,
  OpenSourceFileResult,
  PreviewDocumentRegistrationPayload,
  PreviewDocumentRegistrationResult,
  PreviewZoomCommand,
  SaveHtmlPayload
} from "../../shared/types";

declare global {
  interface Window {
    previewerApi: {
      openSourceFile: () => Promise<OpenSourceFileResult | null>;
      chooseLocalImage: () => Promise<LocalImageResult | null>;
      saveHtml: (payload: SaveHtmlPayload) => Promise<boolean>;
      exportPdf: (payload: ExportPdfPayload) => Promise<boolean>;
      exportImage: (payload: ExportImagePayload) => Promise<boolean>;
      copyHtml: (payload: CopyHtmlPayload) => Promise<boolean>;
      registerPreviewDocument: (
        payload: PreviewDocumentRegistrationPayload
      ) => Promise<PreviewDocumentRegistrationResult | null>;
      revokePreviewDocument: (id: string) => Promise<void>;
      openInBrowser: (payload: OpenInBrowserPayload) => Promise<boolean>;
      onPreviewZoomCommand: (callback: (command: PreviewZoomCommand) => void) => () => void;
    };
  }
}

export {};
