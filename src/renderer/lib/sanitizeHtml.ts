import DOMPurify from "dompurify";

export interface SanitizeOptions {
  allowRemoteImages: boolean;
}

const forbiddenTags = [
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta"
];

function isAllowedImageSource(src: string, allowRemoteImages: boolean): boolean {
  const value = src.trim();
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(value)) {
    return true;
  }

  if (!allowRemoteImages) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function removeRemoteCssReferences(css: string): string {
  return css
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\(\s*(['"])(?:https?:|file:|javascript:)[\s\S]*?\1\s*\)/gi, "url()")
    .replace(/url\(\s*(?:https?:|file:|javascript:)[^)]+\)/gi, "url()");
}

function postProcessHtml(cleanHtml: string, options: SanitizeOptions): string {
  const template = document.createElement("template");
  template.innerHTML = cleanHtml;

  template.content.querySelectorAll("img").forEach((image) => {
    image.removeAttribute("srcset");
    const src = image.getAttribute("src");
    if (!src || !isAllowedImageSource(src, options.allowRemoteImages)) {
      image.remove();
    }
  });

  template.content.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (/^\s*javascript:/i.test(href)) {
      link.removeAttribute("href");
    }
    link.setAttribute("rel", "noreferrer noopener");
  });

  template.content.querySelectorAll("style").forEach((style) => {
    style.textContent = removeRemoteCssReferences(style.textContent ?? "");
  });

  template.content.querySelectorAll("[data-preview-style-id]").forEach((placeholder) => {
    const css = placeholder.getAttribute("data-preview-style-css") ?? "";
    const style = document.createElement("style");
    style.textContent = removeRemoteCssReferences(css);
    placeholder.replaceWith(style);
  });

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    element.setAttribute("style", removeRemoteCssReferences(element.getAttribute("style") ?? ""));
  });

  return template.innerHTML;
}

function preserveStyleTags(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll("style").forEach((style, index) => {
    const placeholder = document.createElement("span");
    placeholder.setAttribute("data-preview-style-id", String(index));
    placeholder.setAttribute("data-preview-style-css", style.textContent ?? "");
    style.replaceWith(placeholder);
  });

  return template.innerHTML;
}

export function sanitizeHtml(dirtyHtml: string, options: SanitizeOptions): string {
  const htmlWithStylePlaceholders = preserveStyleTags(dirtyHtml);
  const cleanHtml = DOMPurify.sanitize(htmlWithStylePlaceholders, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["style"],
    ADD_ATTR: ["style", "class", "target", "data-preview-style-id", "data-preview-style-css"],
    FORBID_TAGS: forbiddenTags,
    WHOLE_DOCUMENT: false
  });

  return postProcessHtml(cleanHtml, options);
}
