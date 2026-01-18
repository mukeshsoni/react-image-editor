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
    color: {
      vibrance: 0,
      saturation: 0,
      mixerHsl: {
        red: { hue: 0, saturation: 0, luminance: 0 },
        orange: { hue: 0, saturation: 0, luminance: 0 },
        yellow: { hue: 0, saturation: 0, luminance: 0 },
        green: { hue: 0, saturation: 0, luminance: 0 },
        aqua: { hue: 0, saturation: 0, luminance: 0 },
        blue: { hue: 0, saturation: 0, luminance: 0 },
        purple: { hue: 0, saturation: 0, luminance: 0 },
        magenta: { hue: 0, saturation: 0, luminance: 0 },
      },
      pointColor: {
        hue: null,
        range: 50,
        hueShift: 0,
        saturationShift: 0,
        luminanceShift: 0,
      },
    },
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
    preset: { activePresetId: "none", intensity: 100 },
    healing: {
      version: 1,
      mode: "spot",
      brush: { size: 30, feather: 50 },
      ops: [],
      cloneSource: null,
    },
  };
}

describe("historyRecording color mixer labels", () => {
  test("labels mixer band hue", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      color: {
        ...prev.color,
        mixerHsl: {
          ...prev.color.mixerHsl,
          red: { ...prev.color.mixerHsl.red, hue: 10 },
        },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Mixer Red Hue",
      delta: "+10",
    });
  });

  test("labels mixer band saturation", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      color: {
        ...prev.color,
        mixerHsl: {
          ...prev.color.mixerHsl,
          blue: { ...prev.color.mixerHsl.blue, saturation: -20 },
        },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Mixer Blue Saturation",
      delta: "-20",
    });
  });

  test("labels point color pick and clear", () => {
    const prev = makeBaseEdits();

    const picked: ImageEditorEdits = {
      ...prev,
      color: {
        ...prev.color,
        pointColor: {
          ...prev.color.pointColor,
          hue: 0.2,
        },
      },
    };

    expect(getHistoryDisplayForEditsChange(prev, picked)).toEqual({
      label: "Point Color Pick",
    });

    const cleared: ImageEditorEdits = {
      ...picked,
      color: {
        ...picked.color,
        pointColor: {
          ...picked.color.pointColor,
          hue: null,
        },
      },
    };

    expect(getHistoryDisplayForEditsChange(picked, cleared)).toEqual({
      label: "Point Color Clear",
    });
  });

  test("labels point color range", () => {
    const prev = makeBaseEdits();
    const next: ImageEditorEdits = {
      ...prev,
      color: {
        ...prev.color,
        pointColor: {
          ...prev.color.pointColor,
          hue: 0,
          range: 60,
        },
      },
    };

    // Hue change gets priority.
    expect(getHistoryDisplayForEditsChange(prev, next)).toEqual({
      label: "Point Color Pick",
    });

    const rangeOnly: ImageEditorEdits = {
      ...next,
      color: {
        ...next.color,
        pointColor: {
          ...next.color.pointColor,
          range: 80,
        },
      },
    };

    expect(getHistoryDisplayForEditsChange(next, rangeOnly)).toEqual({
      label: "Point Color Range",
      delta: "+20",
    });
  });
});
