import { describe, expect, test } from "vitest";

import type { ImageEditorEdits } from "@/store/edits";
import { getHistoryDisplayForEditsChange } from "@/store/historyRecording";

function makeBaseEdits(): ImageEditorEdits {
  return {
    version: 1,
    crop: {
      rect: { x: 0, y: 0, width: 100, height: 100 },
      settings: {
        aspectRatio: "original",
        aspectRatioLocked: false,
        rotation: 0,
        constrainCrop: true,
      },
    },
    geometryOptics: {
      perspective: { vertical: 0, horizontal: 0, aspect: 0 },
      lensCorrections: { distortion: 0, chromaticAberration: false },
      optics: { vignette: 0, grain: 0, dehaze: 0 },
    },
    whiteBalance: { preset: "custom", temperatureKelvin: 6500, tint: 0 },
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
    healing: {
      version: 1,
      mode: "spot",
      brush: { size: 30, feather: 50 },
      ops: [],
      cloneSource: null,
    },
  };
}

describe("historyRecording healing labels", () => {
  test("labels spot removal when a spot is added", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      healing: {
        ...prev.healing,
        ops: [
          {
            id: "spot1",
            type: "spot",
            mode: "spot",
            center: { x: 10, y: 10 },
            radius: 5,
            feather: 50,
            opacity: 255,
            source: { x: 20, y: 10 },
          },
        ],
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Spot Removal",
    });
  });

  test("labels spot sample when a spot source changes", () => {
    const prev = makeBaseEdits();
    const baseSpot = {
      id: "spot1",
      type: "spot" as const,
      mode: "spot" as const,
      center: { x: 10, y: 10 },
      radius: 5,
      feather: 50,
      opacity: 255,
      source: { x: 20, y: 10 },
    };

    const next: ImageEditorEdits = {
      ...prev,
      healing: {
        ...prev.healing,
        ops: [{ ...baseSpot, source: { x: 30, y: 10 } }],
      },
    };

    expect(getHistoryDisplayForEditsChange(
      { ...prev, healing: { ...prev.healing, ops: [baseSpot] } },
      next,
    )).toEqual({
      label: "Spot Sample",
    });
  });

  test("labels delete spot when a spot is removed", () => {
    const prev = makeBaseEdits();
    const withOps: ImageEditorEdits = {
      ...prev,
      healing: {
        ...prev.healing,
        ops: [
          {
            id: "spot1",
            type: "spot",
            mode: "spot",
            center: { x: 10, y: 10 },
            radius: 5,
            feather: 50,
            opacity: 255,
            source: { x: 20, y: 10 },
          },
        ],
      },
    };

    expect(getHistoryDisplayForEditsChange(withOps, prev)).toEqual({
      label: "Delete Spot",
    });
  });

  test("labels clear healing when multiple ops are cleared", () => {
    const prev = makeBaseEdits();
    const withOps: ImageEditorEdits = {
      ...prev,
      healing: {
        ...prev.healing,
        ops: [
          {
            id: "spot1",
            type: "spot",
            mode: "spot",
            center: { x: 10, y: 10 },
            radius: 5,
            feather: 50,
            opacity: 255,
            source: { x: 20, y: 10 },
          },
          {
            id: "spot2",
            type: "spot",
            mode: "spot",
            center: { x: 50, y: 50 },
            radius: 5,
            feather: 50,
            opacity: 255,
            source: { x: 60, y: 50 },
          },
        ],
      },
    };

    const cleared: ImageEditorEdits = {
      ...withOps,
      healing: {
        ...withOps.healing,
        ops: [],
      },
    };

    expect(getHistoryDisplayForEditsChange(withOps, cleared)).toEqual({
      label: "Clear Healing",
    });
  });
});
