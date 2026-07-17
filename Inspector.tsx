/**
 * Controls for whatever is selected.
 *
 * Text and image layers want different controls, so this splits rather than
 * rendering a superset with half of it disabled. Everything is labelled by what
 * the user recognises -- "Outline", not "strokeRatio".
 */

import { useEditor, useUpdateSelected } from "./EditorContext";
import { isText, type ImageLayer, type TextLayer } from "./types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, step = 1, format, onChange } = props;
  return (
    <label className="field">
      <span className="field__label">
        {label}
        <output className="field__value">{format ? format(value) : value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TextInspector({ layer }: { layer: TextLayer }) {
  const update = useUpdateSelected();

  return (
    <>
      <Field label="Caption">
        <textarea
          className="input"
          rows={3}
          value={layer.text}
          placeholder="Type the line"
          onChange={(event) => update({ text: event.target.value })}
        />
      </Field>

      <Slider
        label="Size"
        value={layer.fontSize}
        min={8}
        max={220}
        onChange={(fontSize) => update({ fontSize })}
      />

      <Slider
        label="Outline"
        value={layer.strokeRatio}
        min={0}
        max={0.2}
        step={0.005}
        format={(v) => (v === 0 ? "none" : v.toFixed(3))}
        onChange={(strokeRatio) => update({ strokeRatio })}
      />

      <Slider
        label="Rotation"
        value={layer.rotation}
        min={-45}
        max={45}
        format={(v) => `${v}°`}
        onChange={(rotation) => update({ rotation })}
      />

      <Field label="Alignment">
        <div className="segmented">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              data-active={layer.align === align || undefined}
              onClick={() => update({ align })}
            >
              {align}
            </button>
          ))}
        </div>
      </Field>

      <div className="field-row">
        <Field label="Fill">
          <input
            type="color"
            value={layer.color}
            onChange={(event) => update({ color: event.target.value })}
          />
        </Field>
        <Field label="Outline colour">
          <input
            type="color"
            value={layer.strokeColor}
            onChange={(event) => update({ strokeColor: event.target.value })}
          />
        </Field>
      </div>

      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={layer.uppercase}
            onChange={(event) => update({ uppercase: event.target.checked })}
          />
          Force uppercase
        </label>
        <label>
          <input
            type="checkbox"
            checked={layer.shadow}
            onChange={(event) => update({ shadow: event.target.checked })}
          />
          Drop shadow
        </label>
      </div>
    </>
  );
}

function ImageInspector({ layer }: { layer: ImageLayer }) {
  const update = useUpdateSelected();
  const ratio = layer.natural.width / layer.natural.height;

  return (
    <>
      <Slider
        label="Scale"
        value={Math.round((layer.width / layer.natural.width) * 100)}
        min={5}
        max={200}
        format={(v) => `${v}%`}
        onChange={(percent) => {
          const width = Math.round((layer.natural.width * percent) / 100);
          update({ width, height: Math.round(width / ratio) });
        }}
      />

      <Slider
        label="Rotation"
        value={layer.rotation}
        min={-180}
        max={180}
        format={(v) => `${v}°`}
        onChange={(rotation) => update({ rotation })}
      />

      <Slider
        label="Opacity"
        value={Math.round(layer.opacity * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        onChange={(percent) => update({ opacity: percent / 100 })}
      />

      <p className="hint">
        Natural size {layer.natural.width} × {layer.natural.height}
      </p>
    </>
  );
}

export function Inspector() {
  const { selected, state, dispatch } = useEditor();

  if (!selected) {
    return (
      <section className="panel">
        <h2 className="panel__title">Canvas</h2>
        <Field label="Background">
          <input
            type="color"
            value={state.scene.background}
            onChange={(event) =>
              dispatch({ type: "setBackground", color: event.target.value })
            }
          />
        </Field>
        <p className="hint">Select a layer to edit it, or press T for a new caption.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">{isText(selected) ? "Caption" : "Image"}</h2>
      {isText(selected) ? (
        <TextInspector layer={selected} />
      ) : (
        <ImageInspector layer={selected} />
      )}
    </section>
  );
}
