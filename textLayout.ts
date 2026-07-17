/**
 * Laying out caption text.
 *
 * This is the part that decides whether a meme looks right. Two decisions
 * matter:
 *
 * 1. **Wrapping happens on words, and falls back to characters.** A single word
 *    longer than the box (a URL, a keyboard smash) must still break rather than
 *    run off the edge silently.
 * 2. **Text shrinks to fit its box, it never overflows it.** Captions are placed
 *    in a fixed slot at the top or bottom of the image, and a caption that
 *    spills past the frame is a broken meme. So the layout binary-searches down
 *    from the requested size until the block fits.
 *
 * Measurement is injected rather than taken from a canvas context, which keeps
 * every function here pure and testable in node with a fake measurer.
 */

/** Measures the rendered width of a string at a given font size, in pixels. */
export type Measure = (text: string, fontSize: number) => number;

export interface LayoutOptions {
  maxWidth: number;
  maxHeight: number;
  fontSize: number;
  lineHeight: number;
  uppercase: boolean;
  /** Never shrink below this. Below ~8px the outline eats the glyph anyway. */
  minFontSize?: number;
}

export interface TextLayout {
  lines: string[];
  /** The size actually used, which may be smaller than the one requested. */
  fontSize: number;
  /** Total block height: lines * fontSize * lineHeight. */
  height: number;
  /** Width of the widest line. */
  width: number;
  /** True when the text had to shrink to fit. */
  didShrink: boolean;
}

/** Split a single over-long word into chunks that each fit `maxWidth`. */
function breakWord(
  word: string,
  maxWidth: number,
  fontSize: number,
  measure: Measure,
): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const char of word) {
    const candidate = current + char;
    if (current && measure(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Wrap `text` to `maxWidth` at a fixed font size.
 *
 * Explicit newlines in the source are honoured as hard breaks -- people use
 * them to control the shape of a caption, and silently re-flowing them would
 * throw that away.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate, fontSize) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }

      if (measure(line, fontSize) > maxWidth) {
        const chunks = breakWord(line, maxWidth, fontSize, measure);
        lines.push(...chunks.slice(0, -1));
        line = chunks[chunks.length - 1] ?? "";
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

/**
 * Lay out text so it fits inside its box, shrinking the font if it must.
 *
 * The search is linear-descending rather than a binary search on purpose:
 * wrapping is not monotonic in font size (a smaller size can produce *more*
 * lines once a word re-flows), so a binary search can settle on a size that
 * does not actually fit. Stepping down 1px at a time from the requested size is
 * a handful of extra measure calls and is always correct.
 */
export function layoutText(
  text: string,
  options: LayoutOptions,
  measure: Measure,
): TextLayout {
  const source = options.uppercase ? text.toUpperCase() : text;
  const floor = options.minFontSize ?? 8;
  const requested = Math.max(options.fontSize, floor);

  for (let size = requested; size >= floor; size -= 1) {
    const lines = wrapText(source, options.maxWidth, size, measure);
    const height = lines.length * size * options.lineHeight;
    if (height <= options.maxHeight || size === floor) {
      const width = lines.reduce(
        (widest, line) => Math.max(widest, measure(line, size)),
        0,
      );
      return {
        lines,
        fontSize: size,
        height,
        width,
        didShrink: size < requested,
      };
    }
  }

  // Unreachable: the loop above always returns at `floor`. Kept so the function
  // is total rather than relying on the reader to prove the loop terminates.
  return { lines: [source], fontSize: floor, height: floor, width: 0, didShrink: true };
}

/** The x coordinate to draw a line at, for a given alignment. */
export function alignX(
  align: "left" | "center" | "right",
  boxX: number,
  boxWidth: number,
): number {
  if (align === "left") return boxX;
  if (align === "right") return boxX + boxWidth;
  return boxX + boxWidth / 2;
}
