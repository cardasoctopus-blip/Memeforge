/**
 * The top bar: the wordmark, the four things you do most, and export.
 *
 * Buttons say what happens when you press them. "Export PNG" produces a PNG;
 * "Top and bottom text" produces top and bottom text. Nothing here is called
 * "Submit".
 */

import { useRef } from "react";

import { useImageInput } from "./useImageInput";
import { useEditor } from "./EditorContext";

interface ToolbarProps {
  onExport: () => void;
  isExporting: boolean;
}

export function Toolbar({ onExport, isExporting }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dispatch, undo, redo, canUndo, canRedo, state } = useEditor();
  const { acceptMany } = useImageInput();

  const hasScene = state.scene.layers.length > 0;

  return (
    <header className="toolbar">
      <h1 className="wordmark">
        <span className="wordmark__meme">Meme</span>
        <span className="wordmark__forge">Forge</span>
      </h1>

      <div className="toolbar__group">
        <button onClick={() => inputRef.current?.click()}>Open image</button>
        <button onClick={() => dispatch({ type: "addText" })} disabled={!hasScene}>
          Add caption
        </button>
        <button
          onClick={() => dispatch({ type: "addClassicCaptions" })}
          disabled={!hasScene}
        >
          Top and bottom text
        </button>
      </div>

      <div className="toolbar__group toolbar__group--tight">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>

      <button
        className="button--hot"
        onClick={onExport}
        disabled={!hasScene || isExporting}
        title="Export PNG (Ctrl+S)"
      >
        {isExporting ? "Exporting…" : "Export PNG"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void acceptMany(event.target.files);
          event.target.value = "";
        }}
      />
    </header>
  );
}
