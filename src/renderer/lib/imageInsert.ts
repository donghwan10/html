import type { LocalImageResult } from "../../shared/types";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildImageTag(image: LocalImageResult): string {
  return `<img src="${image.dataUrl}" alt="${escapeAttribute(image.fileName)}">`;
}
