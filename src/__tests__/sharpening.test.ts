import { describe, expect, test } from "vitest";

import { applySharpeningToRgbaBytes, createSharpeningBuffers } from "@/lib/sharpening";
import { DEFAULT_SHARPENING_SETTINGS } from "@/store/cropStore";

describe("sharpening", () => {
  test("amount=0 produces identical output", () => {
    const input = new Uint8ClampedArray([
      10, 20, 30, 255, // px0
      40, 50, 60, 200, // px1
    ]);

    const output = new Uint8ClampedArray(input.length);
    const width = 2;
    const height = 1;

    applySharpeningToRgbaBytes(
      input,
      output,
      width,
      height,
      { ...DEFAULT_SHARPENING_SETTINGS, amount: 0 },
      createSharpeningBuffers(width * height),
    );

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  test("preserves alpha channel", () => {
    const input = new Uint8ClampedArray([
      10, 10, 10, 10,
      240, 240, 240, 123,
      10, 240, 10, 77,
      250, 10, 10, 0,
    ]);

    const output = new Uint8ClampedArray(input.length);
    const width = 2;
    const height = 2;

    applySharpeningToRgbaBytes(
      input,
      output,
      width,
      height,
      { ...DEFAULT_SHARPENING_SETTINGS, amount: 80 },
      createSharpeningBuffers(width * height),
    );

    for (let i = 3; i < output.length; i += 4) {
      expect(output[i]).toBe(input[i]);
    }
  });

  test("clamps output channels safely", () => {
    const input = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);

    const output = new Uint8ClampedArray(input.length);
    const width = 2;
    const height = 2;

    applySharpeningToRgbaBytes(
      input,
      output,
      width,
      height,
      { ...DEFAULT_SHARPENING_SETTINGS, amount: 150, radius: 3, masking: 0 },
      createSharpeningBuffers(width * height),
    );

    for (let i = 0; i < output.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        expect(output[i + c]).toBeGreaterThanOrEqual(0);
        expect(output[i + c]).toBeLessThanOrEqual(255);
      }
    }
  });
});
