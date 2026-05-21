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
  PreviewSettings,
  PreviewZoomCommand,
  ThemeMode
} from "../shared/types";
import EditorPane, { type EditorPaneHandle } from "./components/EditorPane";
import FullscreenPreview, { type FullscreenPreviewHandle } from "./components/FullscreenPreview";
import PreviewPane, { type PreviewFrameView, type PreviewPaneHandle } from "./components/PreviewPane";
import SplitLayout from "./components/SplitLayout";
import { buildDoubleContentDocument, buildDoublePreviewDocument } from "./lib/doublePreviewDocument";
import { buildImageTag } from "./lib/imageInsert";
import type { PreviewFrameId, PreviewScrollSnapshots } from "./lib/previewScroll";
import { createPreviewPipeline, htmlToPlainText, type PreviewPipelineResult } from "./lib/previewPipeline";
import { countVisibleCharacters } from "./lib/previewTextStats";
import { loadPreviewSettings, savePreviewSettings } from "./lib/settingsStore";
import { getCustomThemeColors } from "./lib/themeBrightness";

interface SourceState {
  primary: string;
  secondary: string;
}

interface NameState {
  primary: string;
  secondary: string;
}

interface PreviewEntry {
  id: PreviewFrameId;
  label: string;
  preview: PreviewPipelineResult;
}

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

function primaryHtmlForPreview(preview: PreviewPipelineResult): string {
  return preview.mode === "safe-reader" ? preview.sanitizedHtml : preview.sourceHtml;
}

