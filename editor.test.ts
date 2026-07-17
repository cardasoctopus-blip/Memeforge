/**
 * Tests for the parts that decide what a meme is: the reducer, the undo stack,
 * and the geometry that turns a click into a selection.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { centreOf, clamp, fitInside, hitTest, rotatePoint } from "./geometry";
import { resetIdCounter } from "./id";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  withHistory,
} from "./history";
import {
  createTextLayer,
  initialState,
  reducer,
  slotRect,
  TRANSIENT_ACTIONS,
  type Action,
} from "./reducer";
import type { EditorState, TextLayer } from "./types";

const NATURAL = { width: 640, height: 480 };

function withBase(): EditorState {
  return reducer(initialState, { type: "loadBase", src: "blob:base", natural: NATURAL });
}

beforeEach(() => resetIdCounter());

describe("geometry", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("finds the centre of a rect", () => {
    expect(centreOf({ x: 0, y: 0, width: 100, height: 50 })).toEqual({ x: 50, y: 25 });
  });

  it("rotating by 360 degrees is identity", () => {
    const point = { x: 10, y: 20 };
    const spun = rotatePoint(point, { x: 0, y: 0 }, 360);
    expect(spun.x).toBeCloseTo(10);
    expect(spun.y).toBeCloseTo(20);
  });

  it("rotates 90 degrees clockwise in screen space", () => {
    const spun = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(spun.x).toBeCloseTo(0);
    expect(spun.y).toBeCloseTo(1);
  });

  it("hit-tests an axis-aligned rect", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(hitTest({ x: 50, y: 50 }, rect)).toBe(true);
    expect(hitTest({ x: 150, y: 50 }, rect)).toBe(false);
  });

  it("hit-tests a rotated rect", () => {
    // A 100x20 bar. Rotated 90 degrees about its centre (50,10) it becomes a
    // vertical bar spanning x 40..60 and y -40..60.
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    // Was inside the horizontal bar, is outside the vertical one.
    expect(hitTest({ x: 90, y: 10 }, rect, 90)).toBe(false);
    // Was outside the horizontal bar, is inside the vertical one.
    expect(hitTest({ x: 50, y: 50 }, rect, 90)).toBe(true);
    // Well past the end of the rotated bar.
    expect(hitTest({ x: 50, y: 90 }, rect, 90)).toBe(false);
  });

  it("the centre is always inside, whatever the rotation", () => {
    const rect = { x: 20, y: 30, width: 80, height: 40 };
    for (const angle of [0, 17, 45, 90, 180, -33]) {
      expect(hitTest(centreOf(rect), rect, angle)).toBe(true);
    }
  });

  it("fits a large source inside bounds without upscaling a small one", () => {
    expect(fitInside({ width: 2000, height: 1000 }, { width: 500, height: 500 })).toEqual({
      width: 500,
      height: 250,
    });
    expect(fitInside({ width: 100, height: 100 }, { width: 500, height: 500 })).toEqual({
      width: 100,
      height: 100,
    });
  });
});

describe("reducer: loading images", () => {
  it("a base image sets the canvas to its natural size", () => {
    const state = withBase();
    expect(state.scene.width).toBe(640);
    expect(state.scene.height).toBe(480);
    expect(state.scene.layers).toHaveLength(1);
    expect(state.scene.layers[0].name).toBe("Base image");
  });

  it("a second base image replaces the first, not stacks on it", () => {
    const once = withBase();
    const twice = reducer(once, {
      type: "loadBase",
      src: "blob:other",
      natural: { width: 100, height: 100 },
    });
    expect(twice.scene.layers.filter((l) => l.name === "Base image")).toHaveLength(1);
    expect(twice.scene.width).toBe(100);
  });

  it("added images land on top and keep their aspect ratio", () => {
    const state = reducer(withBase(), {
      type: "addImage",
      src: "blob:sticker",
      natural: { width: 200, height: 100 },
    });
    const layer = state.scene.layers[state.scene.layers.length - 1];
    expect(layer.kind).toBe("image");
    expect(layer.width / layer.height).toBeCloseTo(2);
  });

  it("an oversized image is scaled down to fit the canvas", () => {
    const state = reducer(withBase(), {
      type: "addImage",
      src: "blob:huge",
      natural: { width: 4000, height: 3000 },
    });
    const layer = state.scene.layers[state.scene.layers.length - 1];
    expect(layer.width).toBeLessThanOrEqual(640);
    expect(layer.height).toBeLessThanOrEqual(480);
  });
});

describe("reducer: captions", () => {
  it("adds a free caption and selects it", () => {
    const state = reducer(withBase(), { type: "addText" });
    expect(state.scene.layers).toHaveLength(2);
    expect(state.selectedId).toBe(state.scene.layers[1].id);
  });

  it("classic captions add exactly top and bottom", () => {
    const state = reducer(withBase(), { type: "addClassicCaptions" });
    const slots = state.scene.layers
      .filter((l): l is TextLayer => l.kind === "text")
      .map((l) => l.slot);
    expect(slots.sort()).toEqual(["bottom", "top"]);
  });

  it("classic captions do not duplicate slots that already exist", () => {
    const once = reducer(withBase(), { type: "addClassicCaptions" });
    const twice = reducer(once, { type: "addClassicCaptions" });
    expect(twice).toBe(once);
  });

  it("a top caption sits above a bottom caption", () => {
    const scene = { width: 640, height: 480 };
    expect(slotRect(scene, "top").y).toBeLessThan(slotRect(scene, "bottom").y);
  });

  it("slotted captions stay in their slot when the canvas resizes", () => {
    const withCaptions = reducer(withBase(), { type: "addClassicCaptions" });
    const resized = reducer(withCaptions, {
      type: "setSceneSize",
      width: 1000,
      height: 1000,
    });
    const bottom = resized.scene.layers.find(
      (l): l is TextLayer => l.kind === "text" && l.slot === "bottom",
    );
    expect(bottom).toBeDefined();
    expect(bottom!.y).toBeGreaterThan(700);
  });

  it("a new caption inherits the classic macro look", () => {
    const layer = createTextLayer({ width: 640, height: 480 });
    expect(layer.uppercase).toBe(true);
    expect(layer.color).toBe("#FFFFFF");
    expect(layer.strokeColor).toBe("#000000");
    expect(layer.strokeRatio).toBeGreaterThan(0);
  });
});

describe("reducer: layer operations", () => {
  it("updates a layer by id, leaving others alone", () => {
    const state = reducer(withBase(), { type: "addText" });
    const id = state.scene.layers[1].id;
    const next = reducer(state, { type: "updateLayer", id, patch: { text: "hello" } });
    expect((next.scene.layers[1] as TextLayer).text).toBe("hello");
    expect(next.scene.layers[0]).toBe(state.scene.layers[0]);
  });

  it("deleting the selected layer clears the selection", () => {
    const state = reducer(withBase(), { type: "addText" });
    const id = state.selectedId!;
    const next = reducer(state, { type: "deleteLayer", id });
    expect(next.selectedId).toBeNull();
    expect(next.scene.layers).toHaveLength(1);
  });

  it("duplicating offsets the copy so it is visible", () => {
    const state = reducer(withBase(), { type: "addText" });
    const id = state.selectedId!;
    const next = reducer(state, { type: "duplicateLayer", id });
    const original = next.scene.layers.find((l) => l.id === id)!;
    const copy = next.scene.layers.find((l) => l.id === next.selectedId)!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.x).toBeGreaterThan(original.x);
  });

  it("reordering swaps neighbours and stops at the ends", () => {
    let state = reducer(withBase(), { type: "addText" });
    const topId = state.selectedId!;
    state = reducer(state, { type: "reorderLayer", id: topId, direction: "down" });
    expect(state.scene.layers[0].id).toBe(topId);

    const unchanged = reducer(state, { type: "reorderLayer", id: topId, direction: "down" });
    expect(unchanged).toBe(state);
  });

  it("dragging moves a layer", () => {
    const state = reducer(withBase(), { type: "addText" });
    const id = state.selectedId!;
    const before = state.scene.layers.find((l) => l.id === id)!;
    const after = reducer(state, { type: "moveLayerBy", id, dx: 10, dy: -5 });
    const layer = after.scene.layers.find((l) => l.id === id)!;
    expect(layer.x).toBe(before.x + 10);
    expect(layer.y).toBe(before.y - 5);
  });

  it("dragging a slotted caption detaches it from its slot", () => {
    const state = reducer(withBase(), { type: "addClassicCaptions" });
    const top = state.scene.layers.find(
      (l): l is TextLayer => l.kind === "text" && l.slot === "top",
    )!;
    const moved = reducer(state, { type: "moveLayerBy", id: top.id, dx: 5, dy: 5 });
    const after = moved.scene.layers.find((l) => l.id === top.id) as TextLayer;
    expect(after.slot).toBe("free");
  });

  it("a locked layer cannot be dragged", () => {
    let state = reducer(withBase(), { type: "addText" });
    const id = state.selectedId!;
    state = reducer(state, { type: "updateLayer", id, patch: { locked: true } });
    const after = reducer(state, { type: "moveLayerBy", id, dx: 50, dy: 50 });
    expect(after).toBe(state);
  });

  it("a layer can never be dragged fully out of reach", () => {
    const state = reducer(withBase(), { type: "addText" });
    const id = state.selectedId!;
    const flung = reducer(state, { type: "moveLayerBy", id, dx: 99999, dy: 99999 });
    const layer = flung.scene.layers.find((l) => l.id === id)!;
    expect(layer.x).toBeLessThan(state.scene.width);
    expect(layer.y).toBeLessThan(state.scene.height);
  });
});

describe("history", () => {
  const historyReducer = withHistory<EditorState, Action>(reducer, (action) =>
    TRANSIENT_ACTIONS.has(action.type),
  );
  const edit = (action: Action) => ({ type: "wrapped" as const, action });

  it("starts with nothing to undo", () => {
    const history = createHistory(initialState);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("undo restores the previous state", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    expect(history.present.scene.layers).toHaveLength(1);

    history = historyReducer(history, { type: "undo" });
    expect(history.present.scene.layers).toHaveLength(0);
    expect(canRedo(history)).toBe(true);
  });

  it("redo reapplies an undone edit", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, { type: "redo" });
    expect(history.present.scene.layers).toHaveLength(1);
  });

  it("a new edit discards the redo stack", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, edit({ type: "addText" }));
    expect(canRedo(history)).toBe(false);
  });

  it("selection is not undoable", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    const depth = history.past.length;
    history = historyReducer(history, edit({ type: "select", id: null }));
    expect(history.past.length).toBe(depth);
    expect(history.present.selectedId).toBeNull();
  });

  it("a no-op edit does not burn an undo slot", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    const before = history;
    history = historyReducer(
      history,
      edit({ type: "reorderLayer", id: "nope", direction: "up" }),
    );
    expect(history).toBe(before);
  });

  it("the past is capped", () => {
    let history = createHistory(initialState);
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      history = historyReducer(history, edit({ type: "addText" }));
    }
    expect(history.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });

  it("undo then redo round-trips to the same scene", () => {
    let history = createHistory(initialState);
    history = historyReducer(history, edit({ type: "addText" }));
    history = historyReducer(history, edit({ type: "addClassicCaptions" }));
    const target = history.present;

    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, { type: "redo" });
    expect(history.present).toEqual(target);
  });
});

describe("reducer: purity", () => {
  it("never mutates the state it was given", () => {
    const state = withBase();
    const snapshot = JSON.parse(JSON.stringify(state));
    reducer(state, { type: "addText" });
    reducer(state, { type: "deleteLayer", id: state.scene.layers[0].id });
    reducer(state, { type: "setBackground", color: "#000000" });
    expect(state).toEqual(snapshot);
  });
});
