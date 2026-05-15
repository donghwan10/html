import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../src/renderer/lib/sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes executable and embedded content", () => {
    const clean = sanitizeHtml(
      `<section>
        <script>alert(1)</script>
        <img src="x" onerror="alert(1)">
        <a href="javascript:alert(1)">bad</a>
        <iframe src="https://example.com"></iframe>
        <link rel="stylesheet" href="https://example.com/style.css">
        <form><input value="x"></form>
      </section>`,
      { allowRemoteImages: false }
    );

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("<link");
    expect(clean).not.toContain("<form");
  });

  it("keeps style while stripping remote CSS references", () => {
    const clean = sanitizeHtml(
      `<style>@import "https://example.com/a.css"; .hero { background: url(https://example.com/a.png); color: red; }</style>
       <p style="background:url(file:///c:/x.png); color: blue">Hi</p>`,
      { allowRemoteImages: false }
    );

    expect(clean).toContain("<style>");
    expect(clean).toContain("color: red");
    expect(clean).toContain("color: blue");
    expect(clean).not.toContain("@import");
    expect(clean).not.toContain("https://example.com");
    expect(clean).not.toContain("file://");
  });

  it("allows data images and blocks remote images by default", () => {
    const dataImage = "data:image/png;base64,AAAA";
    const clean = sanitizeHtml(`<img src="${dataImage}"><img src="https://example.com/a.png">`, {
      allowRemoteImages: false
    });

    expect(clean).toContain(dataImage);
    expect(clean).not.toContain("https://example.com/a.png");
  });

  it("allows https images when enabled", () => {
    const clean = sanitizeHtml(`<img src="https://example.com/a.png"><img src="http://example.com/a.png">`, {
      allowRemoteImages: true
    });

    expect(clean).toContain("https://example.com/a.png");
    expect(clean).not.toContain("http://example.com/a.png");
  });
});
