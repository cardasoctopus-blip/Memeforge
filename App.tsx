/**
 * The application shell: toolbar, stage, side panels.
 *
 * Layout only. Every decision about what a meme *is* lives in the reducer, and
 * every decision about how it looks lives in the renderer.
 */

import { useCallback, useState } from "react";

import { Inspector } from "./Inspector";
import { LayerList } from "./LayerList";
import { Stage } from "./Stage";
import { Toolbar } from "./Toolbar";
import { useDropImage, usePasteImage } from "./useImageInput";
import { useShortcuts } from "./useShortcuts";
import { downloadBlob, timestampedName } from "./download";
import { exportScene } from "./renderScene";
import { useEditor } from "./EditorContext";
import { isText } from "./types";

export function App() {
  const { state, images } = useEditor();
  const [isExporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const isDragging = useDropImage();
  usePasteImage();

  const handleExport = useCallback(async () => {
    if (state.scene.layers.length === 0) return;
    setExporting(true);
    setFailure(null);
    try {
      const blob = await exportScene(state.scene, images);
      // Name the file after the first caption -- you will have twelve of these
      // in your downloads folder by tonight and "meme-4.png" helps nobody.
      const caption = state.scene.layers.find(isText)?.text ?? "meme";
      downloadBlob(blob, timestampedName(caption.slice(0, 24), "png"));
    } catch {
      setFailure("The export failed. Try again, or reload if it keeps happening.");
    } finally {
      setExporting(false);
    }
  }, [state.scene, images]);

  useShortcuts(() => void handleExport());

  return (
    <div className="app">
      <Toolbar onExport={() => void handleExport()} isExporting={isExporting} />

      <main className="workspace">
        <Stage isDragging={isDragging} />
        <aside className="sidebar">
          <Inspector />
          <LayerList />
          <footer className="shortcuts">
            <h3>Shortcuts</h3>
            <dl>
              <dt>T</dt>
              <dd>New caption</dd>
              <dt>Ctrl+V</dt>
              <dd>Paste an image</dd>
              <dt>Ctrl+D</dt>
              <dd>Duplicate layer</dd>
              <dt>Ctrl+S</dt>
              <dd>Export PNG</dd>
              <dt>Arrows</dt>
              <dd>Nudge (Shift for 10px)</dd>
            </dl>
          </footer>
        </aside>
      </main>

      {failure && (
        <p className="toast" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
