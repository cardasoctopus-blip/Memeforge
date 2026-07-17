/**
 * Every change to a meme, as one pure function.
 *
 * The reducer owns all the rules: what a new caption looks like, where the
 * classic slots sit, what happens to the scene when you drop in an image. React
 * components below only dispatch intent; they never construct a layer
 * themselves. That is what makes undo, redo, and scene files work without
 * special cases.
 */

import { createId } from "./id";
import { clamp } from "./geometry";
import type {
  CaptionSlot,
  EditorState,
  ImageLayer,
  Layer,
  LayerId,
  Scene,
  Size,
  TextLayer,
} from "./types";

export const DEFAULT_SCENE: Scene = {
  width: 800,
  height: 600,
  background: "#FFFFFF",
  layers: [],
};

export const initialState: EditorState = {
  scene: DEFAULT_SCENE,
  selectedId: null,
};

/** The caption look everybody recognises, and expects by default. */
export const CAPTION_PRESET = {
  fontFamily: "'Anton', Impact, 'Haettenschweiler', sans-serif",
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeRatio: 0.09,
  lineHeight: 1.05,
  uppercase: true,
  shadow: false,
} as const;

/** Height of a top/bottom caption slot, as a fraction of the scene. */
const SLOT_HEIGHT = 0.24;
const SLOT_INSET = 0.03;

/** Where a slotted caption sits, in scene coordinates. */
export function slotRect(scene: Size, slot: CaptionSlot) {
  const inset = scene.width * SLOT_INSET;
  const height = scene.height * SLOT_HEIGHT;
  const width = scene.width - inset * 2;
  if (slot === "top") return { x: inset, y: inset, width, height };
  if (slot === "bottom") {
    return { x: inset, y: scene.height - height - inset, width, height };
  }
  return {
    x: scene.width * 0.15,
    y: scene.height * 0.4,
    width: scene.width * 0.7,
    height: scene.height * 0.2,
  };
}

export function createTextLayer(
  scene: Size,
  slot: CaptionSlot = "free",
  text = "",
): TextLayer {
  const rect = slotRect(scene, slot);
  return {
    kind: "text",
    id: createId("text"),
    name: slot === "free" ? "Caption" : `${slot} text`,
    visible: true,
    locked: false,
    rotation: 0,
    opacity: 1,
    text,
    fontSize: Math.round(scene.height * 0.11),
    align: "center",
    slot,
    ...rect,
    ...CAPTION_PRESET,
  };
}

export function createImageLayer(src: string, natural: Size, scene: Size): ImageLayer {
  // Fit the image into the scene rather than dropping it at natural size: a
  // 4000px phone photo landing at 1:1 would be almost entirely offscreen.
  const scale = Math.min(scene.width / natural.width, scene.height / natural.height, 1);
  const width = Math.round(natural.width * scale);
  const height = Math.round(natural.height * scale);
  return {
    kind: "image",
    id: createId("image"),
    name: "Image",
    visible: true,
    locked: false,
    rotation: 0,
    opacity: 1,
    src,
    natural,
    x: Math.round((scene.width - width) / 2),
    y: Math.round((scene.height - height) / 2),
    width,
    height,
  };
}

export type Action =
  | { type: "loadBase"; src: string; natural: Size }
  | { type: "addImage"; src: string; natural: Size }
  | { type: "addText"; slot?: CaptionSlot; text?: string }
  | { type: "addClassicCaptions" }
  | { type: "updateLayer"; id: LayerId; patch: Partial<Layer> }
  | { type: "moveLayerBy"; id: LayerId; dx: number; dy: number }
  | { type: "deleteLayer"; id: LayerId }
  | { type: "duplicateLayer"; id: LayerId }
  | { type: "reorderLayer"; id: LayerId; direction: "up" | "down" }
  | { type: "select"; id: LayerId | null }
  | { type: "setSceneSize"; width: number; height: number }
  | { type: "setBackground"; color: string }
  | { type: "loadScene"; scene: Scene }
  | { type: "reset" };

function replaceLayer(scene: Scene, id: LayerId, patch: Partial<Layer>): Scene {
  return {
    ...scene,
    layers: scene.layers.map((layer) =>
      layer.id === id ? ({ ...layer, ...patch } as Layer) : layer,
    ),
  };
}

/**
 * Re-place slotted captions after the scene resizes.
 *
 * Captions pinned to the top or bottom must stay pinned when a new base image
 * changes the canvas dimensions. Free captions keep their coordinates -- the
 * user put them where they wanted them.
 */
