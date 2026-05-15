import { clipboard } from "electron";
import type { CopyHtmlPayload } from "../shared/types";

export async function copyHtml(payload: CopyHtmlPayload): Promise<boolean> {
  if (!payload || typeof payload.html !== "string" || typeof payload.text !== "string") {
    return false;
  }

  clipboard.write({
    html: payload.html,
    text: payload.text
  });
  return true;
}