function primarySuffixForMode(mode: PreviewMode): string {
  return mode === "safe-reader" ? "-body.html" : "-source.html";
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
  const previewPaneRef = useRef<PreviewPaneHandle | null>(null);
  const fullscreenRef = useRef<FullscreenPreviewHandle | null>(null);
  const [sources, setSources] = useState<SourceState>({ primary: "", secondary: "" });
  const [activeSource, setActiveSource] = useState<PreviewFrameId>("primary");
  const [inputMode, setInputMode] = useState<InputMode>("auto");
  const [settings, setSettings] = useState<PreviewSettings>(() => loadPreviewSettings());
  const [currentNames, setCurrentNames] = useState<NameState>({
    primary: "preview.html",
    secondary: "preview-secondary.html"
  });
  const [status, setStatus] = useState("Ready");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenInitialScrollSnapshots, setFullscreenInitialScrollSnapshots] = useState<PreviewScrollSnapshots>({});
  const [pendingPreviewScrollRestore, setPendingPreviewScrollRestore] = useState<PreviewScrollSnapshots | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [ctrlZoomActive, setCtrlZoomActive] = useState(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const [registeredPreviews, setRegisteredPreviews] = useState<
    Partial<Record<PreviewFrameId, PreviewDocumentRegistrationResult>>
  >({});
  const statusLabelRef = useRef("Ready");

  const debouncedSources = useDebouncedValue(sources, 300);
  const effectiveActiveSource = settings.doubleMode ? activeSource : "primary";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setSystemTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    savePreviewSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!settings.doubleMode) {
      setActiveSource("primary");
    }
  }, [settings.doubleMode]);

  const effectiveTheme = settings.themeMode === "system" ? systemTheme : settings.themeMode;
  const appThemeStyle = useMemo(
    () => (settings.themeMode === "custom" ? buildCustomAppThemeStyle(settings.customBrightness) : undefined),
    [settings.customBrightness, settings.themeMode]
  );
  const editorDark = effectiveTheme === "dark" || (effectiveTheme === "custom" && settings.customBrightness < 50);

  const primaryPreview = useMemo(
    () => createPreviewPipeline(debouncedSources.primary, inputMode, settings, currentNames.primary),
    [currentNames.primary, debouncedSources.primary, inputMode, settings]
  );

  const secondaryPreview = useMemo(
    () => createPreviewPipeline(debouncedSources.secondary, inputMode, settings, currentNames.secondary),
    [currentNames.secondary, debouncedSources.secondary, inputMode, settings]
  );

  const previewEntries = useMemo<PreviewEntry[]>(
    () =>
      settings.doubleMode
        ? [
            { id: "primary", label: "Left", preview: primaryPreview },
            { id: "secondary", label: "Right", preview: secondaryPreview }
          ]
        : [{ id: "primary", label: "Preview", preview: primaryPreview }],
    [primaryPreview, secondaryPreview, settings.doubleMode]
  );

  const previewMode = primaryPreview.mode;
  const previewCharacterCount = useMemo(
    () => previewEntries.reduce((total, entry) => total + countVisibleCharacters(entry.preview.previewHtml), 0),
    [previewEntries]
  );

  const statusLabel = useMemo(() => {
    if (settings.doubleMode) {
      return `${primaryPreview.resolvedMode.toUpperCase()} / ${secondaryPreview.resolvedMode.toUpperCase()} / ${modeStatus(
        previewMode
      )}`;
    }
    return `${primaryPreview.resolvedMode.toUpperCase()} / ${modeStatus(previewMode)}`;
  }, [previewMode, primaryPreview.resolvedMode, secondaryPreview.resolvedMode, settings.doubleMode]);

  useEffect(() => {
    statusLabelRef.current = statusLabel;
    setStatus(statusLabel);
  }, [statusLabel]);

  const previewItems = useMemo<PreviewFrameView[]>(
    () =>
      previewEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        mode: entry.preview.mode,
        previewDocumentHtml: entry.preview.previewHtml,
        previewUrl: entry.preview.mode === "trusted-interactive" ? registeredPreviews[entry.id]?.url ?? null : null,
        sandbox: entry.preview.sandbox
      })),
    [previewEntries, registeredPreviews]
  );

  const combinedPreviewDocumentHtml = useMemo(() => {
    if (!settings.doubleMode) {
      return primaryPreview.previewHtml;
    }

    return buildDoublePreviewDocument({
      items: [
        { label: "Left", html: primaryPreview.previewHtml },
        { label: "Right", html: secondaryPreview.previewHtml }
      ],
      title: "Double preview",
      themeMode: settings.themeMode,
      previewMode
    });
  }, [previewMode, primaryPreview.previewHtml, secondaryPreview.previewHtml, settings.doubleMode, settings.themeMode]);

  const combinedPrimaryHtml = useMemo(() => {
    if (!settings.doubleMode) {
      return primaryHtmlForPreview(primaryPreview);
    }

    return buildDoubleContentDocument(
      [
        { label: "Left", html: primaryHtmlForPreview(primaryPreview) },
        { label: "Right", html: primaryHtmlForPreview(secondaryPreview) }
      ],
      "Double content"
    );
  }, [primaryPreview, secondaryPreview, settings.doubleMode]);

  useEffect(() => {
    let disposed = false;
    const registeredIds: string[] = [];

    if (previewMode !== "trusted-interactive") {
      setRegisteredPreviews({});
      return () => undefined;
    }

    setRegisteredPreviews({});

    Promise.all(
      previewEntries.map(async (entry) => {
        const result = await window.previewerApi.registerPreviewDocument({
          html: entry.preview.previewHtml,
          mode: entry.preview.mode
        });
        return { id: entry.id, result };
      })
    )
      .then((results) => {
        const nextRegistered: Partial<Record<PreviewFrameId, PreviewDocumentRegistrationResult>> = {};
        results.forEach(({ id, result }) => {
          if (!result) {
            return;
          }
          registeredIds.push(result.id);
          nextRegistered[id] = result;
        });

        if (disposed) {
          registeredIds.forEach((id) => void window.previewerApi.revokePreviewDocument(id));
          return;
        }

        setRegisteredPreviews(nextRegistered);
      })
      .catch(() => setRegisteredPreviews({}));

    return () => {
      disposed = true;
      registeredIds.forEach((id) => void window.previewerApi.revokePreviewDocument(id));
    };
  }, [previewEntries, previewMode]);

  const showStatus = useCallback((message: string): void => {
    setStatus(message);
    window.setTimeout(() => setStatus(statusLabelRef.current), 1800);
  }, []);

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

  const updateSource = (pane: PreviewFrameId, value: string): void => {
    setSources((current) => ({ ...current, [pane]: value }));
  };

  const updateName = (pane: PreviewFrameId, value: string): void => {
    setCurrentNames((current) => ({ ...current, [pane]: value }));
  };

  const handleOpenFile = async (): Promise<void> => {
    const file = await window.previewerApi.openSourceFile();
    if (!file) {
      return;
    }

    updateSource(effectiveActiveSource, file.content);
    updateName(effectiveActiveSource, file.name);
    setInputMode(file.suggestedMode);
    showStatus(settings.doubleMode ? `${effectiveActiveSource === "primary" ? "Top" : "Bottom"} file opened` : "File opened");
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
    updateSource(effectiveActiveSource, "");
    updateName(effectiveActiveSource, effectiveActiveSource === "primary" ? "preview.html" : "preview-secondary.html");
    if (!settings.doubleMode) {
      setInputMode("auto");
    }
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

  const handleSaveBodyHtml = async (): Promise<void> => {
    const defaultPath = settings.doubleMode
      ? "preview-double-body.html"
      : defaultName(currentNames.primary, primarySuffixForMode(previewMode));
    const saved = await window.previewerApi.saveHtml({
      html: combinedPrimaryHtml,
      defaultName: defaultPath
    });
    if (saved) {
      showStatus(settings.doubleMode ? "Double content saved" : previewMode === "safe-reader" ? "Body HTML saved" : "Source HTML saved");
    }
  };

  const handleSaveFullHtml = async (): Promise<void> => {
    const saved = await window.previewerApi.saveHtml({
      html: combinedPreviewDocumentHtml,
      defaultName: settings.doubleMode ? "preview-double-document.html" : defaultName(currentNames.primary, "-document.html")
    });
    if (saved) {
      showStatus("Current document saved");
    }
  };

  const handleExportPdf = async (): Promise<void> => {
    const saved = await window.previewerApi.exportPdf({
      previewDocumentHtml: combinedPreviewDocumentHtml,
      previewMode,
      defaultName: settings.doubleMode ? "preview-double.pdf" : defaultName(currentNames.primary, ".pdf")
    });
    if (saved) {
      showStatus("PDF saved");
    }
  };

  const handleExportImage = async (format: "png" | "jpg", captureMode: "viewport" | "fullDocument"): Promise<void> => {
    const saved = await window.previewerApi.exportImage({
      previewDocumentHtml: combinedPreviewDocumentHtml,
      previewMode,
      format,
      captureMode,
      defaultName: settings.doubleMode ? `preview-double.${format}` : defaultName(currentNames.primary, `.${format}`)
    });
    if (saved) {
      showStatus(`${format.toUpperCase()} saved`);
    }
  };

  const handleCopyCleanHtml = async (): Promise<void> => {
    const copied = await window.previewerApi.copyHtml({
      html: combinedPrimaryHtml,
      text: htmlToPlainText(combinedPrimaryHtml)
    });
    if (copied) {
      showStatus(settings.doubleMode ? "Double content copied" : previewMode === "safe-reader" ? "Clean HTML copied" : "Source HTML copied");
    }
  };

  const handleCopyFullHtml = async (): Promise<void> => {
    const copied = await window.previewerApi.copyHtml({
      html: combinedPreviewDocumentHtml,
      text: settings.doubleMode
        ? `${htmlToPlainText(primaryPreview.sanitizedHtml)}\n\n${htmlToPlainText(secondaryPreview.sanitizedHtml)}`.trim()
        : htmlToPlainText(primaryPreview.sanitizedHtml)
    });
    if (copied) {
      showStatus("Current document copied");
    }
  };

  const handleOpenInBrowser = async (): Promise<void> => {
    const opened = await window.previewerApi.openInBrowser({
      html: settings.doubleMode ? combinedPreviewDocumentHtml : primaryPreview.browserOpenHtml,
      defaultName: settings.doubleMode ? "preview-double-browser.html" : defaultName(currentNames.primary, "-browser.html")
    });
    showStatus(opened ? "Opened in browser" : "Browser open failed");
  };

  const handleOpenFullscreen = (): void => {
    setFullscreenInitialScrollSnapshots(previewPaneRef.current?.readScrollSnapshots() ?? {});
    setFullscreen(true);
  };

  const handleCloseFullscreen = (): void => {
    const snapshots = fullscreenRef.current?.readScrollSnapshots() ?? {};
    setFullscreen(false);
    setPendingPreviewScrollRestore(snapshots);
  };

  return (
    <main className="app-shell" data-theme={effectiveTheme} style={appThemeStyle}>
      <SplitLayout
        left={
          <EditorPane
            ref={editorRef}
            value={sources.primary}
            secondaryValue={sources.secondary}
            activePane={effectiveActiveSource}
            doubleMode={settings.doubleMode}
            inputMode={inputMode}
            resolvedMode={primaryPreview.resolvedMode}
            secondaryResolvedMode={secondaryPreview.resolvedMode}
            dark={editorDark}
            onChange={(value) => updateSource("primary", value)}
            onSecondaryChange={(value) => updateSource("secondary", value)}
            onActivePaneChange={setActiveSource}
            onModeChange={setInputMode}
            onOpenFile={handleOpenFile}
            onInsertImage={handleInsertImage}
            onClear={handleClear}
          />
        }
        right={
          <PreviewPane
            ref={previewPaneRef}
            previewItems={previewItems}
            previewMode={previewMode}
            previewZoom={previewZoom}
            characterCount={previewCharacterCount}
            settings={settings}
            status={status}
            settingsOpen={settingsOpen}
            restoreScrollSnapshots={pendingPreviewScrollRestore}
            onRestoreScrollSnapshots={() => setPendingPreviewScrollRestore(null)}
            onPreviewModeChange={handlePreviewModeChange}
            onSettingsChange={setSettings}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onFullscreen={handleOpenFullscreen}
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
          ref={fullscreenRef}
          previewItems={previewItems}
          previewZoom={previewZoom}
          initialScrollSnapshots={fullscreenInitialScrollSnapshots}
          onClose={handleCloseFullscreen}
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
