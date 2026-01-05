import { describe, expect, test } from "vitest";

import {
  applyWhiteBalanceToRgbaBytes,
  estimateWhiteBalanceFromRgb,
  hasNonNeutralWhiteBalance,
  sampleAverageRgb,
} from "../lib/white-balance";
import type { WhiteBalanceSettings } from "../store/cropStore";

function defaults(): WhiteBalanceSettings {
  return {
    temperatureKelvin: 6500,
    tint: 0,
    preset: "custom",
  };
}

describe("white balance math", () => {
  test("neutral settings preserve RGB and alpha", () => {
    const input = new Uint8ClampedArray([
      10, 20, 30, 40,
      200, 150, 100, 128,
    ]);
    const output = new Uint8ClampedArray(input.length);

    applyWhiteBalanceToRgbaBytes(input, output, defaults());

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  test("temperature shifts red/blue channels", () => {
    const input = new Uint8ClampedArray([100, 100, 100, 255]);
    const output = new Uint8ClampedArray(input.length);

    applyWhiteBalanceToRgbaBytes(input, output, {
      ...defaults(),
      temperatureKelvin: 2000,
    });

    expect(output[0]).toBeGreaterThan(100);
    expect(output[2]).toBeLessThan(100);
    expect(output[3]).toBe(255);
  });

  test("tint shifts green channel", () => {
    const input = new Uint8ClampedArray([100, 100, 100, 255]);
    const output = new Uint8ClampedArray(input.length);

    applyWhiteBalanceToRgbaBytes(input, output, {
      ...defaults(),
      tint: 100,
    });

    expect(output[1]).toBeLessThan(100);
    expect(output[3]).toBe(255);
  });

  test("hasNonNeutralWhiteBalance detects changes", () => {
    expect(hasNonNeutralWhiteBalance(defaults())).toBe(false);
    expect(
      hasNonNeutralWhiteBalance({
        ...defaults(),
        temperatureKelvin: 5500,
      }),
    ).toBe(true);
    expect(
      hasNonNeutralWhiteBalance({
        ...defaults(),
        tint: 10,
      }),
    ).toBe(true);
  });

  test("sampleAverageRgb averages a region", () => {
    // 2x1 pixels: [R,G,B,A, R,G,B,A]
    const bytes = new Uint8ClampedArray([10, 20, 30, 255, 110, 120, 130, 255]);
    const avg = sampleAverageRgb(bytes, 2, 1, 0, 0, 1);

    expect(avg.r).toBeCloseTo((10 + 110) / 2, 6);
    expect(avg.g).toBeCloseTo((20 + 120) / 2, 6);
    expect(avg.b).toBeCloseTo((30 + 130) / 2, 6);
  });

  test("estimateWhiteBalanceFromRgb returns bounded values", () => {
    const result = estimateWhiteBalanceFromRgb({ r: 250, g: 10, b: 10 });

    expect(result.temperatureKelvin).toBeGreaterThanOrEqual(2000);
    expect(result.temperatureKelvin).toBeLessThanOrEqual(10000);
    expect(result.tint).toBeGreaterThanOrEqual(-100);
    expect(result.tint).toBeLessThanOrEqual(100);
  });
});
