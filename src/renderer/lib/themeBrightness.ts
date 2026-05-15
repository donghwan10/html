export interface CustomThemeColors {
  colorScheme: "light" | "dark";
  bg: string;
  panel: string;
  panelSoft: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  shadow: string;
  readerBg: string;
  readerPage: string;
  readerText: string;
  readerMuted: string;
  readerBorder: string;
  readerCodeBg: string;
  readerLink: string;
}

function clampBrightness(brightness: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(brightness) ? brightness : 50));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16)
  ];
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

function mixColor(darkColor: string, lightColor: string, amount: number): string {
  const dark = hexToRgb(darkColor);
  const light = hexToRgb(lightColor);
  return `#${dark.map((channel, index) => toHex(channel + (light[index] - channel) * amount)).join("")}`;
}

export function getCustomThemeColors(brightness: number): CustomThemeColors {
  const amount = clampBrightness(brightness) / 100;
  const darkText = amount < 0.5;

  return {
    colorScheme: darkText ? "dark" : "light",
    bg: mixColor("#11151b", "#eef1f5", amount),
    panel: mixColor("#181d25", "#ffffff", amount),
    panelSoft: mixColor("#202632", "#f8fafc", amount),
    text: darkText ? "#ebeff5" : "#1f252d",
    muted: darkText ? "#a3adbb" : "#687180",
    border: mixColor("#303846", "#d8dee8", amount),
    borderStrong: mixColor("#495466", "#bdc7d5", amount),
    accent: darkText ? "#75b7ff" : "#1267d6",
    accentStrong: darkText ? "#a8d1ff" : "#0753b7",
    accentSoft: darkText ? "#172b42" : "#e8f1ff",
    danger: darkText ? "#ff9999" : "#a93636",
    dangerSoft: darkText ? "#402425" : "#fff0f0",
    shadow: darkText ? "0 16px 42px rgba(0, 0, 0, 0.28)" : "0 16px 42px rgba(36, 45, 62, 0.12)",
    readerBg: mixColor("#111317", "#f4f6f8", amount),
    readerPage: mixColor("#171a20", "#ffffff", amount),
    readerText: darkText ? "#e9edf3" : "#1e2228",
    readerMuted: darkText ? "#a8b0bd" : "#646b75",
    readerBorder: mixColor("#303642", "#d7dbe2", amount),
    readerCodeBg: mixColor("#222732", "#f2f4f7", amount),
    readerLink: darkText ? "#7ab7ff" : "#0b63ce"
  };
}
