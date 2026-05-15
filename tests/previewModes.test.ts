import { describe, expect, it } from "vitest";
import { createPreviewPipeline } from "../src/renderer/lib/previewPipeline";
import { getPreviewSecurityProfile } from "../src/renderer/lib/previewSecurity";
import { defaultPreviewSettings } from "../src/renderer/lib/settingsStore";

describe("preview security profiles", () => {
  it("builds separate CSP profiles by mode", () => {
    const safe = getPreviewSecurityProfile("safe-reader", defaultPreviewSettings);
    const original = getPreviewSecurityProfile("original-document", defaultPreviewSettings);
    const trusted = getPreviewSecurityProfile("trusted-interactive", defaultPreviewSettings);

    expect(safe.csp).toContain("script-src 'none'");
    expect(safe.csp).toContain("img-src data:");
    expect(original.csp).toContain("media-src data: blob:");
    expect(original.csp).toContain("script-src 'none'");
    expect(trusted.csp).toContain("script-src 'unsafe-inline' data: blob:");
    expect(trusted.csp).toContain("worker-src blob:");
    expect(trusted.csp).toContain("connect-src 'none'");
  });

  it("builds separate sandbox policies by mode", () => {
    const safe = getPreviewSecurityProfile("safe-reader", defaultPreviewSettings);
    const original = getPreviewSecurityProfile("original-document", defaultPreviewSettings);
    const trusted = getPreviewSecurityProfile("trusted-interactive", defaultPreviewSettings);

    expect(safe.sandbox).toBe("allow-same-origin");
    expect(original.sandbox).toBe("allow-same-origin");
    expect(trusted.sandbox).toContain("allow-scripts");
    expect(trusted.sandbox).toContain("allow-forms");
    expect(trusted.sandbox).toContain("allow-same-origin");
  });
});

describe("preview modes", () => {
  it("keeps Safe Reader as the sanitized reader wrapper", () => {
    const result = createPreviewPipeline(
      `<form><button onclick="alert(1)">x</button></form><script>alert(1)</script>`,
      "html",
      { ...defaultPreviewSettings, previewMode: "safe-reader" },
      "Safe"
    );

    expect(result.previewHtml).toContain("reader-shell");
    expect(result.sanitizedHtml).not.toContain("<form");
    expect(result.sanitizedHtml).not.toContain("<script");
  });

  it("preserves full original document structure without wrapping it as Reader", () => {
    const result = createPreviewPipeline(
      `<!doctype html><html><head><style>.ok{color:red}</style><script>alert(1)</script></head>
       <body><svg><circle cx="4" cy="4" r="4"></circle></svg><canvas id="c"></canvas>
       <form action="https://example.com"><input name="x"><button onclick="alert(1)">go</button></form>
       <video controls src="data:video/mp4;base64,AAAA"></video>
       <a href="javascript:alert(1)">bad</a></body></html>`,
      "html",
      { ...defaultPreviewSettings, previewMode: "original-document" },
      "Original"
    );

    expect(result.previewHtml).toContain("<!doctype html>");
    expect(result.previewHtml).toContain("Content-Security-Policy");
    expect(result.previewHtml).not.toContain("reader-shell");
    expect(result.sanitizedHtml).toContain("<style>");
    expect(result.sanitizedHtml).toContain("<svg");
    expect(result.sanitizedHtml).toContain("<canvas");
    expect(result.sanitizedHtml).toContain("<form");
    expect(result.sanitizedHtml).toContain("<video");
    expect(result.sanitizedHtml).not.toContain("<script");
    expect(result.sanitizedHtml).not.toContain("onclick");
    expect(result.sanitizedHtml).not.toContain("javascript:");
    expect(result.sanitizedHtml).not.toContain("https://example.com");
  });

  it("keeps trusted scripts but still injects the offline CSP", () => {
    const result = createPreviewPipeline(
      `<!doctype html><html><head></head><body><script>window.ok = true;</script></body></html>`,
      "html",
      {
        ...defaultPreviewSettings,
        previewMode: "trusted-interactive",
        themeMode: "system",
        interactiveConfirmed: true
      },
      "Trusted"
    );

    expect(result.previewHtml).toContain("<script>window.ok = true;</script>");
    expect(result.previewHtml).toContain("script-src 'unsafe-inline' data: blob:");
    expect(result.previewHtml).toContain('data-preview-theme="system"');
    expect(result.previewHtml).toContain("data-preview-theme-style");
    expect(result.sandbox).toContain("allow-scripts");
  });

  it("injects conservative dark theme defaults into Original documents before source styles", () => {
    const result = createPreviewPipeline(
      `<!doctype html><html><head><style>body{background:red}</style></head><body><p>Original</p></body></html>`,
      "html",
      { ...defaultPreviewSettings, previewMode: "original-document", themeMode: "dark" },
      "Original"
    );

    expect(result.previewHtml).toContain('data-preview-theme="dark"');
    expect(result.previewHtml).toContain("color-scheme: dark");
    expect(result.previewHtml.indexOf("data-preview-theme-style")).toBeLessThan(
      result.previewHtml.indexOf("body{background:red}")
    );
  });

  it("injects custom brightness theme defaults into Trusted documents", () => {
    const result = createPreviewPipeline(
      `<!doctype html><html><head></head><body><script>window.ok = true;</script></body></html>`,
      "html",
      {
        ...defaultPreviewSettings,
        previewMode: "trusted-interactive",
        themeMode: "custom",
        customBrightness: 25,
        interactiveConfirmed: true
      },
      "Trusted Custom"
    );

    expect(result.previewHtml).toContain("<script>window.ok = true;</script>");
    expect(result.previewHtml).toContain('data-preview-theme="custom"');
    expect(result.previewHtml).toContain("color-scheme: dark");
  });
});
