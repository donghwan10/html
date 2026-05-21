import type { PreviewSettings } from "../../shared/types";
import { getPreviewSecurityProfile } from "./previewSecurity";
import { getCustomThemeColors } from "./themeBrightness";

interface BuildPreviewDocumentOptions {
  contentHtml: string;
  settings: PreviewSettings;
  title?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeCssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replace(/[\r\n]/g, " ");
}

function clampNumber(value: number, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function safeTextAlign(value: PreviewSettings["textAlign"]): PreviewSettings["textAlign"] {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function themeClass(themeMode: PreviewSettings["themeMode"]): string {
  if (themeMode === "custom") {
    return "theme-custom";
  }
  return themeMode === "dark" ? "theme-dark" : themeMode === "light" ? "theme-light" : "theme-system";
}

export function getPreviewCsp(settings: Pick<PreviewSettings, "allowRemoteImages">): string {
  return getPreviewSecurityProfile("safe-reader", settings).csp;
}

export function buildPreviewDocument({
  contentHtml,
  settings,
  title = "Preview"
}: BuildPreviewDocumentOptions): string {
  const csp = getPreviewCsp(settings);
  const fontFamily = escapeCssString(settings.fontFamily);
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(settings.backgroundColor)
    ? settings.backgroundColor
    : "#f4f6f8";
  const textColor = /^#[0-9a-f]{6}$/i.test(settings.textColor) ? settings.textColor : null;
  const customTheme = getCustomThemeColors(settings.customBrightness);
  const documentClasses = [
    themeClass(settings.themeMode),
    settings.highContrast ? "contrast-high" : "",
    settings.koreanLineBreak ? "korean-line-break" : "",
    settings.codeWrap ? "code-wrap" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const fontWeight = clampNumber(settings.fontWeight, 400, 300, 800);
  const letterSpacing = clampNumber(settings.letterSpacing, 0, 0, 2);
  const wordSpacing = clampNumber(settings.wordSpacing, 0, 0, 8);
  const paragraphSpacing = clampNumber(settings.paragraphSpacing, 1, 0.5, 2.5);
  const paragraphIndent = clampNumber(settings.paragraphIndent, 0, 0, 3);
  const headingScale = clampNumber(settings.headingScale, 1, 0.8, 1.4);
  const contentPadding = clampNumber(settings.contentPadding, 46, 18, 72);

  return `<!doctype html>
<html lang="ko" class="${documentClasses}">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --reader-bg: ${backgroundColor};
        --reader-page: #ffffff;
        --reader-text: #1e2228;
        --reader-muted: #646b75;
        --reader-border: #d7dbe2;
        --reader-code-bg: #f2f4f7;
        --reader-link: #0b63ce;
        --reader-font: "${fontFamily}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --reader-size: ${settings.fontSize}px;
        --reader-width: ${settings.maxWidth}px;
        --reader-padding: ${contentPadding}px;
        --reader-line: ${settings.lineHeight};
        --reader-weight: ${fontWeight};
        --reader-letter: ${letterSpacing}px;
        --reader-word: ${wordSpacing}px;
        --reader-paragraph-spacing: ${paragraphSpacing}em;
        --reader-indent: ${paragraphIndent}em;
        --reader-align: ${safeTextAlign(settings.textAlign)};
        --reader-heading-scale: ${headingScale};
      }

      html.theme-dark {
        color-scheme: dark;
        --reader-bg: #111317;
        --reader-page: #171a20;
        --reader-text: #e9edf3;
        --reader-muted: #a8b0bd;
        --reader-border: #303642;
        --reader-code-bg: #222732;
        --reader-link: #7ab7ff;
      }

      html.theme-custom {
        color-scheme: ${customTheme.colorScheme};
        --reader-bg: ${customTheme.readerBg};
        --reader-page: ${customTheme.readerPage};
        --reader-text: ${customTheme.readerText};
        --reader-muted: ${customTheme.readerMuted};
        --reader-border: ${customTheme.readerBorder};
        --reader-code-bg: ${customTheme.readerCodeBg};
        --reader-link: ${customTheme.readerLink};
      }

      @media (prefers-color-scheme: dark) {
        html.theme-system {
          color-scheme: dark;
          --reader-bg: #111317;
          --reader-page: #171a20;
          --reader-text: #e9edf3;
          --reader-muted: #a8b0bd;
          --reader-border: #303642;
          --reader-code-bg: #222732;
          --reader-link: #7ab7ff;
        }
      }

      ${
        textColor
          ? `html {
        --reader-text: ${textColor};
      }`
          : ""
      }

      html.contrast-high {
        color-scheme: dark;
        --reader-bg: #000000;
        --reader-page: #000000;
        --reader-text: #ffffff;
        --reader-muted: #f2f2f2;
        --reader-border: #ffffff;
        --reader-code-bg: #111111;
        --reader-link: #ffea00;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background: var(--reader-bg);
        color: var(--reader-text);
        font-family: var(--reader-font);
        font-size: var(--reader-size);
        line-height: var(--reader-line);
      }

      body {
        padding: 32px 18px;
      }

      .reader-shell {
        width: min(100%, var(--reader-width));
        margin: 0 auto;
        background: var(--reader-page);
        border: 1px solid var(--reader-border);
        padding: var(--reader-padding);
        min-height: calc(100vh - 64px);
        font-weight: var(--reader-weight);
        letter-spacing: var(--reader-letter);
        word-spacing: var(--reader-word);
        text-align: var(--reader-align);
      }

      h1, h2, h3, h4, h5, h6 {
        line-height: 1.24;
        margin: 1.35em 0 0.55em;
        letter-spacing: 0;
        font-weight: 700;
      }

      h1 {
        font-size: calc(var(--reader-size) * 2 * var(--reader-heading-scale));
      }

      h2 {
        font-size: calc(var(--reader-size) * 1.65 * var(--reader-heading-scale));
      }

      h3 {
        font-size: calc(var(--reader-size) * 1.35 * var(--reader-heading-scale));
      }

      h4 {
        font-size: calc(var(--reader-size) * 1.18 * var(--reader-heading-scale));
      }

      h5,
      h6 {
        font-size: calc(var(--reader-size) * 1.05 * var(--reader-heading-scale));
      }

      h1:first-child,
      h2:first-child,
      h3:first-child {
        margin-top: 0;
      }

      p,
      ul,
      ol,
      blockquote,
      table,
      pre {
        margin-top: 0;
        margin-bottom: 1em;
      }

      p {
        margin-bottom: var(--reader-paragraph-spacing);
        text-indent: var(--reader-indent);
      }

      a {
        color: var(--reader-link);
      }

      img,
      video,
      canvas,
      svg {
        max-width: 100%;
        height: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        display: block;
        overflow-x: auto;
      }

      th,
      td {
        border: 1px solid var(--reader-border);
        padding: 0.58em 0.72em;
        vertical-align: top;
      }

      th {
        background: color-mix(in srgb, var(--reader-code-bg) 80%, transparent);
        text-align: left;
      }

      blockquote {
        border-left: 4px solid var(--reader-border);
        color: var(--reader-muted);
        padding-left: 1em;
        margin-left: 0;
      }

      code,
      pre {
        font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
        font-weight: 400;
        letter-spacing: 0;
        word-spacing: 0;
      }

      code {
        background: var(--reader-code-bg);
        border-radius: 4px;
        padding: 0.12em 0.32em;
      }

      pre {
        background: var(--reader-code-bg);
        border: 1px solid var(--reader-border);
        overflow-x: auto;
        padding: 1em;
        text-align: left;
        white-space: pre;
      }

      pre code {
        background: transparent;
        padding: 0;
        white-space: inherit;
      }

      html.code-wrap pre {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      html.korean-line-break .reader-shell {
        word-break: keep-all;
        overflow-wrap: break-word;
        line-break: strict;
      }

      html.korean-line-break code,
      html.korean-line-break pre {
        word-break: normal;
        overflow-wrap: normal;
        line-break: auto;
      }

      html.contrast-high .reader-shell {
        border-width: 2px;
      }

      html.contrast-high a {
        text-decoration-thickness: 0.12em;
        text-underline-offset: 0.18em;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--reader-border);
        margin: 2em 0;
      }

      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }

        .reader-shell {
          border: 0;
          min-height: 0;
          width: 100%;
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="reader-shell">${contentHtml}</main>
  </body>
</html>`;
}
