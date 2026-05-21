import type { PreviewMode, ThemeMode } from "../../shared/types";

interface DoublePreviewDocumentItem {
  html: string;
  label: string;
}

interface BuildDoublePreviewDocumentOptions {
  items: [DoublePreviewDocumentItem, DoublePreviewDocumentItem];
  title: string;
  themeMode: ThemeMode;
  previewMode: PreviewMode;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

export function buildDoublePreviewDocument({
  items,
  title,
  themeMode,
  previewMode
}: BuildDoublePreviewDocumentOptions): string {
  return `<!doctype html>
<html lang="ko" data-double-preview-theme="${escapeAttribute(themeMode)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --double-bg: #eef1f5;
        --double-panel: #ffffff;
        --double-border: #d8dee8;
        --double-text: #1f252d;
        --double-muted: #687180;
      }

      html[data-double-preview-theme="dark"] {
        color-scheme: dark;
        --double-bg: #11151b;
        --double-panel: #181d25;
        --double-border: #303846;
        --double-text: #ebeff5;
        --double-muted: #a3adbb;
      }

      @media (prefers-color-scheme: dark) {
        html[data-double-preview-theme="system"] {
          color-scheme: dark;
          --double-bg: #11151b;
          --double-panel: #181d25;
          --double-border: #303846;
          --double-text: #ebeff5;
          --double-muted: #a3adbb;
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--double-bg);
        color: var(--double-text);
        font-family: "Segoe UI", "Malgun Gothic", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .double-preview-export {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        min-height: 100vh;
        padding: 12px;
      }

      .double-preview-export__pane {
        min-width: 0;
        background: var(--double-panel);
        border: 1px solid var(--double-border);
      }

      .double-preview-export__label {
        height: 34px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--double-border);
        color: var(--double-muted);
        font-size: 12px;
        line-height: 1.2;
      }

      iframe {
        display: block;
        width: 100%;
        min-height: calc(100vh - 58px);
        border: 0;
        background: #ffffff;
      }
    </style>
  </head>
  <body data-preview-mode="${escapeAttribute(previewMode)}">
    <main class="double-preview-export">
      ${items
        .map(
          (item) => `<section class="double-preview-export__pane">
        <div class="double-preview-export__label">${escapeHtml(item.label)}</div>
        <iframe sandbox="allow-same-origin" srcdoc="${escapeAttribute(item.html)}"></iframe>
      </section>`
        )
        .join("\n      ")}
    </main>
    <script>
      const resizeFrames = () => {
        document.querySelectorAll("iframe").forEach((frame) => {
          try {
            const doc = frame.contentDocument;
            if (!doc) return;
            const root = doc.documentElement;
            const body = doc.body || root;
            const height = Math.max(root.scrollHeight, body.scrollHeight, root.offsetHeight, body.offsetHeight);
            frame.style.height = Math.max(height, window.innerHeight - 58) + "px";
          } catch {
          }
        });
      };

      window.addEventListener("load", () => {
        resizeFrames();
        window.setTimeout(resizeFrames, 120);
        window.setTimeout(resizeFrames, 500);
      });
      window.addEventListener("resize", resizeFrames);
    </script>
  </body>
</html>`;
}

export function buildDoubleContentDocument(
  items: [DoublePreviewDocumentItem, DoublePreviewDocumentItem],
  title: string
): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
      ${items
        .map(
          (item) => `<section>
        <h1>${escapeHtml(item.label)}</h1>
        ${item.html}
      </section>`
        )
        .join("\n      ")}
    </main>
  </body>
</html>`;
}
