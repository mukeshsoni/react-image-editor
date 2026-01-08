import { create } from "zustand";

import type { ImageEditorEdits } from "./edits";

export type EditorSerializableState = {
  edits: ImageEditorEdits;
  camera?: {
    zoomLevel: number;
    offset: {
      x: number;
      y: number;
    };
  };
};

export type HistoryEntry = {
  id: string;

  // Left column label (e.g. "Exposure")
  label: string;

  // Optional right column (e.g. "+0.2")
  delta?: string;

  timestamp: number;
  state: EditorSerializableState;
};

export type HistoryStore = {
  entries: HistoryEntry[];
  index: number;
  maxEntries: number;

  push: (entry: Omit<HistoryEntry, "id" | "timestamp">) => HistoryEntry;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  jumpTo: (index: number) => HistoryEntry | null;
  resetToBaseline: (baseline: Omit<HistoryEntry, "id" | "timestamp">) => HistoryEntry;
};

function createHistoryEntry(
  entry: Omit<HistoryEntry, "id" | "timestamp">,
): HistoryEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return {
    id,
    timestamp: Date.now(),
    ...entry,
  };
}

function clampIndex(index: number, entriesLength: number): number {
  if (entriesLength <= 0) {
    return -1;
  }

  return Math.min(Math.max(index, 0), entriesLength - 1);
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [],
  index: -1,
  maxEntries: 50,

  push: (entry) => {
    const nextEntry = createHistoryEntry(entry);

    set((state) => {
      const base = state.entries.slice(0, state.index + 1);
      const appended = [...base, nextEntry];

      const overflow = Math.max(0, appended.length - state.maxEntries);
      const entries = overflow > 0 ? appended.slice(overflow) : appended;
      const index = entries.length - 1;

      return {
        entries,
        index,
      };
    });

    return nextEntry;
  },

  undo: () => {
    const { entries, index } = get();
    if (index <= 0) {
      return null;
    }

    const nextIndex = index - 1;
    set({ index: nextIndex });
    return entries[nextIndex] ?? null;
  },

  redo: () => {
    const { entries, index } = get();
    if (index < 0 || index >= entries.length - 1) {
      return null;
    }

    const nextIndex = index + 1;
    set({ index: nextIndex });
    return entries[nextIndex] ?? null;
  },

  jumpTo: (nextIndex) => {
    const { entries } = get();
    const clamped = clampIndex(nextIndex, entries.length);
    if (clamped === -1) {
      return null;
    }

    set({ index: clamped });
    return entries[clamped] ?? null;
  },

  resetToBaseline: (baseline) => {
    const nextEntry = createHistoryEntry(baseline);

    set({
      entries: [nextEntry],
      index: 0,
    });

    return nextEntry;
  },
}));

export function selectCanUndo(state: Pick<HistoryStore, "index">): boolean {
  return state.index > 0;
}

export function selectCanRedo(state: Pick<HistoryStore, "entries" | "index">): boolean {
  return state.index >= 0 && state.index < state.entries.length - 1;
}

export function selectCurrentEntry(state: Pick<HistoryStore, "entries" | "index">): HistoryEntry | null {
  return state.entries[state.index] ?? null;
}
