/**
 * The editor's single source of truth, and the hooks that reach it.
 *
 * One context, one reducer, one image cache. Components read what they need and
 * dispatch intent; nothing below this file holds meme state of its own.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type { EditorState, Layer, LayerId } from "./types";
import type { ImageCache } from "./renderScene";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  withHistory,
  type History,
} from "./history";
import { initialState, reducer, TRANSIENT_ACTIONS, type Action } from "./reducer";

const historyReducer = withHistory<EditorState, Action>(reducer, (action) =>
  TRANSIENT_ACTIONS.has(action.type),
);

interface EditorContextValue {
  state: EditorState;
  history: History<EditorState>;
  dispatch: (action: Action) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selected: Layer | null;
  /** Decoded images, shared by the preview and the exporter. */
  images: ImageCache;
  /** Decode an image and keep it. Resolves once it is safe to draw. */
  cacheImage: (src: string) => Promise<HTMLImageElement>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [history, rawDispatch] = useReducer(
    historyReducer,
    initialState,
    createHistory,
  );

  // A ref, not state: decoded images are a cache, and swapping one in must not
  // re-render every consumer of the context.
  const images = useRef<ImageCache>(new Map()).current;

  const dispatch = useCallback(
    (action: Action) => rawDispatch({ type: "wrapped", action }),
    [],
  );
  const undo = useCallback(() => rawDispatch({ type: "undo" }), []);
  const redo = useCallback(() => rawDispatch({ type: "redo" }), []);

  const cacheImage = useCallback(
    (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const existing = images.get(src);
        if (existing) {
          resolve(existing);
          return;
        }
        const image = new Image();
        image.onload = () => {
          images.set(src, image);
          resolve(image);
        };
        image.onerror = () => reject(new Error("That image could not be decoded."));
        image.src = src;
      }),
    [images],
  );

  const state = history.present;
  const selected = useMemo(
    () => state.scene.layers.find((layer) => layer.id === state.selectedId) ?? null,
    [state.scene.layers, state.selectedId],
  );

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      history,
      dispatch,
      undo,
      redo,
      canUndo: historyCanUndo(history),
      canRedo: historyCanRedo(history),
      selected,
      images,
      cacheImage,
    }),
    [state, history, dispatch, undo, redo, selected, images, cacheImage],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be called inside an <EditorProvider>.");
  }
  return context;
}

/** Patch the selected layer. The common case, so it gets its own hook. */
export function useUpdateSelected() {
  const { dispatch, selected } = useEditor();
  return useCallback(
    (patch: Partial<Layer>) => {
      if (!selected) return;
      dispatch({ type: "updateLayer", id: selected.id as LayerId, patch });
    },
    [dispatch, selected],
  );
}
