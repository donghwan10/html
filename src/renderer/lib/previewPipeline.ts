import type { InputMode, PreviewRenderResult, PreviewSettings, ResolvedInputMode } from "../../shared/types";
import { buildPreviewDocument } from "./buildPreviewDocument";
import {
  buildBrowserOpenDocument,
  buildOriginalPreviewDocument,
  injectCspIntoDocument,
  sanitizeOriginalDocument
} from "./documentPreview";
import { markdownToHtml } from "./markdownToHtml";
import { normalizeInput, resolveInputMode } from "./normalizeInput";
import { getPreviewSecurityProfile } from "./previewSecurity";
import { sanitizeHtml } from "./sanitizeHtml";

export interface PreviewPipelineResult extends PreviewRenderResult {
  normalizedInput: string;
  resolvedMode: ResolvedInputMode;
  previewDocumentHtml: string;
  browserOpenHtml: string;
}

export function createPreviewPipeline(
  input: string,
  inputMode: InputMode,
  settings: PreviewSettings,
  title?: string
): PreviewPipelineResult {
  const normalizedInput = normalizeInput(input);
  const resolvedMode = resolveInputMode(normalizedInput, inputMode);
  const sourceHtml = resolvedMode === "markdown" ? markdownToHtml(normalizedInput) : normalizedInput;
  const security = getPreviewSecurityProfile(settings.previewMode, settings);
  let sanitizedHtml: string;
  let previewDocumentHtml: string;

  if (settings.previewMode === "trusted-interactive") {
    sanitizedHtml = sourceHtml;
    previewDocumentHtml = injectCspIntoDocument(
      sourceHtml,
      security.csp,
      title,
      settings.themeMode,
      settings.customBrightness
    );
  } else if (settings.previewMode === "original-document") {
    sanitizedHtml = sanitizeOriginalDocument(sourceHtml, {
      allowDataAndBlobResources: settings.allowDataAndBlobResources
    });
    previewDocumentHtml = buildOriginalPreviewDocument(
      sanitizedHtml,
      security.csp,
      title,
      settings.themeMode,
      settings.customBrightness
    );
  } else {
    sanitizedHtml = sanitizeHtml(sourceHtml, {
      allowRemoteImages: settings.allowRemoteImages
    });
    previewDocumentHtml = buildPreviewDocument({
      contentHtml: sanitizedHtml,
      settings,
      title
    });
  }

  return {
    mode: settings.previewMode,
    normalizedInput,
    resolvedMode,
    resolvedInputMode: resolvedMode,
    sourceHtml,
    sanitizedHtml,
    previewHtml: previewDocumentHtml,
    previewDocumentHtml,
    browserOpenHtml: buildBrowserOpenDocument(sourceHtml, previewDocumentHtml, title),
    csp: security.csp,
    sandbox: security.sandbox
  };
}

export function htmlToPlainText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}
