import type { Camera, ImageEditorEdits, Rectangle, Viewport } from "./types";

export type HistoryEntry = {
  title: string; edits: ImageEditorEdits; camera: Camera;
  viewport?: Viewport; presentationOffset?: number; cropIntent?: Rectangle | null;
  presentationOffsets?: Array<[number, number]>;
};
export type Timeline = { entries: HistoryEntry[]; position: number };
export const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export function recordHistory(timeline: Timeline, entry: HistoryEntry): Timeline {
  const previous = timeline.entries[timeline.position];
  if (previous && equal(previous.edits, entry.edits) && equal(previous.camera, entry.camera)
    && equal(previous.cropIntent ?? null, entry.cropIntent ?? null)
    && (!equal(previous.viewport, entry.viewport) || previous.presentationOffset === entry.presentationOffset)) return timeline;
  const entries = [...timeline.entries.slice(0, timeline.position + 1), structuredClone(entry)];
  const retained = entries.length > 50 ? [entries[0], ...entries.slice(-49)] : entries;
  return { entries: retained, position: retained.length - 1 };
}
