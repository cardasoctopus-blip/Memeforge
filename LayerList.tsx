/**
 * The layer stack, drawn top-first because that is how people see it.
 *
 * The scene stores layers back to front (index 0 is drawn first). The panel
 * reverses that: the thing on top of the image should be the thing at the top
 * of the list, or every reorder click goes the wrong way.
 */

import { useEditor } from "./EditorContext";
import { isText } from "./types";

export function LayerList() {
  const { state, dispatch } = useEditor();
  const { layers } = state.scene;

  if (layers.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Layers</h2>
      <ul className="layers">
        {[...layers].reverse().map((layer) => {
          const selected = layer.id === state.selectedId;
          const label = isText(layer)
            ? layer.text.trim().slice(0, 28) || layer.name
            : layer.name;

          return (
            <li key={layer.id} className="layer" data-selected={selected || undefined}>
              <button
                className="layer__name"
                onClick={() => dispatch({ type: "select", id: layer.id })}
              >
                <span className="layer__kind">{isText(layer) ? "T" : "▣"}</span>
                <span className="layer__label">{label}</span>
              </button>

              <div className="layer__actions">
                <button
                  title={layer.visible ? "Hide" : "Show"}
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={() =>
                    dispatch({
                      type: "updateLayer",
                      id: layer.id,
                      patch: { visible: !layer.visible },
                    })
                  }
                >
                  {layer.visible ? "◉" : "○"}
                </button>
                <button
                  title="Move up"
                  aria-label="Move layer up"
                  onClick={() =>
                    dispatch({ type: "reorderLayer", id: layer.id, direction: "up" })
                  }
                >
                  ↑
                </button>
                <button
                  title="Move down"
                  aria-label="Move layer down"
                  onClick={() =>
                    dispatch({ type: "reorderLayer", id: layer.id, direction: "down" })
                  }
                >
                  ↓
                </button>
                <button
                  title="Delete"
                  aria-label="Delete layer"
                  className="layer__delete"
                  onClick={() => dispatch({ type: "deleteLayer", id: layer.id })}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
