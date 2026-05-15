import {
  type CSSProperties,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  InputMode,
  PreviewDocumentRegistrationResult,
  PreviewMode,
  PreviewZoomCommand,
  PreviewSettings,
  ThemeMode
} from "../shared/types";
import EditorPane, { type EditorPaneHandle } from "./components/EditorPane";
import FullscreenPreview from "./components/FullscreenPreview";
import PreviewPane from "./components/PreviewPane";
import SplitLayout from "./components/SplitLayout";
import { buildImageTag } from "./lib/imageInsert";
import { createPreviewPipeline, htmlToPlainText } from "./lib/previewPipeline";
import { countVisibleCharacters } from "./lib/previewTextStats";
import { loadPreviewSettings, savePreviewSettings } from "./lib/settingsStore";
import { getCustomThemeColors } from "./lib/themeBrightness";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);

  return debounced;
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function nextTheme(themeMode: ThemeMode): ThemeMode {
  if (themeMode === "system") {
    return "dark";
  }
  if (themeMode === "dark") {
    return "light";
  }
  if (themeMode === "light") {
    return "custom";
  }
  return "system";
}

function defaultName(baseName: string, suffix: string): string {
  const cleanBase = baseName.replace(/\.[^.]+$/, "") || "preview";
  return `${cleanBase}${suffix}`;
}

function modeStatus(mode: PreviewMode): string {
  if (mode === "trusted-interactive") {
    return "Trusted Interactive";
  }
  if (mode === "original-document") {
    return "Original Document";
  }
  return "Safe Reader";
}

const previewZoomMin = 50;
const previewZoomMax = 300;
const previewZoomStep = 10;

function clampPreviewZoom(zoom: number): number {
  return Math.max(previewZoomMin, Math.min(previewZoomMax, zoom));
}

type AppThemeStyle = CSSProperties & Record<`--${string}`, string>;

function buildCustomAppThemeStyle(brightness: number): AppThemeStyle {
  const colors = getCustomThemeColors(brightness);
  return {
    "--bg": colors.bg,
    "--panel": colors.panel,
    "--panel-soft": colors.panelSoft,
    "--text": colors.text,
    "--muted": colors.muted,
    "--border": colors.border,
    "--border-strong": colors.borderStrong,
    "--accent": colors.accent,
    "--accent-strong": colors.accentStrong,
    "--accent-soft": colors.accentSoft,
    "--danger": colors.danger,
    "--danger-soft": colors.dangerSoft,
    "--shadow": colors.shadow
  };
}

