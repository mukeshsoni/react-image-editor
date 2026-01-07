import { describe, expect, test } from "vitest";

import { applyDenoiseToRgbaBytes, createDenoiseBuffers } from "@/lib/denoise";
import { DEFAULT_DENOISE_SETTINGS } from "@/store/cropStore";

describe("denoise", () => {
  test("neutral params produce identical output", () => {
    const input = new Uint8ClampedArray([
      10, 20, 30, 255, // px0
      40, 50, 60, 200, // px1
    ]);

    const output = new Uint8ClampedArray(input.length);

    applyDenoiseToRgbaBytes(
      input,
      output,
      2,
      1,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 0, color: 0 },
      createDenoiseBuffers(2),
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

    applyDenoiseToRgbaBytes(
      input,
      output,
      2,
      2,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 80 },
      createDenoiseBuffers(4),
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

    applyDenoiseToRgbaBytes(
      input,
      output,
      2,
      2,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 100, color: 100, detail: 0 },
      createDenoiseBuffers(4),
    );

    for (let i = 0; i < output.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        expect(output[i + c]).toBeGreaterThanOrEqual(0);
        expect(output[i + c]).toBeLessThanOrEqual(255);
      }
    }
  });

  test("luminance smoothing reduces variance in flat areas", () => {
    const width = 5;
    const height = 5;

    // Mostly flat gray with a small noisy perturbation.
    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 100;
      input[i + 1] = 100;
      input[i + 2] = 100;
      input[i + 3] = 255;
    }

    // Add small noise at center.
    const center = (2 * width + 2) * 4;
    input[center] = 120;
    input[center + 1] = 120;
    input[center + 2] = 120;

    const output = new Uint8ClampedArray(input.length);

    applyDenoiseToRgbaBytes(
      input,
      output,
      width,
      height,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 100, color: 0, detail: 0 },
      createDenoiseBuffers(width * height),
    );

    // Center pixel should get pulled toward neighbors.
    expect(output[center]).toBeLessThan(input[center]);
  });

  test("higher detail preserves a hard edge better", () => {
    const width = 5;
    const height = 1;

    // Step edge: left is black, right is white.
    const input = new Uint8ClampedArray(width * height * 4);
    for (let x = 0; x < width; x += 1) {
      const i = x * 4;
      const v = x < 2 ? 0 : 255;
      input[i] = v;
      input[i + 1] = v;
      input[i + 2] = v;
      input[i + 3] = 255;
    }

    const lowDetail = new Uint8ClampedArray(input.length);
    const highDetail = new Uint8ClampedArray(input.length);

    applyDenoiseToRgbaBytes(
      input,
      lowDetail,
      width,
      height,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 100, color: 0, detail: 0 },
      createDenoiseBuffers(width * height),
    );

    applyDenoiseToRgbaBytes(
      input,
      highDetail,
      width,
      height,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 100, color: 0, detail: 100 },
      createDenoiseBuffers(width * height),
    );

    // Pixel just left of the edge should remain closer to black at high detail.
    const edgeLeft = 1 * 4;
    expect(highDetail[edgeLeft]).toBeLessThanOrEqual(lowDetail[edgeLeft]);

    // Pixel just right of the edge should remain closer to white at high detail.
    const edgeRight = 2 * 4;
    expect(highDetail[edgeRight]).toBeGreaterThanOrEqual(lowDetail[edgeRight]);
  });

  test("color denoise reduces chroma speckle without large luma shift", () => {
    const width = 3;
    const height = 3;

    // Base neutral grey with a single chroma-speckle pixel (reddish) in center.
    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 128;
      input[i + 1] = 128;
      input[i + 2] = 128;
      input[i + 3] = 255;
    }

    const center = (1 * width + 1) * 4;
    input[center] = 150;
    input[center + 1] = 120;
    input[center + 2] = 120;

    const output = new Uint8ClampedArray(input.length);

    applyDenoiseToRgbaBytes(
      input,
      output,
      width,
      height,
      { ...DEFAULT_DENOISE_SETTINGS, luminance: 0, color: 100, detail: 0 },
      createDenoiseBuffers(width * height),
    );

    // Center should move closer to neutral grey (channels converge).
    const r = output[center] ?? 0;
    const g = output[center + 1] ?? 0;
    const b = output[center + 2] ?? 0;

    expect(Math.abs(r - g)).toBeLessThan(Math.abs((input[center] ?? 0) - (input[center + 1] ?? 0)));
    expect(Math.abs(r - b)).toBeLessThan(Math.abs((input[center] ?? 0) - (input[center + 2] ?? 0)));

    // Luma should remain in a reasonable neighborhood (avoid big shifts).
    const lumaIn = 0.2126 * (input[center] ?? 0) + 0.7152 * (input[center + 1] ?? 0) + 0.0722 * (input[center + 2] ?? 0);
    const lumaOut = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(Math.abs(lumaOut - lumaIn)).toBeLessThan(10);
  });
});
