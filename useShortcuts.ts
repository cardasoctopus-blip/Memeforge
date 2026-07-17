/**
 * Keyboard shortcuts.
 *
 * The one rule that matters: never fire while someone is typing. A meme tool
 * where pressing "d" in the caption box duplicates a layer is unusable, and it
 * is the single most common way this goes wrong.
 */

import { useEffect } from "react";

import { useEditor } from "./EditorContext";

const NUDGE = 1;
const NUDGE_FAST = 10;

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.matches?.("input, textarea, select, [contenteditable]"));
}

export function useShortcuts(onExport: () => void) {
  const { dispatch, undo, redo, state } = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;
      const id = state.selectedId;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onExport();
        return;
      }
      if (mod && event.key.toLowerCase() === "d" && id) {
        event.preventDefault();
        dispatch({ type: "duplicateLayer", id });
        return;
      }

      if (!mod && event.key.toLowerCase() === "t") {
        event.preventDefault();
        dispatch({ type: "addText" });
        return;
      }
      if (event.key === "Escape") {
        dispatch({ type: "select", id: null });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && id) {
        event.preventDefault();
        dispatch({ type: "deleteLayer", id });
        return;
      }

      const step = event.shiftKey ? NUDGE_FAST : NUDGE;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = arrows[event.key];
      if (delta && id) {
        event.preventDefault();
        dispatch({ type: "moveLayerBy", id, dx: delta[0], dy: delta[1] });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, undo, redo, onExport, state.selectedId]);
}
