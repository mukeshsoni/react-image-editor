import { describe, expect, test } from "vitest";

import { applySharpeningToRgbaBytes, createSharpeningBuffers } from "@/lib/sharpening";
import { DEFAULT_SHARPENING_SETTINGS } from "@/store/cropStore";

function runSharpen(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input.length);
  applySharpeningToRgbaBytes(
    input,
    output,
    width,
    height,
    { ...DEFAULT_SHARPENING_SETTINGS, amount, masking: 0, detail: 25, radius: 1 },
    createSharpeningBuffers(width * height),
  );
  return output;
}

describe("sharpening golden", () => {
  test("uniform image remains unchanged", () => {
    const width = 5;
    const height = 5;

    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 100;
      input[i + 1] = 100;
      input[i + 2] = 100;
      input[i + 3] = 255;
    }

    const output = runSharpen(input, width, height, 120);

    expect(Array.from(output)).toEqual(Array.from(input));
  });

  test("3x3 impulse changes center neighborhood", () => {
    const width = 3;
    const height = 3;

    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 0;
      input[i + 1] = 0;
      input[i + 2] = 0;
      input[i + 3] = 255;
    }

    // Bright center pixel.
    const center = (1 * width + 1) * 4;
    input[center] = 220;
    input[center + 1] = 220;
    input[center + 2] = 220;

    const output = runSharpen(input, width, height, 120);

    // Not an exact golden array (algorithm may evolve), but should be deterministic and non-trivial:
    // - output differs from input
    // - center remains brightest
    expect(Array.from(output)).not.toEqual(Array.from(input));

    const centerOut = output[center] ?? 0;
    expect(centerOut).toBeGreaterThan(0);

    const cornerOut = output[0] ?? 0;
    expect(centerOut).toBeGreaterThan(cornerOut);
  });
});
