import { describe, expect, it, vi } from "vitest";
import { buildDoublePreviewDocument } from "../src/renderer/lib/doublePreviewDocument";
import { activateFindMatch, cleanupFindHighlights, highlightFindMatches } from "../src/renderer/lib/previewFind";
import { applyScrollSnapshotToElement, snapshotScrollElement } from "../src/renderer/lib/previewScroll";
import { defaultPreviewSettings, loadPreviewSettings } from "../src/renderer/lib/settingsStore";

function setElementMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; clientWidth: number; scrollHeight: number; scrollWidth: number }
): void {
  Object.defineProperty(element, "clientHeight", { configurable: true, value: metrics.clientHeight });
  Object.defineProperty(element, "clientWidth", { configurable: true, value: metrics.clientWidth });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: metrics.scrollWidth });
}

describe("preview settings defaults", () => {
  it("keeps double mode disabled by default", () => {
    localStorage.clear();

    expect(defaultPreviewSettings.doubleMode).toBe(false);
    expect(loadPreviewSettings().doubleMode).toBe(false);
  });
});

describe("double preview document", () => {
  it("includes both sides in the combined export document", () => {
    const html = buildDoublePreviewDocument({
      items: [
        { label: "Left", html: "<p>Left content</p>" },
        { label: "Right", html: "<p>Right content</p>" }
      ],
      title: "Double",
      themeMode: "light",
      previewMode: "safe-reader"
    });

    expect(html).toContain("double-preview-export");
    expect(html).toContain("Left content");
    expect(html).toContain("Right content");
  });
});

describe("preview find helper", () => {
  it("highlights matches, activates a result, and cleans up marks", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    document.body.innerHTML = "<p>Hello hello</p><script>Hello</script>";

    const marks = highlightFindMatches(document, "hello");
    const result = activateFindMatch(marks, 1);

    expect(marks).toHaveLength(2);
    expect(result).toEqual({ currentIndex: 1, total: 2 });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("mark[data-preview-find]")).toHaveLength(2);
    expect(document.querySelectorAll("mark[data-preview-find-current='true']")).toHaveLength(1);

    cleanupFindHighlights(document);

    expect(document.querySelectorAll("mark[data-preview-find]")).toHaveLength(0);
    expect(document.body.textContent).toContain("Hello hello");
  });
});

describe("preview scroll helper", () => {
  it("restores by absolute position when dimensions match and by ratio when they change", () => {
    const element = document.createElement("div");
    setElementMetrics(element, {
      clientHeight: 600,
      clientWidth: 300,
      scrollHeight: 1000,
      scrollWidth: 700
    });
    element.scrollTop = 100;
    element.scrollLeft = 80;

    const snapshot = snapshotScrollElement(element);

    expect(snapshot.topRatio).toBe(0.25);
    expect(snapshot.leftRatio).toBe(0.2);

    element.scrollTop = 0;
    element.scrollLeft = 0;
    applyScrollSnapshotToElement(element, snapshot);

    expect(element.scrollTop).toBe(100);
    expect(element.scrollLeft).toBe(80);

    setElementMetrics(element, {
      clientHeight: 600,
      clientWidth: 300,
      scrollHeight: 1800,
      scrollWidth: 1100
    });
    element.scrollTop = 0;
    element.scrollLeft = 0;
    applyScrollSnapshotToElement(element, snapshot);

    expect(element.scrollTop).toBe(300);
    expect(element.scrollLeft).toBe(160);
  });
});
