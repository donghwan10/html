import { randomUUID } from "node:crypto";
import type { PreviewDocumentRegistrationResult, PreviewMode } from "../shared/types";

interface StoredPreviewDocument {
  html: string;
  mode: PreviewMode;
  createdAt: number;
}

const documents = new Map<string, StoredPreviewDocument>();

export function registerPreviewDocumentHtml(
  html: string,
  mode: PreviewMode
): PreviewDocumentRegistrationResult {
  const id = randomUUID();
  documents.set(id, {
    html,
    mode,
    createdAt: Date.now()
  });
  return {
    id,
    url: `preview://session/${id}/index.html`
  };
}

export function revokePreviewDocumentHtml(id: string): void {
  documents.delete(id);
}

export function handlePreviewProtocol(request: Request): Response {
  const url = new URL(request.url);
  const id = url.pathname.split("/").filter(Boolean)[0];
  const document = id ? documents.get(id) : undefined;

  if (!document) {
    return new Response("Preview document not found.", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  return new Response(document.html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-preview-mode": document.mode,
      "x-preview-created-at": String(document.createdAt)
    }
  });
}
