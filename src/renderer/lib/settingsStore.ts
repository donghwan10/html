import type { PreviewSettings, TextAlign } from "../../shared/types";

const settingsKey = "llm-html-previewer:settings:v1";

export const fontOptions = ["Segoe UI", "Malgun Gothic", "Arial", "Georgia", "Noto Sans KR"];
export const backgroundOptions = ["#f4f6f8", "#ffffff", "#f8f2e8", "#eef6f3", "#111317"];

export const defaultPreviewSettings: PreviewSettings = {
  themeMode: "system",
  customBrightness: 50,
  fontFamily: fontOptions[0],
  fontSize: 17,
  maxWidth: 820,
  contentPadding: 46,
  lineHeight: 1.65,
  fontWeight: 400,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1,
  paragraphIndent: 0,
  textAlign: "left",
  textColor: "auto",
  headingScale: 1,
  codeWrap: false,
  highContrast: false,
  koreanLineBreak: false,
  backgroundColor: "#f4f6f8",
  allowRemoteImages: false,
  previewMode: "safe-reader",
  doubleMode: false,
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

function textColorOrDefault(value: unknown, fallback: string): string {
  if (value === "auto") {
    return "auto";
  }
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function textAlignOrDefault(value: unknown, fallback: TextAlign): TextAlign {
  return value === "left" || value === "center" || value === "right" || value === "justify" ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
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
      contentPadding: numberOrDefault(parsed.contentPadding, defaultPreviewSettings.contentPadding, 18, 72),
      lineHeight: numberOrDefault(parsed.lineHeight, defaultPreviewSettings.lineHeight, 1.2, 2.2),
      fontWeight: numberOrDefault(parsed.fontWeight, defaultPreviewSettings.fontWeight, 300, 800),
      letterSpacing: numberOrDefault(parsed.letterSpacing, defaultPreviewSettings.letterSpacing, 0, 2),
      wordSpacing: numberOrDefault(parsed.wordSpacing, defaultPreviewSettings.wordSpacing, 0, 8),
      paragraphSpacing: numberOrDefault(
        parsed.paragraphSpacing,
        defaultPreviewSettings.paragraphSpacing,
        0.5,
        2.5
      ),
      paragraphIndent: numberOrDefault(parsed.paragraphIndent, defaultPreviewSettings.paragraphIndent, 0, 3),
      textAlign: textAlignOrDefault(parsed.textAlign, defaultPreviewSettings.textAlign),
      textColor: textColorOrDefault(parsed.textColor, defaultPreviewSettings.textColor),
      headingScale: numberOrDefault(parsed.headingScale, defaultPreviewSettings.headingScale, 0.8, 1.4),
      codeWrap: booleanOrDefault(parsed.codeWrap, defaultPreviewSettings.codeWrap),
      highContrast: booleanOrDefault(parsed.highContrast, defaultPreviewSettings.highContrast),
      koreanLineBreak: booleanOrDefault(parsed.koreanLineBreak, defaultPreviewSettings.koreanLineBreak),
      backgroundColor: colorOrDefault(parsed.backgroundColor, defaultPreviewSettings.backgroundColor),
      allowRemoteImages: booleanOrDefault(parsed.allowRemoteImages, defaultPreviewSettings.allowRemoteImages),
      previewMode:
        parsed.previewMode === "safe-reader" ||
        parsed.previewMode === "original-document" ||
        parsed.previewMode === "trusted-interactive"
          ? parsed.previewMode
          : defaultPreviewSettings.previewMode,
      doubleMode: booleanOrDefault(parsed.doubleMode, defaultPreviewSettings.doubleMode),
      allowDataAndBlobResources: booleanOrDefault(
        parsed.allowDataAndBlobResources,
        defaultPreviewSettings.allowDataAndBlobResources
      ),
      interactiveConfirmed: booleanOrDefault(parsed.interactiveConfirmed, defaultPreviewSettings.interactiveConfirmed)
    };
  } catch {
    return defaultPreviewSettings;
  }
}

export function savePreviewSettings(settings: PreviewSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}
