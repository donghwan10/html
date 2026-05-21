export type PreviewFrameId = "primary" | "secondary";

export type PreviewScrollSnapshots = Partial<Record<PreviewFrameId, PreviewScrollSnapshot>>;

export interface PreviewScrollSnapshot {
  left: number;
  top: number;
  maxLeft: number;
  maxTop: number;
  leftRatio: number;
  topRatio: number;
}

export function getPreviewScroller(doc: Document): HTMLElement | null {
  return (doc.scrollingElement ?? doc.documentElement ?? doc.body) as HTMLElement | null;
}

export function snapshotScrollElement(scroller: HTMLElement): PreviewScrollSnapshot {
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  return {
    left: scroller.scrollLeft,
    top: scroller.scrollTop,
    maxLeft,
    maxTop,
    leftRatio: maxLeft > 0 ? scroller.scrollLeft / maxLeft : 0,
    topRatio: maxTop > 0 ? scroller.scrollTop / maxTop : 0
  };
}

export function applyScrollSnapshotToElement(scroller: HTMLElement, snapshot: PreviewScrollSnapshot): void {
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  scroller.scrollLeft = maxLeft === snapshot.maxLeft ? snapshot.left : Math.round(snapshot.leftRatio * maxLeft);
  scroller.scrollTop = maxTop === snapshot.maxTop ? snapshot.top : Math.round(snapshot.topRatio * maxTop);
}

export function readIframeScroll(iframe: HTMLIFrameElement | null): PreviewScrollSnapshot | null {
  try {
    const doc = iframe?.contentDocument;
    const scroller = doc ? getPreviewScroller(doc) : null;
    return scroller ? snapshotScrollElement(scroller) : null;
  } catch {
    return null;
  }
}

export function restoreIframeScroll(
  iframe: HTMLIFrameElement | null,
  snapshot: PreviewScrollSnapshot | undefined
): void {
  if (!snapshot) {
    return;
  }

  try {
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win) {
      return;
    }

    const applyScroll = (): void => {
      const scroller = getPreviewScroller(doc);
      if (scroller) {
        applyScrollSnapshotToElement(scroller, snapshot);
      }
    };

    win.requestAnimationFrame(() => {
      applyScroll();
      win.requestAnimationFrame(applyScroll);
      win.setTimeout(applyScroll, 60);
    });
  } catch {
    // Trusted mode may be cross-origin from the app shell.
  }
}
