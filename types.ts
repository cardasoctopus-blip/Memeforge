/**
 * The shape of a meme.
 *
 * A scene is a fixed-size canvas plus an ordered stack of layers, drawn back
 * to front. Everything the editor does is a transformation of this object, and
 * it serialises to JSON cleanly so undo, redo, and save-to-file are all the
 * same problem.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Vec2, Size {}

export type LayerId = string;

export type TextAlign = "left" | "center" | "right";

/** Where a caption sits by convention. Free layers are dragged anywhere. */
export type CaptionSlot = "top" | "bottom" | "free";

interface LayerCommon {
  id: LayerId;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Degrees, clockwise, about the layer's centre. */
  rotation: number;
  opacity: number;
}

export interface TextLayer extends LayerCommon, Rect {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  /** Multiplier on fontSize. 1.1 is the classic tight macro leading. */
  lineHeight: number;
  color: string;
  strokeColor: string;
  /** Outline thickness as a fraction of fontSize, so it scales with the text. */
  strokeRatio: number;
  align: TextAlign;
  uppercase: boolean;
  shadow: boolean;
  slot: CaptionSlot;
}

export interface ImageLayer extends LayerCommon, Rect {
  kind: "image";
  /** Object URL or data URL. Never a remote fetch at render time. */
  src: string;
  /** Natural pixel size, kept so "reset size" can restore the aspect ratio. */
  natural: Size;
}

export type Layer = TextLayer | ImageLayer;

export interface Scene extends Size {
  background: string;
  /** Back to front. Index 0 is drawn first. */
  layers: Layer[];
}

export interface EditorState {
  scene: Scene;
  selectedId: LayerId | null;
}

export const isText = (layer: Layer): layer is TextLayer => layer.kind === "text";
export const isImage = (layer: Layer): layer is ImageLayer => layer.kind === "image";
