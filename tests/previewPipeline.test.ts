import { describe, expect, it } from "vitest";
import { buildPreviewDocument, getPreviewCsp } from "../src/renderer/lib/buildPreviewDocument";
import { createPreviewPipeline } from "../src/renderer/lib/previewPipeline";
import { countVisibleCharacters, htmlToVisibleText } from "../src/renderer/lib/previewTextStats";
import { defaultPreviewSettings } from "../src/renderer/lib/settingsStore";

describe("buildPreviewDocument", () => {
  it("includes a restrictive CSP and reader shell", () => {
    const html = buildPreviewDocument({
      contentHtml: "<h1>Hello</h1>",
      settings: defaultPreviewSettings,
      title: "Test"
    });

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("img-src data:");
    expect(html).toContain('class="reader-shell"');
  });

  it("only adds https image loading when remote images are enabled", () => {
    expect(getPreviewCsp({ allowRemoteImages: false })).toContain("img-src data:");
    expect(getPreviewCsp({ allowRemoteImages: true })).toContain("img-src data: https:");
  });

  it("applies custom brightness variables in reader mode", () => {
    const html = buildPreviewDocument({
      contentHtml: "<p>Hello</p>",
      settings: { ...defaultPreviewSettings, themeMode: "custom", customBrightness: 30 },
      title: "Custom"
    });

    expect(html).toContain('class="theme-custom"');
    expect(html).toContain("color-scheme: dark");
    expect(html).toContain("--reader-bg:");
  });

  it("emits custom reader controls as CSS variables and feature classes", () => {
    const html = buildPreviewDocument({
      contentHtml: "<h1>Hello</h1><p>Readable text</p><pre><code>const value = 1;</code></pre>",
      settings: {
        ...defaultPreviewSettings,
        themeMode: "light",
        contentPadding: 58,
        fontWeight: 700,
        letterSpacing: 0.5,
        wordSpacing: 2,
        paragraphSpacing: 1.4,
        paragraphIndent: 1.2,
        textAlign: "justify",
        textColor: "#223344",
        headingScale: 1.2,
        codeWrap: true,
        highContrast: true,
        koreanLineBreak: true
      },
      title: "Custom reader"
    });

    expect(html).toContain('class="theme-light contrast-high korean-line-break code-wrap"');
    expect(html).toContain("--reader-padding: 58px;");
    expect(html).toContain("--reader-weight: 700;");
    expect(html).toContain("--reader-letter: 0.5px;");
    expect(html).toContain("--reader-word: 2px;");
    expect(html).toContain("--reader-paragraph-spacing: 1.4em;");
    expect(html).toContain("--reader-indent: 1.2em;");
    expect(html).toContain("--reader-align: justify;");
    expect(html).toContain("--reader-heading-scale: 1.2;");
    expect(html).toContain("--reader-text: #223344;");
    expect(html).toContain("html.code-wrap pre");
    expect(html).toContain("html.korean-line-break .reader-shell");
    expect(html).toContain("html.contrast-high");
  });
});

describe("createPreviewPipeline", () => {
  it("converts markdown, sanitizes output, and builds a full document", () => {
    const result = createPreviewPipeline(
      "# Hello\n\n<script>alert(1)</script>\n\n- one",
      "markdown",
      defaultPreviewSettings,
      "Doc"
    );

    expect(result.resolvedMode).toBe("markdown");
    expect(result.sanitizedHtml).toContain("<h1>Hello</h1>");
    expect(result.sanitizedHtml).not.toContain("<script");
    expect(result.previewDocumentHtml).toContain("<!doctype html>");
  });
});

describe("preview text stats", () => {
  it("counts rendered text without tags, CSS, scripts, or templates", () => {
    const html = `<article>
      <h1>안녕</h1>
      <style>body { color: red; }</style>
      <script>window.secret = "hidden";</script>
      <template>hidden template</template>
      <noscript>hidden noscript</noscript>
      <p>Hello <strong>world</strong></p>
    </article>`;

    expect(htmlToVisibleText(html)).toBe("안녕 Hello world");
    expect(countVisibleCharacters(html)).toBe(14);
  });

  it("normalizes whitespace and counts grapheme clusters", () => {
    expect(htmlToVisibleText("<p>A&nbsp;&nbsp;B</p><p>한글 👨‍👩‍👧‍👦</p>")).toBe("A B 한글 👨‍👩‍👧‍👦");
    expect(countVisibleCharacters("<p>A&nbsp;&nbsp;B</p><p>한글 👨‍👩‍👧‍👦</p>")).toBe(8);
  });
});
