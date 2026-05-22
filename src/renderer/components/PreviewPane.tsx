import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Expand,
  ExternalLink,
  FileCode2,
  FileDown,
  FileImage,
  FileText,
  PanelRightOpen,
  Search,
  Settings,
  SunMoon,
  X
} from "lucide-react";
import {
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { CaptureMode, ExportImageFormat, PreviewMode, PreviewSettings } from "../../shared/types";
import { shouldIgnorePreviewFindShortcutTarget } from "../lib/findShortcutTarget";
import { activateFindMatch, cleanupFindHighlights, highlightFindMatches } from "../lib/previewFind";
import {
  type PreviewFrameId,
  type PreviewScrollSnapshots,
  readIframeScroll,
  restoreIframeScroll
} from "../lib/previewScroll";
import IconButton from "./IconButton";
import SettingsPanel from "./SettingsPanel";

export interface PreviewFrameView {
  id: PreviewFrameId;
  label: string;
  mode: PreviewMode;
  previewDocumentHtml: string;
  previewUrl: string | null;
  sandbox: string;
}

export interface PreviewPaneHandle {
  readScrollSnapshots: () => PreviewScrollSnapshots;
  restoreScrollSnapshots: (snapshots: PreviewScrollSnapshots) => void;
}

interface PreviewPaneProps {
  previewItems: PreviewFrameView[];
  previewMode: PreviewMode;
  previewZoom: number;
  characterCount: number;
  settings: PreviewSettings;
  status: string;
  settingsOpen: boolean;
  restoreScrollSnapshots?: PreviewScrollSnapshots | null;
  onRestoreScrollSnapshots?: () => void;
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

interface FindResultState {
  currentIndex: number;
  total: number;
  unsupported: boolean;
}

function isFindSupported(mode: PreviewMode): boolean {
  return mode !== "trusted-interactive";
}

const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(function PreviewPane(
  {
    previewItems,
    previewMode,
    previewZoom,
    characterCount,
    settings,
    status,
    settingsOpen,
    restoreScrollSnapshots,
    onRestoreScrollSnapshots,
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
  },
  ref
): ReactElement {
  const iframeRefs = useRef<Record<PreviewFrameId, HTMLIFrameElement | null>>({ primary: null, secondary: null });
  const pendingScrollRestoreRef = useRef<PreviewScrollSnapshots>({});
  const activeFrameIdRef = useRef<PreviewFrameId>("primary");
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const findMatchesRef = useRef<HTMLElement[]>([]);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("fullDocument");
  const [activeFrameId, setActiveFrameId] = useState<PreviewFrameId>("primary");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findTargetId, setFindTargetId] = useState<PreviewFrameId>("primary");
  const [findResult, setFindResult] = useState<FindResultState>({
    currentIndex: -1,
    total: 0,
    unsupported: false
  });
  const safeReader = previewMode === "safe-reader";
  const doubleMode = previewItems.length > 1;
  const zoomScale = previewZoom / 100;

  const readScrollSnapshots = useCallback((): PreviewScrollSnapshots => {
    const snapshots: PreviewScrollSnapshots = {};
    previewItems.forEach((item) => {
      const snapshot = readIframeScroll(iframeRefs.current[item.id]);
      if (snapshot) {
        snapshots[item.id] = snapshot;
      }
    });
    return snapshots;
  }, [previewItems]);

  const restoreSnapshots = useCallback(
    (snapshots: PreviewScrollSnapshots): void => {
      previewItems.forEach((item) => restoreIframeScroll(iframeRefs.current[item.id], snapshots[item.id]));
    },
    [previewItems]
  );

  useImperativeHandle(
    ref,
    () => ({
      readScrollSnapshots,
      restoreScrollSnapshots: restoreSnapshots
    }),
    [readScrollSnapshots, restoreSnapshots]
  );

  useEffect(() => {
    if (!restoreScrollSnapshots) {
      return;
    }

    restoreSnapshots(restoreScrollSnapshots);
    onRestoreScrollSnapshots?.();
  }, [onRestoreScrollSnapshots, restoreScrollSnapshots, restoreSnapshots]);

  const setActiveFrame = useCallback((id: PreviewFrameId): void => {
    activeFrameIdRef.current = id;
    setActiveFrameId(id);
  }, []);

  const getFrameItem = useCallback(
    (id: PreviewFrameId): PreviewFrameView => previewItems.find((item) => item.id === id) ?? previewItems[0],
    [previewItems]
  );

  const cleanupFind = useCallback((): void => {
    previewItems.forEach((item) => {
      try {
        const doc = iframeRefs.current[item.id]?.contentDocument;
        if (doc) {
          cleanupFindHighlights(doc);
        }
      } catch {
        // Trusted mode is intentionally isolated from the app shell.
      }
    });
    findMatchesRef.current = [];
  }, [previewItems]);

  const runFind = useCallback(
    (targetId: PreviewFrameId, query: string, requestedIndex = 0): void => {
      const item = getFrameItem(targetId);
      if (!item || !isFindSupported(item.mode)) {
        cleanupFind();
        setFindResult({ currentIndex: -1, total: 0, unsupported: true });
        return;
      }

      try {
        const doc = iframeRefs.current[targetId]?.contentDocument;
        if (!doc) {
          setFindResult({ currentIndex: -1, total: 0, unsupported: false });
          return;
        }

        const marks = highlightFindMatches(doc, query);
        findMatchesRef.current = marks;
        setFindResult({ ...activateFindMatch(marks, requestedIndex), unsupported: false });
      } catch {
        setFindResult({ currentIndex: -1, total: 0, unsupported: true });
      }
    },
    [cleanupFind, getFrameItem]
  );

  const openFind = useCallback(
    (targetId = activeFrameIdRef.current): void => {
      const item = getFrameItem(targetId);
      const nextTarget = item?.id ?? "primary";
      setFindTargetId(nextTarget);
      setFindOpen(true);
      window.setTimeout(() => findInputRef.current?.focus(), 0);
    },
    [getFrameItem]
  );

  const moveFind = useCallback(
    (delta: number): void => {
      if (findResult.unsupported || findMatchesRef.current.length === 0) {
        return;
      }

      const next = findResult.currentIndex + delta;
      setFindResult({ ...activateFindMatch(findMatchesRef.current, next), unsupported: false });
    },
    [findResult.currentIndex, findResult.unsupported]
  );

  useEffect(() => {
    if (!findOpen) {
      cleanupFind();
      setFindResult({ currentIndex: -1, total: 0, unsupported: false });
      return;
    }

    runFind(findTargetId, findQuery, 0);
  }, [cleanupFind, findOpen, findQuery, findTargetId, previewItems, runFind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        if (shouldIgnorePreviewFindShortcutTarget(event.target)) {
          return;
        }
        event.preventDefault();
        openFind(activeFrameIdRef.current);
        return;
      }

      if (!findOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setFindOpen(false);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        moveFind(event.shiftKey ? -1 : 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findOpen, moveFind, openFind]);

  const preparePreviewScrollRestore = useCallback(() => {
    pendingScrollRestoreRef.current = readScrollSnapshots();
  }, [readScrollSnapshots]);

  const handleSettingsChange = useCallback(
    (nextSettings: PreviewSettings) => {
      preparePreviewScrollRestore();
      onSettingsChange(nextSettings);
    },
    [onSettingsChange, preparePreviewScrollRestore]
  );

  const handleToggleTheme = useCallback(() => {
    preparePreviewScrollRestore();
    onToggleTheme();
  }, [onToggleTheme, preparePreviewScrollRestore]);

  const handleFrameLoad = useCallback(
    (item: PreviewFrameView) => {
      restoreIframeScroll(iframeRefs.current[item.id], pendingScrollRestoreRef.current[item.id]);
      delete pendingScrollRestoreRef.current[item.id];

      try {
        const doc = iframeRefs.current[item.id]?.contentDocument;
        if (!doc || !isFindSupported(item.mode)) {
          return;
        }

        doc.onkeydown = (event: KeyboardEvent): void => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
            event.preventDefault();
            setActiveFrame(item.id);
            openFind(item.id);
          }
        };
      } catch {
        // Trusted mode is intentionally isolated from the app shell.
      }

      if (findOpen && findTargetId === item.id) {
        runFind(item.id, findQuery, findResult.currentIndex >= 0 ? findResult.currentIndex : 0);
      }
    },
    [findOpen, findQuery, findResult.currentIndex, findTargetId, openFind, runFind, setActiveFrame]
  );

  const handleFindKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      moveFind(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setFindOpen(false);
    }
  };

  const findTarget = getFrameItem(findTargetId);
  const findTargetLabel = doubleMode ? findTarget.label : "Preview";
  const findStatus = findResult.unsupported
    ? "Unavailable"
    : findQuery.trim() && findResult.total === 0
      ? "0 / 0"
      : findResult.total > 0
        ? `${findResult.currentIndex + 1} / ${findResult.total}`
        : "";

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
            <IconButton icon={<Search size={16} />} label="Find" onClick={() => openFind()} />
            <IconButton icon={<SunMoon size={16} />} label="Theme" onClick={handleToggleTheme} />
            <IconButton icon={<Settings size={16} />} label="Settings" onClick={onToggleSettings} />
            <IconButton icon={<Expand size={16} />} label="Full" variant="primary" onClick={onFullscreen} />
          </div>
        </div>
      </div>

      {findOpen ? (
        <div className="preview-find-bar">
          <span className="preview-find-bar__target">{findTargetLabel}</span>
          <input
            ref={findInputRef}
            type="search"
            value={findQuery}
            disabled={findResult.unsupported}
            placeholder={findResult.unsupported ? "Find is unavailable in Trusted mode" : "Find in preview"}
            onChange={(event) => setFindQuery(event.target.value)}
            onKeyDown={handleFindKeyDown}
          />
          <span className="preview-find-bar__count">{findStatus}</span>
          <button type="button" aria-label="Previous result" onClick={() => moveFind(-1)}>
            <ChevronUp size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next result" onClick={() => moveFind(1)}>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Close find" onClick={() => setFindOpen(false)}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

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
        <div className={`preview-frame-wrap ${doubleMode ? "preview-frame-wrap--double" : ""}`}>
          {previewItems.map((item) => (
            <section
              key={item.id}
              className={`preview-frame-cell ${activeFrameId === item.id ? "preview-frame-cell--active" : ""}`}
              aria-label={`${item.label} preview`}
              onPointerEnter={() => setActiveFrame(item.id)}
            >
              {doubleMode ? <div className="preview-frame-cell__label">{item.label}</div> : null}
              <div className="preview-frame-viewport">
                <iframe
                  ref={(node) => {
                    iframeRefs.current[item.id] = node;
                  }}
                  className="preview-frame"
                  title={`${item.label} HTML preview`}
                  sandbox={item.sandbox}
                  src={item.previewUrl ?? undefined}
                  srcDoc={item.previewUrl ? undefined : item.previewDocumentHtml}
                  style={{
                    width: `${100 / zoomScale}%`,
                    height: `${100 / zoomScale}%`,
                    transform: `scale(${zoomScale})`
                  }}
                  onFocus={() => setActiveFrame(item.id)}
                  onLoad={() => handleFrameLoad(item)}
                />
              </div>
            </section>
          ))}
        </div>
        {settingsOpen ? <SettingsPanel settings={settings} onChange={handleSettingsChange} /> : null}
      </div>

      <div className="preview-info-bar" aria-label="Preview information">
        <span>Characters {characterCount.toLocaleString()}</span>
        <span>Zoom {previewZoom}%</span>
      </div>
    </div>
  );
});

export default PreviewPane;
