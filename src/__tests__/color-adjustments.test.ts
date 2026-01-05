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
    expect(hasNonNeutralColorAdjustments({ vibrance: 1, saturation: 0 })).toBe(true);
    expect(hasNonNeutralColorAdjustments({ vibrance: 0, saturation: -1 })).toBe(true);
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

  test("preserves alpha when applying adjustments", () => {
    const input = new Uint8ClampedArray([50, 60, 70, 123]);
    const output = new Uint8ClampedArray(input.length);

    applyColorAdjustmentsToRgbaBytes(input, output, {
      vibrance: 50,
      saturation: 0,
    });

    expect(output[3]).toBe(123);
  });
});
