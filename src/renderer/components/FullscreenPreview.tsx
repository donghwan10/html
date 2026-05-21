import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
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
import type { PreviewMode } from "../../shared/types";
import { activateFindMatch, cleanupFindHighlights, highlightFindMatches } from "../lib/previewFind";
import {
  type PreviewFrameId,
  type PreviewScrollSnapshots,
  readIframeScroll,
  restoreIframeScroll
} from "../lib/previewScroll";
import IconButton from "./IconButton";
import type { PreviewFrameView } from "./PreviewPane";

export interface FullscreenPreviewHandle {
  readScrollSnapshots: () => PreviewScrollSnapshots;
}

interface FullscreenPreviewProps {
  previewItems: PreviewFrameView[];
  previewZoom: number;
  initialScrollSnapshots: PreviewScrollSnapshots;
  onClose: () => void;
}

interface FindResultState {
  currentIndex: number;
  total: number;
  unsupported: boolean;
}

function isFindSupported(mode: PreviewMode): boolean {
  return mode !== "trusted-interactive";
}

const FullscreenPreview = forwardRef<FullscreenPreviewHandle, FullscreenPreviewProps>(function FullscreenPreview(
  { previewItems, previewZoom, initialScrollSnapshots, onClose },
  ref
): ReactElement {
  const iframeRefs = useRef<Record<PreviewFrameId, HTMLIFrameElement | null>>({ primary: null, secondary: null });
  const restoredFramesRef = useRef<Partial<Record<PreviewFrameId, boolean>>>({});
  const activeFrameIdRef = useRef<PreviewFrameId>("primary");
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const findMatchesRef = useRef<HTMLElement[]>([]);
  const [activeFrameId, setActiveFrameId] = useState<PreviewFrameId>("primary");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findTargetId, setFindTargetId] = useState<PreviewFrameId>("primary");
  const [findResult, setFindResult] = useState<FindResultState>({
    currentIndex: -1,
    total: 0,
    unsupported: false
  });
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

  useImperativeHandle(ref, () => ({ readScrollSnapshots }), [readScrollSnapshots]);

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
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFind(activeFrameIdRef.current);
        return;
      }

      if (findOpen && event.key === "Enter") {
        event.preventDefault();
        moveFind(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (findOpen) {
          setFindOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findOpen, moveFind, onClose, openFind]);

  useEffect(() => {
    if (!findOpen) {
      cleanupFind();
      setFindResult({ currentIndex: -1, total: 0, unsupported: false });
      return;
    }

    runFind(findTargetId, findQuery, 0);
  }, [cleanupFind, findOpen, findQuery, findTargetId, previewItems, runFind]);

  const handleFrameLoad = useCallback(
    (item: PreviewFrameView) => {
      if (!restoredFramesRef.current[item.id]) {
        restoredFramesRef.current[item.id] = true;
        restoreIframeScroll(iframeRefs.current[item.id], initialScrollSnapshots[item.id]);
      }

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
    [findOpen, findQuery, findResult.currentIndex, findTargetId, initialScrollSnapshots, openFind, runFind, setActiveFrame]
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
    <div className="fullscreen-preview" role="dialog" aria-modal="true" aria-label="Fullscreen preview">
      <div className="fullscreen-preview__bar">
        <span>Preview / Zoom {previewZoom}%</span>
        <div className="fullscreen-preview__actions">
          <IconButton icon={<Search size={16} />} label="Find" onClick={() => openFind()} />
          <IconButton icon={<X size={18} />} label="Close" onClick={onClose} />
        </div>
      </div>

      {findOpen ? (
        <div className="preview-find-bar preview-find-bar--fullscreen">
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

      <div className={`fullscreen-preview__viewport ${doubleMode ? "fullscreen-preview__viewport--double" : ""}`}>
        {previewItems.map((item) => (
          <section
            key={item.id}
            className={`fullscreen-preview__cell ${activeFrameId === item.id ? "fullscreen-preview__cell--active" : ""}`}
            aria-label={`${item.label} fullscreen preview`}
            onPointerEnter={() => setActiveFrame(item.id)}
          >
            {doubleMode ? <div className="fullscreen-preview__label">{item.label}</div> : null}
            <iframe
              ref={(node) => {
                iframeRefs.current[item.id] = node;
              }}
              className="fullscreen-preview__frame"
              title={`${item.label} fullscreen preview`}
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
          </section>
        ))}
      </div>
    </div>
  );
});

export default FullscreenPreview;
