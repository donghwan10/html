import type { InputMode, ResolvedInputMode } from "../../shared/types";

const fullFencePattern = /^\s*```(?:html|htm|markdown|md)?[^\S\r\n]*(?:\r?\n)([\s\S]*?)(?:\r?\n)```\s*$/i;
const htmlDocumentPattern = /^\s*(?:<!doctype\s+html\b|<html\b|<body\b)/i;
const htmlBlockTagPattern =
  /<\/?(?:html|head|body|main|section|article|aside|header|footer|nav|div|hgroup|h[1-6]|p|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|pre|code|blockquote|hr|figure|figcaption|style|img|picture|source|audio|video|canvas|svg|form|fieldset|input|button|textarea|select|option|details|summary|dialog|template|slot|math)\b/gi;

export function normalizeInput(input: string): string {
  const match = input.match(fullFencePattern);
  return match ? match[1].trim() : input;
}

export function resolveInputMode(input: string, mode: InputMode): ResolvedInputMode {
  if (mode === "html" || mode === "markdown") {
    return mode;
  }

  if (htmlDocumentPattern.test(input)) {
    return "html";
  }

  const tagMatches = input.match(htmlBlockTagPattern);
  return tagMatches && tagMatches.length >= 2 ? "html" : "markdown";
}
