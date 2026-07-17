/** Layer ids. Short, readable in a JSON dump, unique enough for one document. */

let counter = 0;

/**
 * Generate a layer id.
 *
 * Deliberately not a UUID: these ids appear in exported scene files that people
 * read and hand-edit, and `text-4` is friendlier there than 36 hex characters.
 * Collisions across documents do not matter because ids are scene-scoped.
 */
export function createId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Reset the counter. Tests only -- keeps ids predictable between cases. */
export function resetIdCounter(): void {
  counter = 0;
}
