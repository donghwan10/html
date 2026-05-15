import { describe, expect, it } from "vitest";
import { normalizeInput, resolveInputMode } from "../src/renderer/lib/normalizeInput";

describe("normalizeInput", () => {
  it("unwraps a single full fenced block", () => {
    expect(normalizeInput("```html\n<section>Hello</section>\n```")).toBe("<section>Hello</section>");
  });

  it("keeps nested markdown fences when the whole input is not one wrapper", () => {
    const input = "# Title\n\n```html\n<div>inside</div>\n```";
    expect(normalizeInput(input)).toBe(input);
  });
});

describe("resolveInputMode", () => {
  it("honors explicit modes", () => {
    expect(resolveInputMode("# Hello", "html")).toBe("html");
    expect(resolveInputMode("<h1>Hello</h1>", "markdown")).toBe("markdown");
  });

  it("detects document-like HTML", () => {
    expect(resolveInputMode("<!doctype html><html><body>Hi</body></html>", "auto")).toBe("html");
  });

  it("uses repeated HTML block tags as an HTML signal", () => {
    expect(resolveInputMode("<section><h2>Hello</h2></section>", "auto")).toBe("html");
  });

  it("detects clarifying block tags used in reader content", () => {
    expect(resolveInputMode("<blockquote>Note</blockquote><hr>", "auto")).toBe("html");
    expect(resolveInputMode("<main><figure>Chart</figure></main>", "auto")).toBe("html");
  });

  it("falls back to markdown for ordinary prose", () => {
    expect(resolveInputMode("# Hello\n\n- one\n- two", "auto")).toBe("markdown");
  });
});
