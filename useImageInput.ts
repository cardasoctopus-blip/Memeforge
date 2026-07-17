/**
 * Getting an image into the editor, by whichever route the user takes.
 *
 * There are three: the file picker, a drag onto the window, and a paste. All
 * three end at the same place, so they share one handler. Paste matters more
 * than it looks -- screenshot, Ctrl+V, caption, done is the whole workflow for
 * a lot of people, and a meme tool that makes you save the screenshot first has
 * lost them.
 */

import { useCallback, useEffect, useState } from "react";

import { useEditor } from "./EditorContext";

export interface ImageInputOptions {
  /** Replace the canvas (base image) or drop a sticker on top of it. */
  as: "base" | "layer";
}

const ACCEPTED = /^image\/(png|jpeg|gif|webp|avif)$/;

export function useImageInput() {
  const { dispatch, cacheImage, state } = useEditor();
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    async (file: File, options: ImageInputOptions = { as: "base" }) => {
      if (!ACCEPTED.test(file.type)) {
        setError(`${file.type || "That file"} is not an image MemeForge can read.`);
        return;
      }
      setError(null);

      const src = URL.createObjectURL(file);
      try {
        const image = await cacheImage(src);
        const natural = { width: image.naturalWidth, height: image.naturalHeight };
        const hasBase = state.scene.layers.some((l) => l.name === "Base image");
        const asBase = options.as === "base" || !hasBase;
        dispatch(
          asBase
            ? { type: "loadBase", src, natural }
            : { type: "addImage", src, natural },
        );
      } catch {
        URL.revokeObjectURL(src);
        setError("That image could not be decoded. Try a PNG or JPEG.");
      }
    },
    [cacheImage, dispatch, state.scene.layers],
  );

  const acceptMany = useCallback(
    async (files: FileList | File[], options?: ImageInputOptions) => {
      const list = Array.from(files);
      for (const [index, file] of list.entries()) {
        // First file becomes the base, the rest land as layers on top.
        await accept(file, options ?? { as: index === 0 ? "base" : "layer" });
      }
    },
    [accept],
  );

  return { accept, acceptMany, error, clearError: () => setError(null) };
}

/** Wire up window-level paste so Ctrl+V drops a screenshot straight in. */
export function usePasteImage() {
  const { accept } = useImageInput();

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      // Never hijack a paste aimed at a text field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable]")) return;

      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void accept(file, { as: "base" });
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);
}

/** Window-level drag and drop, with a flag for the drop-target styling. */
export function useDropImage() {
  const { acceptMany } = useImageInput();
  const [isDragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;

    const onEnter = (event: DragEvent) => {
      event.preventDefault();
      depth += 1;
      if (event.dataTransfer?.types.includes("Files")) setDragging(true);
    };
    const onLeave = (event: DragEvent) => {
      event.preventDefault();
      // dragleave fires for every child element the cursor crosses, so count
      // enters and leaves instead of trusting a single event.
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const onOver = (event: DragEvent) => event.preventDefault();
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files?.length) void acceptMany(files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [acceptMany]);

  return isDragging;
}
