/**
 * What you see before there is a meme.
 *
 * An empty screen is an invitation to act, so this names the three ways in and
 * nothing else. No illustration, no marketing -- the fastest route from here is
 * a paste, and most people do not know that until told.
 */

import { useRef } from "react";

import { useImageInput } from "./useImageInput";

export function EmptyState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { acceptMany, error } = useImageInput();

  return (
    <div className="empty">
      <p className="empty__lead">Start with an image.</p>
      <ul className="empty__routes">
        <li>
          Paste a screenshot with <kbd>Ctrl</kbd>+<kbd>V</kbd>
        </li>
        <li>Drag a file anywhere onto this window</li>
        <li>
          <button className="link" onClick={() => inputRef.current?.click()}>
            Choose a file
          </button>
        </li>
      </ul>
      {error && <p className="empty__error">{error}</p>}
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
    </div>
  );
}
