/** Saving things to the user's disk. */

/**
 * Trigger a browser download for a blob.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking
 * it in the same frame as the click cancels the download in some browsers.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Save any JSON-serialisable value as a .json file. */
export function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, filename);
}

/** A filesystem-safe filename with a timestamp, so nothing overwrites. */
export function timestampedName(stem: string, extension: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const safe = stem.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "meme";
  return `${safe}-${stamp}.${extension}`;
}
