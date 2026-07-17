/**
 * The canvas, and everything you can do by pointing at it.
 *
 * The canvas is sized in scene pixels and scaled down with CSS to fit the
 * viewport, which means the preview is always rendered at full resolution and
 * simply displayed smaller. Pointer coordinates are converted back through the
 * same ratio, so a drag moves the layer exactly as far as the cursor went
 * regardless of zoom or display density.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { hitTest } from "./geometry";
import { renderScene } from "./renderScene";
import { useEditor } from "./EditorContext";
import type { Vec2 } from "./types";
import { EmptyState } from "./EmptyState";

export function Stage({ isDragging }: { isDragging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { state, dispatch, images, cacheImage } = useEditor();
  const { scene, selectedId } = state;

  const [displayScale, setDisplayScale] = useState(1);
  const dragOrigin = useRef<Vec2 | null>(null);

  // Any image layer whose bitmap has not been decoded yet would render as a
  // hole, so make sure the cache is warm before drawing.
  useEffect(() => {
    const missing = scene.layers.filter(
      (layer) => layer.kind === "image" && !images.has(layer.src),
    );
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((layer) => cacheImage((layer as { src: string }).src).catch(() => null)),
    ).then(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) renderScene(ctx, scene, images, { selectedId });
    });
  }, [scene, images, cacheImage, selectedId]);

  // useLayoutEffect, not useEffect: painting after the browser has already
  // composited produces a visible one-frame flash of the previous scene.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    renderScene(ctx, scene, images, { selectedId });
  }, [scene, images, selectedId]);

  // Fit the canvas to whatever space the frame has, without ever upscaling.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const fit = () => {
      const bounds = frame.getBoundingClientRect();
      const scale = Math.min(
        (bounds.width - 32) / scene.width,
        (bounds.height - 32) / scene.height,
        1,
      );
      setDisplayScale(Math.max(scale, 0.05));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [scene.width, scene.height]);

  const toScene = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * scene.width,
        y: ((event.clientY - rect.top) / rect.height) * scene.height,
      };
    },
    [scene.width, scene.height],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = toScene(event);
      // Front to back: the layer you can see is the layer you meant to grab.
      const hit = [...scene.layers]
        .reverse()
        .find((layer) => layer.visible && !layer.locked && hitTest(point, layer, layer.rotation));

      dispatch({ type: "select", id: hit?.id ?? null });
      if (!hit) return;

      dragOrigin.current = point;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [dispatch, scene.layers, toScene],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragOrigin.current || !selectedId) return;
      const point = toScene(event);
      dispatch({
        type: "moveLayerBy",
        id: selectedId,
        dx: point.x - dragOrigin.current.x,
        dy: point.y - dragOrigin.current.y,
      });
      dragOrigin.current = point;
    },
    [dispatch, selectedId, toScene],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    dragOrigin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const isEmpty = scene.layers.length === 0;

  return (
    <div className="stage" ref={frameRef} data-dropping={isDragging || undefined}>
      {isEmpty && <EmptyState />}
      <canvas
        ref={canvasRef}
        className="stage__canvas"
        width={scene.width}
        height={scene.height}
        style={{
          width: scene.width * displayScale,
          height: scene.height * displayScale,
          display: isEmpty ? "none" : "block",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      {!isEmpty && (
        <p className="stage__meta">
          {scene.width} × {scene.height}
          {displayScale < 1 && <span> · shown at {Math.round(displayScale * 100)}%</span>}
        </p>
      )}
      {isDragging && <div className="stage__dropzone">Drop to load</div>}
    </div>
  );
}
