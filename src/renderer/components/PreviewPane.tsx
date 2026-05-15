import {
  Clipboard,
  Copy,
  Expand,
  ExternalLink,
  FileCode2,
  FileDown,
  FileImage,
  FileText,
  PanelRightOpen,
  Settings,
  SunMoon
} from "lucide-react";
import { type ReactElement, useCallback, useRef, useState } from "react";
import type { CaptureMode, ExportImageFormat, PreviewMode, PreviewSettings } from "../../shared/types";
import IconButton from "./IconButton";
import SettingsPanel from "./SettingsPanel";

interface PreviewPaneProps {
  previewDocumentHtml: string;
  previewUrl: string | null;
  sandbox: string;
  previewMode: PreviewMode;
  previewZoom: number;
  characterCount: number;
  settings: PreviewSettings;
  status: string;
  settingsOpen: boolean;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onSettingsChange: (settings: PreviewSettings) => void;
  onToggleSettings: () => void;
  onFullscreen: () => void;
  onSaveBodyHtml: () => void;
  onSaveFullHtml: () => void;
  onExportPdf: () => void;
  onExportImage: (format: ExportImageFormat, captureMode: CaptureMode) => void;
  onCopyCleanHtml: () => void;
  onCopyFullHtml: () => void;
  onOpenInBrowser: () => void;
  onToggleTheme: () => void;
}

const modeLabels: Record<PreviewMode, string> = {
  "safe-reader": "Safe",
  "original-document": "Original",
  "trusted-interactive": "Trusted"
};

export default function PreviewPane({
  previewDocumentHtml,
  previewUrl,
  sandbox,
  previewMode,
  previewZoom,
  characterCount,
  settings,
  status,
  settingsOpen,
  onPreviewModeChange,
  onSettingsChange,
  onToggleSettings,
  onFullscreen,
  onSaveBodyHtml,
  onSaveFullHtml,
  onExportPdf,
  onExportImage,
  onCopyCleanHtml,
  onCopyFullHtml,
  onOpenInBrowser,
  onToggleTheme
}: PreviewPaneProps): ReactElement {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("fullDocument");
  const safeReader = previewMode === "safe-reader";
  const zoomScale = previewZoom / 100;

  const attachDoubleClick = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.ondblclick = onFullscreen;
      }
    } catch {
      // Trusted mode uses a separate preview:// origin, so the parent cannot touch its DOM.
    }
  }, [onFullscreen]);

  return (
    <div className="preview-pane">
      <div className="pane-header pane-header--preview">
        <div>
          <h1>Preview</h1>
          <p>{status}</p>
        </div>
        <div className="preview-header-actions">
          <div className="segmented-control preview-mode-control" aria-label="Preview mode">
            {(Object.keys(modeLabels) as PreviewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={previewMode === mode ? "is-active" : ""}
                aria-pressed={previewMode === mode}
                onClick={() => onPreviewModeChange(mode)}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>
          <div className="preview-toolbar">
            <IconButton icon={<SunMoon size={16} />} label="Theme" onClick={onToggleTheme} />
            <IconButton icon={<Settings size={16} />} label="Settings" onClick={onToggleSettings} />
            <IconButton icon={<Expand size={16} />} label="Full" variant="primary" onClick={onFullscreen} />
          </div>
        </div>
      </div>

      <div className="export-bar">
        <IconButton
          icon={<FileCode2 size={16} />}
          label={safeReader ? "Body HTML" : "Source HTML"}
          onClick={onSaveBodyHtml}
        />
        <IconButton
          icon={<FileDown size={16} />}
          label={safeReader ? "Single HTML" : "Current doc"}
          onClick={onSaveFullHtml}
        />
        <IconButton icon={<FileText size={16} />} label="PDF" onClick={onExportPdf} />
        <IconButton icon={<FileImage size={16} />} label="PNG" onClick={() => onExportImage("png", captureMode)} />
        <IconButton icon={<FileImage size={16} />} label="JPG" onClick={() => onExportImage("jpg", captureMode)} />
        <IconButton
          icon={<Clipboard size={16} />}
          label={safeReader ? "Clean copy" : "Source copy"}
          onClick={onCopyCleanHtml}
        />
        <IconButton
          icon={<Copy size={16} />}
          label={safeReader ? "Styled copy" : "Doc copy"}
          onClick={onCopyFullHtml}
        />
        <IconButton icon={<ExternalLink size={16} />} label="Browser" onClick={onOpenInBrowser} />
        <label className="capture-select">
          <PanelRightOpen size={15} aria-hidden="true" />
          <select value={captureMode} onChange={(event) => setCaptureMode(event.target.value as CaptureMode)}>
            <option value="viewport">Viewport</option>
            <option value="fullDocument">Full doc</option>
          </select>
        </label>
      </div>

      <div className={`preview-workspace ${settingsOpen ? "preview-workspace--settings" : ""}`}>
        <div className="preview-frame-wrap">
          <div className="preview-frame-viewport">
            <iframe
              ref={iframeRef}
              className="preview-frame"
              title="HTML preview"
              sandbox={sandbox}
              src={previewUrl ?? undefined}
              srcDoc={previewUrl ? undefined : previewDocumentHtml}
              style={{
                width: `${100 / zoomScale}%`,
                height: `${100 / zoomScale}%`,
                transform: `scale(${zoomScale})`
              }}
              onLoad={attachDoubleClick}
            />
          </div>
        </div>
        {settingsOpen ? <SettingsPanel settings={settings} onChange={onSettingsChange} /> : null}
      </div>

      <div className="preview-info-bar" aria-label="Preview information">
        <span>Characters {characterCount.toLocaleString()}</span>
        <span>Zoom {previewZoom}%</span>
      </div>
    </div>
  );
}
