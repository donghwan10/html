import type { ReactElement } from "react";
import type { PreviewSettings, ThemeMode } from "../../shared/types";
import { backgroundOptions, fontOptions } from "../lib/settingsStore";

interface SettingsPanelProps {
  settings: PreviewSettings;
  onChange: (settings: PreviewSettings) => void;
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps): ReactElement {
  const update = <K extends keyof PreviewSettings>(key: K, value: PreviewSettings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <aside className="settings-panel" aria-label="Preview settings">
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
    </aside>
  );
}
