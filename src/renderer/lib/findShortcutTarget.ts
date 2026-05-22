const previewFindIgnoredSelector = [
  ".editor-pane",
  ".cm-editor",
  ".preview-find-bar",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']"
].join(",");

export function shouldIgnorePreviewFindShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(previewFindIgnoredSelector) !== null;
}
