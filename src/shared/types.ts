export type InputMode = "auto" | "html" | "markdown";

export type ResolvedInputMode = "html" | "markdown";

export type ThemeMode = "system" | "light" | "dark" | "custom";

export type PreviewMode = "safe-reader" | "original-document" | "trusted-interactive";

export type ExportImageFormat = "png" | "jpg";

export type CaptureMode = "viewport" | "fullDocument";

export type PreviewZoomCommand = "zoom-in" | "zoom-out" | "zoom-reset" | "control-down" | "control-up";

export type TextAlign = "left" | "center" | "right" | "justify";

export interface PreviewSecurityProfile {
  mode: PreviewMode;
  csp: string;
  sandbox: string;
}

export interface PreviewSettings {
  themeMode: ThemeMode;
  customBrightness: number;
  fontFamily: string;
  fontSize: number;
  maxWidth: number;
  contentPadding: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
  paragraphIndent: number;
  textAlign: TextAlign;
  textColor: string;
  headingScale: number;
  codeWrap: boolean;
  highContrast: boolean;
  koreanLineBreak: boolean;
  backgroundColor: string;
  allowRemoteImages: boolean;
  previewMode: PreviewMode;
  doubleMode: boolean;
  allowDataAndBlobResources: boolean;
  interactiveConfirmed: boolean;
}

export interface PreviewRenderResult {
  mode: PreviewMode;
  resolvedInputMode: ResolvedInputMode;
  sourceHtml: string;
  sanitizedHtml: string;
  previewHtml: string;
  previewUrl?: string;
  csp: string;
  sandbox: string;
}

export interface OpenSourceFileResult {
  path: string;
  name: string;
  content: string;
  suggestedMode: InputMode;
}

export interface LocalImageResult {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export interface SaveHtmlPayload {
  html: string;
  defaultName: string;
}

export interface ExportPdfPayload {
  previewDocumentHtml: string;
  previewMode: PreviewMode;
  defaultName: string;
}

export interface ExportImagePayload {
  previewDocumentHtml: string;
  previewMode: PreviewMode;
  format: ExportImageFormat;
  captureMode: CaptureMode;
  defaultName: string;
}

export interface CopyHtmlPayload {
  html: string;
  text: string;
}

export interface PreviewDocumentRegistrationPayload {
  html: string;
  mode: PreviewMode;
}

export interface PreviewDocumentRegistrationResult {
  id: string;
  url: string;
}

export interface OpenInBrowserPayload {
  html: string;
  defaultName: string;
}
