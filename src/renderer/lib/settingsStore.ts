import type { PreviewSettings } from "../../shared/types";

const settingsKey = "llm-html-previewer:settings:v1";

export const fontOptions = ["Segoe UI", "Malgun Gothic", "Arial", "Georgia", "Noto Sans KR"];
export const backgroundOptions = ["#f4f6f8", "#ffffff", "#f8f2e8", "#eef6f3", "#111317"];

export const defaultPreviewSettings: PreviewSettings = {
  themeMode: "system",
  customBrightness: 50,
  fontFamily: fontOptions[0],
  fontSize: 17,
  maxWidth: 820,
  lineHeight: 1.65,
  backgroundColor: "#f4f6f8",
  allowRemoteImages: false,
  previewMode: "safe-reader",
  allowDataAndBlobResources: true,
  interactiveConfirmed: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrDefault(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function colorOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && backgroundOptions.includes(value) ? value : fallback;
}

export function loadPreviewSettings(): PreviewSettings {
  try {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) {
      return defaultPreviewSettings;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaultPreviewSettings;
    }

    return {
      themeMode:
        parsed.themeMode === "light" ||
        parsed.themeMode === "dark" ||
        parsed.themeMode === "system" ||
        parsed.themeMode === "custom"
          ? parsed.themeMode
          : defaultPreviewSettings.themeMode,
      customBrightness: numberOrDefault(
        parsed.customBrightness,
        defaultPreviewSettings.customBrightness,
        0,
        100
      ),
      fontFamily:
        typeof parsed.fontFamily === "string" && fontOptions.includes(parsed.fontFamily)
          ? parsed.fontFamily
          : defaultPreviewSettings.fontFamily,
      fontSize: numberOrDefault(parsed.fontSize, defaultPreviewSettings.fontSize, 13, 28),
      maxWidth: numberOrDefault(parsed.maxWidth, defaultPreviewSettings.maxWidth, 520, 1280),
      lineHeight: numberOrDefault(parsed.lineHeight, defaultPreviewSettings.lineHeight, 1.2, 2.2),
      backgroundColor: colorOrDefault(parsed.backgroundColor, defaultPreviewSettings.backgroundColor),
      allowRemoteImages:
        typeof parsed.allowRemoteImages === "boolean"
          ? parsed.allowRemoteImages
          : defaultPreviewSettings.allowRemoteImages,
      previewMode:
        parsed.previewMode === "safe-reader" ||
        parsed.previewMode === "original-document" ||
        parsed.previewMode === "trusted-interactive"
          ? parsed.previewMode
          : defaultPreviewSettings.previewMode,
      allowDataAndBlobResources:
        typeof parsed.allowDataAndBlobResources === "boolean"
          ? parsed.allowDataAndBlobResources
          : defaultPreviewSettings.allowDataAndBlobResources,
      interactiveConfirmed:
        typeof parsed.interactiveConfirmed === "boolean"
          ? parsed.interactiveConfirmed
          : defaultPreviewSettings.interactiveConfirmed
    };
  } catch {
    return defaultPreviewSettings;
  }
}

export function savePreviewSettings(settings: PreviewSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}
