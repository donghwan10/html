import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

const splitKey = "llm-html-previewer:split:v1";
const leftCollapsedKey = "llm-html-previewer:left-collapsed:v1";

function loadSplit(): number {
  const raw = localStorage.getItem(splitKey);
  if (raw === null) {
    return 42;
  }
  const saved = Number(raw);
  return Number.isFinite(saved) ? Math.max(30, Math.min(70, saved)) : 42;
}

function loadLeftCollapsed(): boolean {
  return localStorage.getItem(leftCollapsedKey) === "true";
}

export default function SplitLayout({ left, right }: SplitLayoutProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [split, setSplit] = useState(loadSplit);
  const [dragging, setDragging] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(loadLeftCollapsed);

  useEffect(() => {
    localStorage.setItem(splitKey, String(split));
  }, [split]);

  useEffect(() => {
    localStorage.setItem(leftCollapsedKey, String(leftCollapsed));
  }, [leftCollapsed]);

  useEffect(() => {
    if (!dragging || leftCollapsed) {
      return undefined;
    }

    const onPointerMove = (event: PointerEvent): void => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }
      const nextSplit = ((event.clientX - bounds.left) / bounds.width) * 100;
      setSplit(Math.max(30, Math.min(70, nextSplit)));
    };

    const onPointerUp = (): void => setDragging(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, leftCollapsed]);

  return (
    <div
      className={`split-layout ${dragging ? "split-layout--dragging" : ""} ${
        leftCollapsed ? "split-layout--left-collapsed" : ""
      }`}
      ref={containerRef}
      style={{ gridTemplateColumns: leftCollapsed ? "0 28px minmax(0, 1fr)" : `${split}% 28px minmax(0, 1fr)` }}
    >
      <section className="pane pane--editor" aria-hidden={leftCollapsed}>
        {left}
      </section>
      <div className="split-layout__rail">
        {!leftCollapsed ? (
          <button
            className="split-layout__handle"
            type="button"
            aria-label="입력 너비 조정"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={70}
            aria-valuenow={Math.round(split)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
          />
        ) : null}
        <button
          className="split-layout__collapse-toggle"
          type="button"
          aria-label={leftCollapsed ? "입력 펼치기" : "입력 숨기기"}
          title={leftCollapsed ? "입력 펼치기" : "입력 숨기기"}
          onClick={() => setLeftCollapsed((collapsed) => !collapsed)}
        >
          {leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
      <section className="pane pane--preview">{right}</section>
    </div>
  );
}