export default function App(): ReactElement {
  const editorRef = useRef<EditorPaneHandle | null>(null);
  const [source, setSource] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("auto");
  const [settings, setSettings] = useState<PreviewSettings>(() => loadPreviewSettings());
  const [currentName, setCurrentName] = useState("preview.html");
  const [status, setStatus] = useState("Ready");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [ctrlZoomActive, setCtrlZoomActive] = useState(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const [registeredPreview, setRegisteredPreview] = useState<PreviewDocumentRegistrationResult | null>(null);

  const debouncedSource = useDebouncedValue(source, 300);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setSystemTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    savePreviewSettings(settings);
  }, [settings]);

  const effectiveTheme = settings.themeMode === "system" ? systemTheme : settings.themeMode;
  const appThemeStyle = useMemo(
    () => (settings.themeMode === "custom" ? buildCustomAppThemeStyle(settings.customBrightness) : undefined),
    [settings.customBrightness, settings.themeMode]
  );
  const editorDark = effectiveTheme === "dark" || (effectiveTheme === "custom" && settings.customBrightness < 50);

  const preview = useMemo(
    () => createPreviewPipeline(debouncedSource, inputMode, settings, currentName),
    [currentName, debouncedSource, inputMode, settings]
  );

  const previewCharacterCount = useMemo(() => countVisibleCharacters(preview.previewHtml), [preview.previewHtml]);

  const adjustPreviewZoom = useCallback((delta: number): void => {
    setPreviewZoom((current) => clampPreviewZoom(current + delta));
  }, []);

  const resetPreviewZoom = useCallback((): void => {
    setPreviewZoom(100);
  }, []);

  const handlePreviewZoomCommand = useCallback(
    (command: PreviewZoomCommand): void => {
      if (command === "control-down") {
        setCtrlZoomActive(true);
        return;
      }

      if (command === "control-up") {
        setCtrlZoomActive(false);
        return;
      }

      if (command === "zoom-in") {
        adjustPreviewZoom(previewZoomStep);
        return;
      }

      if (command === "zoom-out") {
        adjustPreviewZoom(-previewZoomStep);
        return;
      }

      resetPreviewZoom();
    },
    [adjustPreviewZoom, resetPreviewZoom]
  );

  useEffect(() => window.previewerApi.onPreviewZoomCommand(handlePreviewZoomCommand), [handlePreviewZoomCommand]);

  useEffect(() => {
    const onBlur = (): void => {
      setCtrlZoomActive(false);
    };

    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const handlePreviewZoomWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>): void => {
      event.preventDefault();
      if (event.deltaY < 0) {
        adjustPreviewZoom(previewZoomStep);
        return;
      }
      if (event.deltaY > 0) {
        adjustPreviewZoom(-previewZoomStep);
      }
    },
    [adjustPreviewZoom]
  );

  useEffect(() => {
    let disposed = false;
    let registeredId: string | null = null;

    if (preview.mode !== "trusted-interactive") {
      setRegisteredPreview(null);
      return () => undefined;
    }

    setRegisteredPreview(null);

    window.previewerApi
      .registerPreviewDocument({ html: preview.previewHtml, mode: preview.mode })
      .then((result) => {
        if (!result) {
          return;
        }
        registeredId = result.id;
        if (disposed) {
          void window.previewerApi.revokePreviewDocument(result.id);
          return;
        }
        setRegisteredPreview(result);
      })
      .catch(() => setRegisteredPreview(null));

    return () => {
      disposed = true;
      if (registeredId) {
        void window.previewerApi.revokePreviewDocument(registeredId);
      }
    };
  }, [preview.mode, preview.previewHtml]);

  const showStatus = (message: string): void => {
    setStatus(message);
    window.setTimeout(() => setStatus(`${preview.resolvedMode.toUpperCase()} / ${modeStatus(preview.mode)}`), 1800);
  };

  useEffect(() => {
    setStatus(`${preview.resolvedMode.toUpperCase()} / ${modeStatus(preview.mode)}`);
  }, [preview.mode, preview.resolvedMode]);

  const handleOpenFile = async (): Promise<void> => {
    const file = await window.previewerApi.openSourceFile();
    if (!file) {
      return;
    }
    setSource(file.content);
    setInputMode(file.suggestedMode);
    setCurrentName(file.name);
    showStatus("File opened");
  };

  const handleInsertImage = async (): Promise<void> => {
    const image = await window.previewerApi.chooseLocalImage();
    if (!image) {
      return;
    }
    editorRef.current?.insertText(buildImageTag(image));
    showStatus("Image inserted");
  };

  const handleClear = (): void => {
    setSource("");
    setInputMode("auto");
    setCurrentName("preview.html");
    editorRef.current?.focus();
  };

  const handlePreviewModeChange = (mode: PreviewMode): void => {
    if (mode === "trusted-interactive" && !settings.interactiveConfirmed) {
      const confirmed = window.confirm(
        "Trusted Interactive runs JavaScript in an isolated preview:// origin. Network access and Electron/Node APIs stay blocked. Continue?"
      );
      if (!confirmed) {
        return;
      }
      setSettings((current) => ({ ...current, previewMode: mode, interactiveConfirmed: true }));
      return;
    }

    setSettings((current) => ({ ...current, previewMode: mode }));
  };

  const primaryHtml = preview.mode === "safe-reader" ? preview.sanitizedHtml : preview.sourceHtml;
  const primarySuffix = preview.mode === "safe-reader" ? "-body.html" : "-source.html";

  const handleSaveBodyHtml = async (): Promise<void> => {
    const saved = await window.previewerApi.saveHtml({
      html: primaryHtml,
      defaultName: defaultName(currentName, primarySuffix)
    });
    if (saved) {
      showStatus(preview.mode === "safe-reader" ? "Body HTML saved" : "Source HTML saved");
    }
  };

  const handleSaveFullHtml = async (): Promise<void> => {
    const saved = await window.previewerApi.saveHtml({
      html: preview.previewHtml,
      defaultName: defaultName(currentName, "-document.html")
    });
    if (saved) {
      showStatus("Current document saved");
    }
  };

  const handleExportPdf = async (): Promise<void> => {
    const saved = await window.previewerApi.exportPdf({
      previewDocumentHtml: preview.previewHtml,
      previewMode: preview.mode,
      defaultName: defaultName(currentName, ".pdf")
    });
    if (saved) {
      showStatus("PDF saved");
    }
  };

  const handleExportImage = async (format: "png" | "jpg", captureMode: "viewport" | "fullDocument"): Promise<void> => {
    const saved = await window.previewerApi.exportImage({
      previewDocumentHtml: preview.previewHtml,
      previewMode: preview.mode,
      format,
      captureMode,
      defaultName: defaultName(currentName, `.${format}`)
    });
    if (saved) {
      showStatus(`${format.toUpperCase()} saved`);
    }
  };

  const handleCopyCleanHtml = async (): Promise<void> => {
    const copied = await window.previewerApi.copyHtml({
      html: primaryHtml,
      text: htmlToPlainText(primaryHtml)
    });
    if (copied) {
      showStatus(preview.mode === "safe-reader" ? "Clean HTML copied" : "Source HTML copied");
    }
  };

  const handleCopyFullHtml = async (): Promise<void> => {
    const copied = await window.previewerApi.copyHtml({
      html: preview.previewHtml,
      text: htmlToPlainText(preview.sanitizedHtml)
    });
    if (copied) {
      showStatus("Current document copied");
    }
  };

  const handleOpenInBrowser = async (): Promise<void> => {
    const opened = await window.previewerApi.openInBrowser({
      html: preview.browserOpenHtml,
      defaultName: defaultName(currentName, "-browser.html")
    });
    showStatus(opened ? "Opened in browser" : "Browser open failed");
  };

  const previewUrl = preview.mode === "trusted-interactive" ? registeredPreview?.url ?? null : null;

  return (
    <main className="app-shell" data-theme={effectiveTheme} style={appThemeStyle}>
      <SplitLayout
        left={
          <EditorPane
            ref={editorRef}
            value={source}
            inputMode={inputMode}
            resolvedMode={preview.resolvedMode}
            dark={editorDark}
            onChange={setSource}
            onModeChange={setInputMode}
            onOpenFile={handleOpenFile}
            onInsertImage={handleInsertImage}
            onClear={handleClear}
          />
        }
        right={
          <PreviewPane
            previewDocumentHtml={preview.previewHtml}
            previewUrl={previewUrl}
            sandbox={preview.sandbox}
            previewMode={preview.mode}
            previewZoom={previewZoom}
            characterCount={previewCharacterCount}
            settings={settings}
            status={status}
            settingsOpen={settingsOpen}
            onPreviewModeChange={handlePreviewModeChange}
            onSettingsChange={setSettings}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onFullscreen={() => setFullscreen(true)}
            onSaveBodyHtml={handleSaveBodyHtml}
            onSaveFullHtml={handleSaveFullHtml}
            onExportPdf={handleExportPdf}
            onExportImage={handleExportImage}
            onCopyCleanHtml={handleCopyCleanHtml}
            onCopyFullHtml={handleCopyFullHtml}
            onOpenInBrowser={handleOpenInBrowser}
            onToggleTheme={() => setSettings((current) => ({ ...current, themeMode: nextTheme(current.themeMode) }))}
          />
        }
      />

      {fullscreen ? (
        <FullscreenPreview
          previewDocumentHtml={preview.previewHtml}
          previewUrl={previewUrl}
          sandbox={preview.sandbox}
          previewZoom={previewZoom}
          onClose={() => setFullscreen(false)}
        />
      ) : null}

      {ctrlZoomActive ? (
        <div
          className="preview-zoom-wheel-overlay"
          aria-hidden="true"
          onWheel={handlePreviewZoomWheel}
        />
      ) : null}
    </main>
  );
}
