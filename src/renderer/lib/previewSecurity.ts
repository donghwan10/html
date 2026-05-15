import type { PreviewMode, PreviewSecurityProfile, PreviewSettings } from "../../shared/types";

function joinCsp(directives: string[]): string {
  return directives.join("; ");
}

function safeImageSource(settings: Pick<PreviewSettings, "allowRemoteImages">): string {
  return settings.allowRemoteImages ? "img-src data: https:" : "img-src data:";
}

export function getPreviewSecurityProfile(
  mode: PreviewMode,
  settings: Pick<PreviewSettings, "allowRemoteImages"> &
    Partial<Pick<PreviewSettings, "allowDataAndBlobResources">>
): PreviewSecurityProfile {
  if (mode === "trusted-interactive") {
    const resourceSources = settings.allowDataAndBlobResources === false ? "data:" : "data: blob:";
    return {
      mode,
      csp: joinCsp([
        "default-src 'none'",
        "script-src 'unsafe-inline' data: blob:",
        "connect-src 'none'",
        "frame-src data: blob: preview:",
        "child-src data: blob: preview:",
        "worker-src blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "style-src 'unsafe-inline'",
        `img-src ${resourceSources}`,
        `media-src ${resourceSources}`,
        "font-src data:",
        "manifest-src data:"
      ]),
      sandbox: "allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-same-origin"
    };
  }

  if (mode === "original-document") {
    const resourceSources = settings.allowDataAndBlobResources === false ? "data:" : "data: blob:";
    return {
      mode,
      csp: joinCsp([
        "default-src 'none'",
        "script-src 'none'",
        "connect-src 'none'",
        "frame-src 'none'",
        "child-src 'none'",
        "worker-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "style-src 'unsafe-inline'",
        `img-src ${resourceSources}`,
        `media-src ${resourceSources}`,
        "font-src data:",
        "manifest-src data:"
      ]),
      sandbox: "allow-same-origin"
    };
  }

  return {
    mode,
    csp: joinCsp([
      "default-src 'none'",
      "script-src 'none'",
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "style-src 'unsafe-inline'",
      safeImageSource(settings)
    ]),
    sandbox: "allow-same-origin"
  };
}
