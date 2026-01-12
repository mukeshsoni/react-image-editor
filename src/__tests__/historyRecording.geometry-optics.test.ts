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

describe("historyRecording geometry/optics labels", () => {
  test("labels perspective vertical", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      geometryOptics: {
        ...prev.geometryOptics,
        perspective: { ...prev.geometryOptics.perspective, vertical: 20 },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Perspective Vertical",
      delta: "+20",
    });
  });

  test("labels lens distortion", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      geometryOptics: {
        ...prev.geometryOptics,
        lensCorrections: { ...prev.geometryOptics.lensCorrections, distortion: -15 },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Lens Distortion",
      delta: "-15",
    });
  });

  test("labels optics vignette", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      geometryOptics: {
        ...prev.geometryOptics,
        optics: { ...prev.geometryOptics.optics, vignette: 10 },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Vignette",
      delta: "+10",
    });
  });
});
