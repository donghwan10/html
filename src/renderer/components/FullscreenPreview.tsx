import { X } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useRef } from "react";
import IconButton from "./IconButton";

interface FullscreenPreviewProps {
  previewDocumentHtml: string;
  previewUrl: string | null;
  sandbox: string;
  previewZoom: number;
  onClose: () => void;
}

export default function FullscreenPreview({
  previewDocumentHtml,
  previewUrl,
  sandbox,
  previewZoom,
  onClose
}: FullscreenPreviewProps): ReactElement {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const zoomScale = previewZoom / 100;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const attachDoubleClick = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.ondblclick = onClose;
      }
    } catch {
      // Trusted mode is intentionally cross-origin from the app shell.
    }
  }, [onClose]);

  return (
    <div className="fullscreen-preview" role="dialog" aria-modal="true" aria-label="Fullscreen preview">
      <div className="fullscreen-preview__bar">
        <span>Preview / Zoom {previewZoom}%</span>
        <IconButton icon={<X size={18} />} label="Close" onClick={onClose} />
      </div>
      <div className="fullscreen-preview__viewport">
        <iframe
          ref={iframeRef}
          className="fullscreen-preview__frame"
          title="Fullscreen preview"
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
  );
}
