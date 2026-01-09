import { beforeEach, describe, expect, test } from "vitest";

import type { EditorSerializableState } from "@/store/historyStore";

import { useHistoryStore } from "@/store/historyStore";

const dummyState: EditorSerializableState = {
  edits: {
    version: 1,
    crop: {
      rect: { x: 0, y: 0, width: 0, height: 0 },
      settings: {
        aspectRatio: "original",
        aspectRatioLocked: false,
        rotation: 0,
        constrainCrop: true,
      },
    },
    whiteBalance: { temperatureKelvin: 6500, tint: 0, preset: "custom" },
    light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
    color: { vibrance: 0, saturation: 0 },
    toneCurve: {
      mode: "point",
      activeChannel: "rgb",
      point: {
        rgb: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        r: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        g: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        b: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      parametric: {
        rgb: {
          highlights: 0,
          lights: 0,
          darks: 0,
          shadows: 0,
        },
      },
    },
    sharpening: { amount: 0, radius: 1, detail: 25, masking: 0 },
    denoise: { luminance: 0, color: 0, detail: 50 },
  },
  camera: { zoomLevel: 1, offset: { x: 0, y: 0 } },
};

function makeEntry(label: string) {
  return {
    label,
    state: dummyState,
  };
}

describe("historyStore", () => {
  beforeEach(() => {
    useHistoryStore.setState({ entries: [], index: -1, maxEntries: 50 });
  });

  test("push/undo/redo basics", () => {
    const push = useHistoryStore.getState().push;
    const undo = useHistoryStore.getState().undo;
    const redo = useHistoryStore.getState().redo;

    push(makeEntry("Original"));
    push(makeEntry("Exposure"));

    expect(useHistoryStore.getState().entries).toHaveLength(2);
    expect(useHistoryStore.getState().index).toBe(1);

    const undoEntry = undo();
    expect(undoEntry?.label).toBe("Original");
    expect(useHistoryStore.getState().index).toBe(0);

    const redoEntry = redo();
    expect(redoEntry?.label).toBe("Exposure");
    expect(useHistoryStore.getState().index).toBe(1);
  });

  test("new edit after undo clears redo", () => {
    const push = useHistoryStore.getState().push;
    const undo = useHistoryStore.getState().undo;

    push(makeEntry("Original"));
    push(makeEntry("Exposure"));
    push(makeEntry("Contrast"));

    const undoEntry = undo();
    expect(undoEntry?.label).toBe("Exposure");

    push(makeEntry("Highlights"));

    const entries = useHistoryStore.getState().entries;
    expect(entries.map((e) => e.label)).toEqual([
      "Original",
      "Exposure",
      "Highlights",
    ]);
    expect(useHistoryStore.getState().index).toBe(2);
  });

  test("jumpTo sets correct index", () => {
    const push = useHistoryStore.getState().push;
    const jumpTo = useHistoryStore.getState().jumpTo;

    push(makeEntry("Original"));
    push(makeEntry("Exposure"));
    push(makeEntry("Contrast"));

    const entry = jumpTo(1);
    expect(entry?.label).toBe("Exposure");
    expect(useHistoryStore.getState().index).toBe(1);
  });

  test("history cap drops oldest", () => {
    useHistoryStore.setState({ entries: [], index: -1, maxEntries: 3 });

    const push = useHistoryStore.getState().push;
    push(makeEntry("0"));
    push(makeEntry("1"));
    push(makeEntry("2"));
    push(makeEntry("3"));

    expect(useHistoryStore.getState().entries.map((e) => e.label)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(useHistoryStore.getState().index).toBe(2);
  });
});
