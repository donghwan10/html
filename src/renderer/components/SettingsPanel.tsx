import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { type ReactElement, useLayoutEffect, useRef, useState } from "react";
import type { PreviewSettings, TextAlign, ThemeMode } from "../../shared/types";
import { backgroundOptions, defaultPreviewSettings, fontOptions } from "../lib/settingsStore";

interface SettingsPanelProps {
  settings: PreviewSettings;
  onChange: (settings: PreviewSettings) => void;
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps): ReactElement {
  const panelRef = useRef<HTMLElement | null>(null);
  const nextScrollTopRef = useRef<number | null>(null);
  const [customOpen, setCustomOpen] = useState(true);

  const rememberScrollPosition = (): void => {
    nextScrollTopRef.current = panelRef.current?.scrollTop ?? null;
  };

  const update = <K extends keyof PreviewSettings>(key: K, value: PreviewSettings[K]): void => {
    rememberScrollPosition();
    onChange({ ...settings, [key]: value });
  };

  const resetCustomSettings = (): void => {
    rememberScrollPosition();
    onChange({
      ...settings,
      fontWeight: defaultPreviewSettings.fontWeight,
      letterSpacing: defaultPreviewSettings.letterSpacing,
      wordSpacing: defaultPreviewSettings.wordSpacing,
      paragraphSpacing: defaultPreviewSettings.paragraphSpacing,
      paragraphIndent: defaultPreviewSettings.paragraphIndent,
      textAlign: defaultPreviewSettings.textAlign,
      textColor: defaultPreviewSettings.textColor,
      headingScale: defaultPreviewSettings.headingScale,
      codeWrap: defaultPreviewSettings.codeWrap,
      highContrast: defaultPreviewSettings.highContrast,
      koreanLineBreak: defaultPreviewSettings.koreanLineBreak
    });
  };

  useLayoutEffect(() => {
    if (panelRef.current && nextScrollTopRef.current !== null) {
      panelRef.current.scrollTop = nextScrollTopRef.current;
      nextScrollTopRef.current = null;
    }
  });

  const textColorValue = settings.textColor === "auto" ? "#1e2228" : settings.textColor;

  return (
    <aside ref={panelRef} className="settings-panel" aria-label="Preview settings">
      <label>
        <span>Theme</span>
        <select value={settings.themeMode} onChange={(event) => update("themeMode", event.target.value as ThemeMode)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      {settings.themeMode === "custom" ? (
        <label>
          <span>Bright</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.customBrightness}
            onChange={(event) => update("customBrightness", Number(event.target.value))}
          />
          <strong>{settings.customBrightness}%</strong>
        </label>
      ) : null}

      <label>
        <span>Font</span>
        <select value={settings.fontFamily} onChange={(event) => update("fontFamily", event.target.value)}>
          {fontOptions.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Size</span>
        <input
          type="range"
          min={13}
          max={28}
          step={1}
          value={settings.fontSize}
          onChange={(event) => update("fontSize", Number(event.target.value))}
        />
        <strong>{settings.fontSize}px</strong>
      </label>

      <label>
        <span>Width</span>
        <input
          type="range"
          min={520}
          max={1280}
          step={20}
          value={settings.maxWidth}
          onChange={(event) => update("maxWidth", Number(event.target.value))}
        />
        <strong>{settings.maxWidth}px</strong>
      </label>

      <label>
        <span>Margin</span>
        <input
          type="range"
          min={18}
          max={72}
          step={2}
          value={settings.contentPadding}
          onChange={(event) => update("contentPadding", Number(event.target.value))}
        />
        <strong>{settings.contentPadding}px</strong>
      </label>

      <label>
        <span>Line</span>
        <input
          type="range"
          min={1.2}
          max={2.2}
          step={0.05}
          value={settings.lineHeight}
          onChange={(event) => update("lineHeight", Number(event.target.value))}
        />
        <strong>{settings.lineHeight.toFixed(2)}</strong>
      </label>

      <div className="swatch-row" aria-label="Background color">
        {backgroundOptions.map((color) => (
          <button
            key={color}
            type="button"
            className={settings.backgroundColor === color ? "is-active" : ""}
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => update("backgroundColor", color)}
          />
        ))}
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.allowRemoteImages}
          onChange={(event) => update("allowRemoteImages", event.target.checked)}
        />
        <span>Remote images</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.allowDataAndBlobResources}
          onChange={(event) => update("allowDataAndBlobResources", event.target.checked)}
        />
        <span>data/blob resources</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.doubleMode}
          onChange={(event) => update("doubleMode", event.target.checked)}
        />
        <span>Double mode</span>
      </label>

      <section className="settings-group" aria-labelledby="custom-settings-title">
        <div className="settings-group__header">
          <button
            type="button"
            className="settings-group__toggle"
            aria-expanded={customOpen}
            aria-controls="custom-settings-body"
            onClick={() => setCustomOpen((open) => !open)}
          >
            {customOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
            <span id="custom-settings-title">Custom</span>
          </button>
          <button
            type="button"
            className="mini-icon-button"
            aria-label="Reset Custom settings"
            title="Reset Custom settings"
            onClick={resetCustomSettings}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>

        {customOpen ? (
          <div id="custom-settings-body" className="settings-group__body">
            <label>
              <span>Weight</span>
              <input
                type="range"
                min={300}
                max={800}
                step={100}
                value={settings.fontWeight}
                onChange={(event) => update("fontWeight", Number(event.target.value))}
              />
              <strong>{settings.fontWeight}</strong>
            </label>

            <label>
              <span>Letter</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={settings.letterSpacing}
                onChange={(event) => update("letterSpacing", Number(event.target.value))}
              />
              <strong>{settings.letterSpacing.toFixed(2)}px</strong>
            </label>

            <label>
              <span>Word</span>
              <input
                type="range"
                min={0}
                max={8}
                step={0.25}
                value={settings.wordSpacing}
                onChange={(event) => update("wordSpacing", Number(event.target.value))}
              />
              <strong>{settings.wordSpacing.toFixed(2)}px</strong>
            </label>

            <label>
              <span>Para</span>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={settings.paragraphSpacing}
                onChange={(event) => update("paragraphSpacing", Number(event.target.value))}
              />
              <strong>{settings.paragraphSpacing.toFixed(2)}em</strong>
            </label>

            <label>
              <span>Indent</span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={settings.paragraphIndent}
                onChange={(event) => update("paragraphIndent", Number(event.target.value))}
              />
              <strong>{settings.paragraphIndent.toFixed(1)}em</strong>
            </label>

            <label>
              <span>Align</span>
              <select
                value={settings.textAlign}
                onChange={(event) => update("textAlign", event.target.value as TextAlign)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </label>

            <div className="setting-row">
              <span>Text</span>
              <input
                type="color"
                aria-label="Text color"
                value={textColorValue}
                onChange={(event) => update("textColor", event.target.value)}
              />
              <button
                type="button"
                className={settings.textColor === "auto" ? "mini-button is-active" : "mini-button"}
                onClick={() => update("textColor", "auto")}
              >
                Auto
              </button>
            </div>

            <label>
              <span>Heading</span>
              <input
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={settings.headingScale}
                onChange={(event) => update("headingScale", Number(event.target.value))}
              />
              <strong>{settings.headingScale.toFixed(2)}x</strong>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.codeWrap}
                onChange={(event) => update("codeWrap", event.target.checked)}
              />
              <span>Code wrap</span>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(event) => update("highContrast", event.target.checked)}
              />
              <span>High contrast</span>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.koreanLineBreak}
                onChange={(event) => update("koreanLineBreak", event.target.checked)}
              />
              <span>Korean wrap</span>
            </label>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
