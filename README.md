# MemeForge

**Paste an image. Caption it. Export a PNG.**

![React 18](https://img.shields.io/badge/react-18-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A meme editor that opens instantly and gets out of the way. No account, no
upload, no watermark, no cookie banner. Your image never leaves your machine —
everything runs in the browser on a `<canvas>`, and the only network request the
app makes is for a font.

The whole loop is: screenshot → <kbd>Ctrl</kbd>+<kbd>V</kbd> → type → <kbd>Ctrl</kbd>+<kbd>S</kbd>.

---

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints. Build for production with `npm run build`; the
output in `dist/` is static and can be dropped on any host.

## What it does

- **Three ways in.** Paste from the clipboard, drag a file onto the window, or
  pick one. Paste is the one that matters — screenshot and caption without ever
  touching your filesystem.
- **Real image-macro captions.** Anton (Impact's free twin), white fill, black
  outline, forced uppercase, top and bottom slots — the look people actually
  expect, correct by default rather than after ten minutes of fiddling.
- **Text that fits.** Captions shrink to stay inside their box. A caption that
  runs off the edge of the frame is a broken meme, so the layout engine simply
  does not allow it.
- **Layers.** Stack images and captions, reorder, hide, duplicate, delete. Drag
  anything on the canvas, including rotated things.
- **Undo everything.** 60 steps deep. Selection isn't an edit, so undo always
  undoes your last *change*, not your last click.
- **Export at full resolution.** The preview is scaled down with CSS but rendered
  at native size, and the exporter reuses the exact same draw code — what you see
  is what you download, always.

## Shortcuts

| Key | Does |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Paste an image |
| <kbd>T</kbd> | New caption |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate layer |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Undo / redo |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Export PNG |
| Arrows | Nudge 1px (<kbd>Shift</kbd> for 10) |
| <kbd>Delete</kbd> | Delete layer |
| <kbd>Esc</kbd> | Deselect |

Shortcuts never fire while you're typing in a field — the single most common way
this goes wrong in editors.

## How it's built

Every file sits at the repository root — a flat layout, so the project can be
uploaded through a browser without folder support. The grouping below is
conceptual rather than structural:

```
types.ts              The shape of a meme. A scene is a size plus a layer stack.

reducer.ts            Every possible change, as one pure function.
history.ts            Undo/redo as a reducer wrapper, framework-agnostic.
EditorContext.tsx     One context, one reducer, one image cache.

textLayout.ts         Wrapping and shrink-to-fit. Pure; measurement injected.
renderScene.ts        Canvas drawing. Shared by preview and export.

useImageInput.ts      Paste, drag-and-drop, file picker.
useShortcuts.ts       Keyboard.

App.tsx               Layout shell.
Toolbar.tsx           Top bar.
Stage.tsx             The canvas and pointer dragging.
Inspector.tsx         Controls for the selected layer.
LayerList.tsx         The layer stack.
EmptyState.tsx        What you see before there is a meme.

geometry.ts           Hit-testing rotated rects.
id.ts                 Layer ids.
download.ts           Saving files.
styles.css            The design system.
```

Two rules hold the thing together:

**The reducer owns every decision about what a meme is.** What a fresh caption
looks like, where the top slot sits, what happens to the canvas when you drop in
an image — all of it lives in one pure function. Components dispatch intent and
never construct a layer themselves. That's why undo, redo, and scene
serialisation all work without special cases: they're the same problem.

**Rendering has exactly one code path.** `renderScene` draws the preview and the
export. The export just hands it a bigger offscreen canvas and a scale factor.
Two draw paths is how you end up with a preview that lies to you.

### Details that took the longest to get right

- **Stroke before fill, round joins.** Stroking after the fill eats into the
  letterform; a miter join grows spikes on tight corners at heavy stroke widths.
  Both are the tells of a meme made in a tool that didn't think about it.
- **Shrink-to-fit steps down, it doesn't binary-search.** Wrapping isn't
  monotonic in font size — a *smaller* size can produce *more* lines once a word
  re-flows — so a binary search can settle on a size that doesn't actually fit.
- **Drag counting for `dragleave`.** That event fires for every child element the
  cursor crosses, so the drop zone counts enters and leaves rather than trusting
  a single event.
- **`useLayoutEffect` for painting.** Drawing after the browser has composited
  gives you a one-frame flash of the previous scene.

## Testing

```bash
npm test
```

53 tests, no DOM required. The layout tests inject a fake measurer where every
glyph is half an em wide — not how real fonts work, but it makes the arithmetic
checkable by hand, which is what you want when testing a wrapping algorithm.
Real font metrics are the canvas's problem, not this module's.

## Design

The palette is lifted from where image macros actually grew up: the lavender-blue
chrome of an imageboard (`#EEF2FF` / `#D6DAF0`), its hairline post borders, and
its one loud red (`#DD0000`). It's an artifact of the subject rather than
generic editor grey, and it lets the canvas — the only thing on screen with
photographic colour in it — be the loudest object by a mile.

Anton carries the display role because Anton *is* the meme voice. The wordmark is
stroked white-on-black: the app's own name gets the same treatment as the
captions it makes. That's the one place boldness is spent; everything else stays
quiet.

## License

MIT — see [LICENSE](LICENSE).
