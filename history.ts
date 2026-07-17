/**
 * Undo and redo, as a reducer wrapper.
 *
 * Rather than have every component remember to snapshot, this wraps any reducer
 * and records past states automatically. Two rules keep the stack useful:
 *
 * - **Selection is not history.** Clicking around a document then hitting undo
 *   should undo your last *edit*, not your last click. Transient actions apply
 *   to the present without pushing a past entry.
 * - **Redo dies on a new edit.** Standard, and expected -- once you branch, the
 *   old future is unreachable and keeping it around only confuses people.
 */

export interface History<S> {
  past: S[];
  present: S;
  future: S[];
}

export type HistoryAction<A> =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clearHistory" }
  | { type: "wrapped"; action: A };

/** How many edits back you can go. Beyond this, memory cost stops being free. */
export const HISTORY_LIMIT = 60;

export function createHistory<S>(present: S): History<S> {
  return { past: [], present, future: [] };
}

export function canUndo<S>(history: History<S>): boolean {
  return history.past.length > 0;
}

export function canRedo<S>(history: History<S>): boolean {
  return history.future.length > 0;
}

/**
 * Wrap a reducer with undo/redo.
 *
 * `isTransient` decides which actions apply without a history entry.
 */
export function withHistory<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  isTransient: (action: A) => boolean = () => false,
) {
  return function historyReducer(
    history: History<S>,
    action: HistoryAction<A>,
  ): History<S> {
    switch (action.type) {
      case "undo": {
        if (!canUndo(history)) return history;
        const previous = history.past[history.past.length - 1];
        return {
          past: history.past.slice(0, -1),
          present: previous,
          future: [history.present, ...history.future],
        };
      }

      case "redo": {
        if (!canRedo(history)) return history;
        const [next, ...rest] = history.future;
        return {
          past: [...history.past, history.present],
          present: next,
          future: rest,
        };
      }

      case "clearHistory":
        return createHistory(history.present);

      case "wrapped": {
        const next = reducer(history.present, action.action);
        // A no-op reducer (dragging a locked layer, say) should not burn an
        // undo slot on a state identical to the one already there.
        if (next === history.present) return history;

        if (isTransient(action.action)) {
          return { ...history, present: next };
        }
        const past = [...history.past, history.present].slice(-HISTORY_LIMIT);
        return { past, present: next, future: [] };
      }

      default:
        return history;
    }
  };
}
