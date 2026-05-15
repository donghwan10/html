import type { ThemeMode } from "../../shared/types";
import { getCustomThemeColors } from "./themeBrightness";

interface OriginalSanitizeOptions {
  allowDataAndBlobResources: boolean;
}

const fullDocumentPattern = /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i;
const dangerousOriginalTags = ["script", "iframe", "object", "embed", "base"];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function removeRemoteCssReferences(css: string): string {
  return css
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\(\s*(['"])(?:https?:|file:|javascript:)[\s\S]*?\1\s*\)/gi, "url()")
    .replace(/url\(\s*(?:https?:|file:|javascript:)[^)]+\)/gi, "url()");
}

function isLocalNavigation(value: string): boolean {
  return value.trim().startsWith("#");
}

function isSafeResourceUrl(value: string, allowBlob: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed || isLocalNavigation(trimmed)) {
    return true;
  }
  if (/^data:/i.test(trimmed)) {
    return true;
  }
  if (allowBlob && /^blob:/i.test(trimmed)) {
    return true;
  }
  return false;
}

function filterSrcset(srcset: string, allowBlob: boolean): string {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => {
      const [url] = candidate.split(/\s+/, 1);
      return Boolean(url && isSafeResourceUrl(url, allowBlob));
    })
    .join(", ");
}

function sanitizeAttributes(element: Element, options: OriginalSanitizeOptions): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (/^\s*javascript:/i.test(value)) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "style") {
      element.setAttribute(attribute.name, removeRemoteCssReferences(value));
      continue;
    }

    if (name === "srcset") {
      const filtered = filterSrcset(value, options.allowDataAndBlobResources);
      if (filtered) {
        element.setAttribute(attribute.name, filtered);
      } else {
        element.removeAttribute(attribute.name);
      }
      continue;
    }

    if (
      name === "src" ||
      name === "href" ||
      name === "poster" ||
      name === "xlink:href" ||
      name === "action" ||
      name === "formaction"
    ) {
      if (!isSafeResourceUrl(value, options.allowDataAndBlobResources)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function sanitizeTree(root: ParentNode, options: OriginalSanitizeOptions): void {
  root.querySelectorAll(dangerousOriginalTags.join(",")).forEach((element) => element.remove());

  root.querySelectorAll("link").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!isSafeResourceUrl(href, options.allowDataAndBlobResources)) {
      link.remove();
    }
  });

  root.querySelectorAll("style").forEach((style) => {
    style.textContent = removeRemoteCssReferences(style.textContent ?? "");
  });

  root.querySelectorAll("*").forEach((element) => {
    sanitizeAttributes(element, options);
    if (element instanceof HTMLTemplateElement) {
      sanitizeTree(element.content, options);
    }
  });
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function cspMeta(csp: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`;
}

function themeAttribute(themeMode?: ThemeMode): string {
  return themeMode ? ` data-preview-theme="${themeMode}"` : "";
}

function withThemeAttribute(html: string, themeMode?: ThemeMode): string {
  if (!themeMode) {
    return html;
  }

  return html.replace(/<html\b([^>]*)>/i, (_match, attributes: string) => {
    const cleanedAttributes = attributes.replace(/\sdata-preview-theme=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
    return `<html${cleanedAttributes} data-preview-theme="${themeMode}">`;
  });
}

function previewThemeStyle(themeMode?: ThemeMode, customBrightness = 50): string {
  if (!themeMode) {
    return "";
  }
  const customTheme = getCustomThemeColors(customBrightness);

  return `<style data-preview-theme-style>
      :root {
        color-scheme: light;
        background: #ffffff;
        color: #1e2228;
      }

      body {
        background: #ffffff;
        color: #1e2228;
      }

      html[data-preview-theme="dark"] {
        color-scheme: dark;
        background: #111317;
        color: #e9edf3;
      }

      html[data-preview-theme="dark"] body {
        background: #111317;
        color: #e9edf3;
      }

      html[data-preview-theme="custom"] {
        color-scheme: ${customTheme.colorScheme};
        background: ${customTheme.readerBg};
        color: ${customTheme.readerText};
      }

      html[data-preview-theme="custom"] body {
        background: ${customTheme.readerBg};
        color: ${customTheme.readerText};
      }

      @media (prefers-color-scheme: dark) {
        html[data-preview-theme="system"] {
          color-scheme: dark;
          background: #111317;
          color: #e9edf3;
        }

        html[data-preview-theme="system"] body {
          background: #111317;
          color: #e9edf3;
        }
      }
    </style>`;
}

function previewHeadInjection(csp: string, themeMode?: ThemeMode, customBrightness?: number): string {
  const themeStyle = previewThemeStyle(themeMode, customBrightness);
  return themeStyle ? `${cspMeta(csp)}\n    ${themeStyle}` : cspMeta(csp);
}

export function isFullHtmlDocument(html: string): boolean {
  return fullDocumentPattern.test(html);
}

export function sanitizeOriginalDocument(html: string, options: OriginalSanitizeOptions): string {
  const doc = parseHtmlDocument(html);
  sanitizeTree(doc, options);

  if (isFullHtmlDocument(html)) {
    const doctype = doc.doctype ? "<!doctype html>\n" : "<!doctype html>\n";
    return `${doctype}${doc.documentElement.outerHTML}`;
  }

  return doc.body.innerHTML;
}

export function injectCspIntoDocument(
  html: string,
  csp: string,
  title = "Preview",
  themeMode?: ThemeMode,
  customBrightness?: number
): string {
  const withoutExistingCsp = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
    ""
  );
  const hasHtmlElement = /<html\b[^>]*>/i.test(withoutExistingCsp);
  const themedHtml = withThemeAttribute(withoutExistingCsp, themeMode);

  if (/<head\b[^>]*>/i.test(themedHtml)) {
    const injectedHtml = themedHtml.replace(
      /<head\b([^>]*)>/i,
      `<head$1>\n    ${previewHeadInjection(csp, themeMode, customBrightness)}`
    );
    return hasHtmlElement ? injectedHtml : `<!doctype html>\n<html lang="ko"${themeAttribute(themeMode)}>\n${injectedHtml}\n</html>`;
  }

  if (hasHtmlElement) {
    return themedHtml.replace(
      /<html\b([^>]*)>/i,
      `<html$1>\n  <head>\n    <meta charset="utf-8">\n    ${previewHeadInjection(csp, themeMode, customBrightness)}\n    <title>${escapeHtml(title)}</title>\n  </head>`
    );
  }

  return `<!doctype html>
<html lang="ko"${themeAttribute(themeMode)}>
  <head>
    <meta charset="utf-8">
    ${previewHeadInjection(csp, themeMode, customBrightness)}
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>${themedHtml}</body>
</html>`;
}

export function buildOriginalPreviewDocument(
  html: string,
  csp: string,
  title?: string,
  themeMode?: ThemeMode,
  customBrightness?: number
): string {
  return isFullHtmlDocument(html)
    ? injectCspIntoDocument(html, csp, title, themeMode, customBrightness)
    : injectCspIntoDocument(html, csp, title, themeMode, customBrightness);
}

export function buildBrowserOpenDocument(sourceHtml: string, fallbackHtml: string, title?: string): string {
  if (isFullHtmlDocument(sourceHtml)) {
    return sourceHtml;
  }
  if (isFullHtmlDocument(fallbackHtml)) {
    return fallbackHtml;
  }
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title ?? "Preview")}</title>
  </head>
  <body>${fallbackHtml}</body>
</html>`;
}
