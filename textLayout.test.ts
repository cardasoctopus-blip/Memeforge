/**
 * Text layout tests.
 *
 * The measurer is faked: every character is a fixed fraction of the font size.
 * That is not how real fonts work, but it makes the arithmetic checkable by
 * hand, which is exactly what you want when testing a wrapping algorithm. The
 * real font metrics are the canvas's problem, not this module's.
 */

import { describe, expect, it } from "vitest";

import { alignX, layoutText, wrapText, type Measure } from "./textLayout";

/** Every glyph is half an em wide. A 10px font makes "abcd" 20px. */
const measure: Measure = (text, fontSize) => text.length * fontSize * 0.5;

describe("wrapText", () => {
  it("keeps a short line on one line", () => {
    expect(wrapText("hi", 100, 10, measure)).toEqual(["hi"]);
  });

  it("wraps on word boundaries", () => {
    // Each word is 20px at size 10; a 50px box fits two words plus a space.
    const lines = wrapText("aaaa bbbb cccc dddd", 50, 10, measure);
    expect(lines).toEqual(["aaaa bbbb", "cccc dddd"]);
  });

  it("honours explicit newlines as hard breaks", () => {
    expect(wrapText("one\ntwo", 1000, 10, measure)).toEqual(["one", "two"]);
  });

  it("preserves empty lines between paragraphs", () => {
    expect(wrapText("a\n\nb", 1000, 10, measure)).toEqual(["a", "", "b"]);
  });

  it("breaks a single word that cannot fit", () => {
    const lines = wrapText("aaaaaaaaaa", 25, 10, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measure(line, 10)).toBeLessThanOrEqual(25);
    }
  });

  it("collapses runs of whitespace", () => {
    expect(wrapText("a     b", 1000, 10, measure)).toEqual(["a b"]);
  });

  it("never exceeds the box width", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    for (const width of [40, 80, 120, 200]) {
      for (const line of wrapText(text, width, 12, measure)) {
        expect(measure(line, 12)).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe("layoutText", () => {
  const base = {
    maxWidth: 100,
    maxHeight: 100,
    fontSize: 20,
    lineHeight: 1,
    uppercase: false,
  };

  it("keeps the requested size when it fits", () => {
    const layout = layoutText("hi", base, measure);
    expect(layout.fontSize).toBe(20);
    expect(layout.didShrink).toBe(false);
  });

  it("shrinks text that would overflow its box", () => {
    const layout = layoutText(
      "one two three four five six seven eight nine ten eleven twelve",
      { ...base, maxHeight: 30 },
      measure,
    );
    expect(layout.didShrink).toBe(true);
    expect(layout.fontSize).toBeLessThan(20);
    expect(layout.height).toBeLessThanOrEqual(30);
  });

  it("never overflows the box height, across many inputs", () => {
    const texts = [
      "short",
      "a somewhat longer caption here",
      "WHEN YOU FINALLY FIX THE BUG AND IT WAS A TYPO ALL ALONG",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ];
    for (const text of texts) {
      const layout = layoutText(text, { ...base, maxHeight: 40 }, measure);
      // At the floor size the text is allowed to be taller than the box --
      // that is the documented escape hatch. Anything above the floor must fit.
      if (layout.fontSize > 8) {
        expect(layout.height).toBeLessThanOrEqual(40);
      }
    }
  });

  it("applies uppercase before measuring", () => {
    const layout = layoutText("shout", { ...base, uppercase: true }, measure);
    expect(layout.lines).toEqual(["SHOUT"]);
  });

  it("leaves case alone when uppercase is off", () => {
    expect(layoutText("quiet", base, measure).lines).toEqual(["quiet"]);
  });

  it("refuses to go below the floor size", () => {
    const layout = layoutText(
      "an extremely long caption that could never fit in a box this small",
      { ...base, maxWidth: 20, maxHeight: 10, minFontSize: 8 },
      measure,
    );
    expect(layout.fontSize).toBe(8);
  });

  it("reports the width of the widest line", () => {
    const layout = layoutText("aa\nbbbb", { ...base, maxWidth: 1000 }, measure);
    expect(layout.width).toBe(measure("bbbb", 20));
  });

  it("handles empty text without throwing", () => {
    expect(() => layoutText("", base, measure)).not.toThrow();
  });
});

describe("alignX", () => {
  it("anchors left at the box edge", () => {
    expect(alignX("left", 10, 100)).toBe(10);
  });

  it("anchors centre at the midpoint", () => {
    expect(alignX("center", 10, 100)).toBe(60);
  });

  it("anchors right at the far edge", () => {
    expect(alignX("right", 10, 100)).toBe(110);
  });
});
