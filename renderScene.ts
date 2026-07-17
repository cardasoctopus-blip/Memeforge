/**
 * Drawing a scene onto a 2D canvas.
 *
 * The same function renders the on-screen preview and the exported PNG -- the
 * export just passes a bigger canvas and a scale factor. Keeping one code path
 * is the only way to guarantee what you see is what you download.
 */

import type { ImageLayer, Layer, Scene, TextLayer } from "./types";
import { isText } from "./types";
import { alignX, layoutText, type Measure } from "./textLayout";

/** Images already decoded and ready to draw, keyed by layer src. */
export type ImageCache = Map<string, HTMLImageElement>;

export interface RenderOptions {
  /** Multiplier applied to the whole scene. 1 for preview, higher for export. */
  scale?: number;
  /** Draw selection chrome. Never true for export. */
  selectedId?: string | null;
}

function makeMeasure(ctx: CanvasRenderingContext2D, layer: TextLayer): Measure {
  return (text, fontSize) => {
    ctx.font = `${fontSize}px ${layer.fontFamily}`;
    return ctx.measureText(text).width;
  };
}

/**
 * Apply a layer's rotation about its own centre.
 *
 * Callers must have saved the context first; this only sets up the transform.
 */
function applyTransform(ctx: CanvasRenderingContext2D, layer: Layer): void {
  if (!layer.rotation) return;
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  cache: ImageCache,
): void {
  const image = cache.get(layer.src);
  if (!image) return;
  ctx.drawImage(image, layer.x, layer.y, layer.width, layer.height);
}

/**
 * Draw a caption in the classic image-macro treatment.
 *
 * The outline is stroked *before* the fill and with a round join. Stroking
 * after the fill eats into the letterform, and a miter join grows spikes on
 * tight corners at heavy stroke widths -- both are the tells of a meme made in
 * a tool that did not think about it.
 */
function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  if (!layer.text.trim()) return;

  const layout = layoutText(
    layer.text,
    {
      maxWidth: layer.width,
      maxHeight: layer.height,
      fontSize: layer.fontSize,
      lineHeight: layer.lineHeight,
      uppercase: layer.uppercase,
    },
    makeMeasure(ctx, layer),
  );

  ctx.font = `${layout.fontSize}px ${layer.fontFamily}`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const x = alignX(layer.align, layer.x, layer.width);
  const step = layout.fontSize * layer.lineHeight;
  const blockHeight = layout.lines.length * step;
  // Centre the block vertically in its box so a shrunk caption stays put
  // instead of drifting to the top of the slot.
  let y = layer.y + (layer.height - blockHeight) / 2;

  const strokeWidth = layout.fontSize * layer.strokeRatio;

  for (const line of layout.lines) {
    if (layer.shadow) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = layout.fontSize * 0.18;
      ctx.shadowOffsetY = layout.fontSize * 0.06;
      ctx.fillStyle = layer.color;
      ctx.fillText(line, x, y);
      ctx.restore();
    }
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = layer.strokeColor;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(line, x, y);
    y += step;
  }
}

function drawSelection(ctx: CanvasRenderingContext2D, layer: Layer): void {
  ctx.save();
  applyTransform(ctx, layer);
  ctx.strokeStyle = "#DD0000";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
}

/** Draw a whole scene. Clears the canvas first. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cache: ImageCache,
  options: RenderOptions = {},
): void {
  const scale = options.scale ?? 1;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);

  for (const layer of scene.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    applyTransform(ctx, layer);
    if (isText(layer)) {
      drawTextLayer(ctx, layer);
    } else {
      drawImageLayer(ctx, layer, cache);
    }
    ctx.restore();
  }

  if (options.selectedId) {
    const selected = scene.layers.find((l) => l.id === options.selectedId);
    if (selected && selected.visible) drawSelection(ctx, selected);
  }

  ctx.restore();
}

/**
 * Render a scene to a PNG blob at `scale` times its natural size.
 *
 * Uses an offscreen canvas so the export is never affected by the preview's
 * zoom, device pixel ratio, or selection outline.
 */
export async function exportScene(
  scene: Scene,
  cache: ImageCache,
  scale = 1,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(scene.width * scale);
  canvas.height = Math.round(scene.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context for export.");

  renderScene(ctx, scene, cache, { scale, selectedId: null });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the canvas as a PNG."));
    }, "image/png");
  });
}
