const excludedTextSelectors = "script, style, template, noscript";
const blockTextElements = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);

function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function countGraphemes(text: string): number {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text)).length;
  }

  return Array.from(text).length;
}

function collectVisibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof Element)) {
    return Array.from(node.childNodes, collectVisibleText).join("");
  }

  if (node.matches(excludedTextSelectors)) {
    return "";
  }

  if (node.tagName.toLowerCase() === "br") {
    return " ";
  }

  const childText = Array.from(node.childNodes, collectVisibleText).join("");
  return blockTextElements.has(node.tagName.toLowerCase()) ? ` ${childText} ` : childText;
}

export function htmlToVisibleText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return normalizeVisibleText(collectVisibleText(doc.body));
}

export function countVisibleCharacters(html: string): number {
  return countGraphemes(htmlToVisibleText(html));
}
