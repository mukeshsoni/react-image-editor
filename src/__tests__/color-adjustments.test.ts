import { describe, expect, test } from "vitest";

import {
  applyColorAdjustmentsToRgbaBytes,
  hasNonNeutralColorAdjustments,
} from "../lib/color-adjustments";
import type { ColorAdjustments } from "../store/cropStore";

function defaults(): ColorAdjustments {
  return {
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
  };
}

describe("color adjustments math", () => {
  test("neutral settings preserve RGB and alpha", () => {
    const input = new Uint8ClampedArray([10, 20, 30, 40, 200, 150, 100, 128]);
    const output = new Uint8ClampedArray(input.length);

    applyColorAdjustmentsToRgbaBytes(input, output, defaults());

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  test("hasNonNeutralColorAdjustments detects neutral vs non-neutral", () => {
    expect(hasNonNeutralColorAdjustments(defaults())).toBe(false);
    expect(hasNonNeutralColorAdjustments({ ...defaults(), vibrance: 1, saturation: 0 })).toBe(
      true,
    );
    expect(hasNonNeutralColorAdjustments({ ...defaults(), vibrance: 0, saturation: -1 })).toBe(
      true,
    );
  });

  test("saturation increases color intensity", () => {
    // A not-fully-saturated color.
    const input = new Uint8ClampedArray([128, 64, 64, 255]);
    const output = new Uint8ClampedArray(input.length);

    applyColorAdjustmentsToRgbaBytes(input, output, {
      ...defaults(),
      saturation: 50,
    });

    // Should no longer be identical to input.
    expect(Array.from(output)).not.toEqual(Array.from(input));
    expect(output[3]).toBe(255);
  });

  test("point color range controls selectivity", () => {
    const input = new Uint8ClampedArray([
      // red-ish
      220,
      30,
      30,
      255,
      // orange-ish
      220,
      120,
      30,
      255,
    ]);

    const narrow = new Uint8ClampedArray(input.length);
    const broad = new Uint8ClampedArray(input.length);

    const base = defaults();

    applyColorAdjustmentsToRgbaBytes(input, narrow, {
      ...base,
      pointColor: {
        ...base.pointColor,
        hue: 0,
        range: 0,
        saturationShift: -100,
      },
    });

    applyColorAdjustmentsToRgbaBytes(input, broad, {
      ...base,
      pointColor: {
        ...base.pointColor,
        hue: 0,
        range: 100,
        saturationShift: -100,
      },
    });

    // Broad range should affect the non-target pixel more than narrow range.
    const narrowBlueDelta =
      Math.abs((narrow[4] ?? 0) - (input[4] ?? 0)) +
      Math.abs((narrow[5] ?? 0) - (input[5] ?? 0)) +
      Math.abs((narrow[6] ?? 0) - (input[6] ?? 0));

    const broadBlueDelta =
      Math.abs((broad[4] ?? 0) - (input[4] ?? 0)) +
      Math.abs((broad[5] ?? 0) - (input[5] ?? 0)) +
      Math.abs((broad[6] ?? 0) - (input[6] ?? 0));

    expect(broadBlueDelta).toBeGreaterThan(narrowBlueDelta);

    // Target pixel should be affected in both cases.
    const narrowRedDelta =
      Math.abs((narrow[0] ?? 0) - (input[0] ?? 0)) +
      Math.abs((narrow[1] ?? 0) - (input[1] ?? 0)) +
      Math.abs((narrow[2] ?? 0) - (input[2] ?? 0));

    const broadRedDelta =
      Math.abs((broad[0] ?? 0) - (input[0] ?? 0)) +
      Math.abs((broad[1] ?? 0) - (input[1] ?? 0)) +
      Math.abs((broad[2] ?? 0) - (input[2] ?? 0));

    expect(narrowRedDelta).toBeGreaterThan(0);
    expect(broadRedDelta).toBeGreaterThan(0);

    // Alpha preserved
    expect(narrow[3]).toBe(255);
    expect(narrow[7]).toBe(255);
    expect(broad[3]).toBe(255);
    expect(broad[7]).toBe(255);
  });

  test("preserves alpha when applying adjustments", () => {
    const input = new Uint8ClampedArray([50, 60, 70, 123]);
    const output = new Uint8ClampedArray(input.length);

    applyColorAdjustmentsToRgbaBytes(input, output, {
      ...defaults(),
      vibrance: 50,
      saturation: 0,
    });

    expect(output[3]).toBe(123);
  });
});
