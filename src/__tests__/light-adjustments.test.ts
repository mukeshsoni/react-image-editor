import { describe, expect, test } from "vitest";

import {
  applyLightAdjustmentsToRgbaBytes,
} from "../lib/light-adjustments";
import type { LightAdjustments } from "../store/cropStore";

function defaults(): LightAdjustments {
  return {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
  };
}

describe("light adjustments math", () => {
  test("neutral settings preserve RGB and alpha", () => {
    const input = new Uint8ClampedArray([
      10, 20, 30, 40,
      200, 150, 100, 128,
    ]);
    const output = new Uint8ClampedArray(input.length);

    applyLightAdjustmentsToRgbaBytes(input, output, defaults());

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  test("exposure increases brightness", () => {
    const input = new Uint8ClampedArray([100, 100, 100, 255]);
    const output = new Uint8ClampedArray(input.length);

    applyLightAdjustmentsToRgbaBytes(input, output, {
      ...defaults(),
      exposure: 1,
    });

    // Roughly 2x brightness, clamped.
    expect(output[0]).toBeGreaterThan(150);
    expect(output[1]).toBeGreaterThan(150);
    expect(output[2]).toBeGreaterThan(150);
    expect(output[3]).toBe(255);
  });

  test("clamps channels to valid range", () => {
    const input = new Uint8ClampedArray([255, 255, 255, 10]);
    const output = new Uint8ClampedArray(input.length);

    applyLightAdjustmentsToRgbaBytes(input, output, {
      ...defaults(),
      exposure: 3,
    });

    expect(output[0]).toBe(255);
    expect(output[1]).toBe(255);
    expect(output[2]).toBe(255);
    expect(output[3]).toBe(10);
  });

  test("preserves alpha when applying adjustments", () => {
    const input = new Uint8ClampedArray([50, 60, 70, 123]);
    const output = new Uint8ClampedArray(input.length);

    applyLightAdjustmentsToRgbaBytes(input, output, {
      ...defaults(),
      exposure: 1,
      contrast: 10,
      highlights: 20,
      shadows: -20,
    });

    expect(output[3]).toBe(123);
  });
});