function reflowSlots(scene: Scene): Scene {
  return {
    ...scene,
    layers: scene.layers.map((layer) => {
      if (layer.kind !== "text" || layer.slot === "free") return layer;
      return { ...layer, ...slotRect(scene, layer.slot) };
    }),
  };
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "loadBase": {
      // A base image defines the canvas. Everything else adapts to it.
      const scene: Scene = {
        ...state.scene,
        width: action.natural.width,
        height: action.natural.height,
      };
      const base = createImageLayer(action.src, action.natural, scene);
      const withoutOldBase = state.scene.layers.filter(
        (layer) => layer.kind !== "image" || layer.name !== "Base image",
      );
      const next = reflowSlots({
        ...scene,
        layers: [{ ...base, name: "Base image" }, ...withoutOldBase],
      });
      return { scene: next, selectedId: base.id };
    }

    case "addImage": {
      const layer = createImageLayer(action.src, action.natural, state.scene);
      return {
        scene: { ...state.scene, layers: [...state.scene.layers, layer] },
        selectedId: layer.id,
      };
    }

    case "addText": {
      const layer = createTextLayer(state.scene, action.slot ?? "free", action.text ?? "");
      return {
        scene: { ...state.scene, layers: [...state.scene.layers, layer] },
        selectedId: layer.id,
      };
    }

    case "addClassicCaptions": {
      const existing = new Set(
        state.scene.layers.filter((l) => l.kind === "text").map((l) => (l as TextLayer).slot),
      );
      const additions: Layer[] = [];
      if (!existing.has("top")) additions.push(createTextLayer(state.scene, "top", "top text"));
      if (!existing.has("bottom")) {
        additions.push(createTextLayer(state.scene, "bottom", "bottom text"));
      }
      if (additions.length === 0) return state;
      return {
        scene: { ...state.scene, layers: [...state.scene.layers, ...additions] },
        selectedId: additions[0].id,
      };
    }

    case "updateLayer":
      return { ...state, scene: replaceLayer(state.scene, action.id, action.patch) };

    case "moveLayerBy": {
      const layer = state.scene.layers.find((l) => l.id === action.id);
      if (!layer || layer.locked) return state;
      // Allow dragging partly offscreen -- cropping a sticker at the edge is a
      // real thing people do -- but never fully out of reach.
      const margin = 24;
      const patch = {
        x: clamp(layer.x + action.dx, -layer.width + margin, state.scene.width - margin),
        y: clamp(layer.y + action.dy, -layer.height + margin, state.scene.height - margin),
        // Dragging a slotted caption detaches it from its slot.
        ...(layer.kind === "text" && layer.slot !== "free" ? { slot: "free" as const } : {}),
      };
      return { ...state, scene: replaceLayer(state.scene, action.id, patch) };
    }

    case "deleteLayer": {
      const layers = state.scene.layers.filter((l) => l.id !== action.id);
      return {
        scene: { ...state.scene, layers },
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }

    case "duplicateLayer": {
      const index = state.scene.layers.findIndex((l) => l.id === action.id);
      if (index === -1) return state;
      const source = state.scene.layers[index];
      const copy: Layer = {
        ...source,
        id: createId(source.kind),
        name: `${source.name} copy`,
        // Offset so the copy is visibly a copy and not hiding underneath.
        x: source.x + 16,
        y: source.y + 16,
        ...(source.kind === "text" ? { slot: "free" as const } : {}),
      };
      const layers = [...state.scene.layers];
      layers.splice(index + 1, 0, copy);
      return { scene: { ...state.scene, layers }, selectedId: copy.id };
    }

    case "reorderLayer": {
      const index = state.scene.layers.findIndex((l) => l.id === action.id);
      const target = action.direction === "up" ? index + 1 : index - 1;
      if (index === -1 || target < 0 || target >= state.scene.layers.length) return state;
      const layers = [...state.scene.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...state, scene: { ...state.scene, layers } };
    }

    case "select":
      return { ...state, selectedId: action.id };

    case "setSceneSize": {
      const scene = { ...state.scene, width: action.width, height: action.height };
      return { ...state, scene: reflowSlots(scene) };
    }

    case "setBackground":
      return { ...state, scene: { ...state.scene, background: action.color } };

    case "loadScene":
      return { scene: action.scene, selectedId: null };

    case "reset":
      return initialState;

    default: {
      // Exhaustiveness: adding an action without handling it fails the build.
      const never: never = action;
      return never;
    }
  }
}

/** Actions that should not create an undo entry of their own. */
export const TRANSIENT_ACTIONS: ReadonlySet<Action["type"]> = new Set(["select"]);
