export interface PreviewFindResult {
  currentIndex: number;
  total: number;
}

const findMarkSelector = "mark[data-preview-find]";
const findStyleAttribute = "data-preview-find-style";

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  return Boolean(parent.closest("script, style, textarea, input, select, option, template, noscript, mark[data-preview-find]"));
}

function ensureFindStyle(doc: Document): void {
  if (doc.head.querySelector(`style[${findStyleAttribute}]`)) {
    return;
  }

  const style = doc.createElement("style");
  style.setAttribute(findStyleAttribute, "true");
  style.textContent = `
    mark[data-preview-find] {
      background: #ffe66d;
      color: #111111;
      padding: 0 0.04em;
    }

    mark[data-preview-find-current="true"] {
      background: #ff8c1a;
      color: #111111;
      outline: 2px solid #111111;
      outline-offset: 1px;
    }
  `;
  doc.head.appendChild(style);
}

export function cleanupFindHighlights(doc: Document): void {
  doc.querySelectorAll(findMarkSelector).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }
    parent.replaceChild(doc.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  });
}

function collectTextNodes(doc: Document): Text[] {
  const nodes: Text[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  return nodes;
}

export function highlightFindMatches(doc: Document, rawQuery: string): HTMLElement[] {
  cleanupFindHighlights(doc);

  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  ensureFindStyle(doc);
  const lowerQuery = query.toLocaleLowerCase();
  const marks: HTMLElement[] = [];

  collectTextNodes(doc).forEach((node) => {
    const text = node.data;
    const lowerText = text.toLocaleLowerCase();
    const ranges: Array<[number, number]> = [];
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
      ranges.push([index, index + query.length]);
      index = lowerText.indexOf(lowerQuery, index + Math.max(1, query.length));
    }

    if (ranges.length === 0 || !node.parentNode) {
      return;
    }

    const fragment = doc.createDocumentFragment();
    let cursor = 0;

    ranges.forEach(([start, end]) => {
      if (start > cursor) {
        fragment.appendChild(doc.createTextNode(text.slice(cursor, start)));
      }

      const mark = doc.createElement("mark");
      mark.dataset.previewFind = "true";
      mark.textContent = text.slice(start, end);
      marks.push(mark);
      fragment.appendChild(mark);
      cursor = end;
    });

    if (cursor < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor)));
    }

    node.parentNode.replaceChild(fragment, node);
  });

  return marks;
}

export function activateFindMatch(marks: HTMLElement[], index: number): PreviewFindResult {
  const total = marks.length;
  if (total === 0) {
    return { currentIndex: -1, total: 0 };
  }

  const currentIndex = ((index % total) + total) % total;

  marks.forEach((mark, markIndex) => {
    if (markIndex === currentIndex) {
      mark.dataset.previewFindCurrent = "true";
      mark.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }
    mark.removeAttribute("data-preview-find-current");
  });

  return { currentIndex, total };
}
