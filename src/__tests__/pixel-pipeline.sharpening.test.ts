import { describe, expect, test, vi } from "vitest";

import { runPipeline } from "@/editor/pixel-pipeline";
import type { PixelProcessor } from "@/editor/pixel-pipeline";
import { DEFAULT_SHARPENING_SETTINGS } from "@/store/cropStore";

vi.mock("@/lib/sharpening", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sharpening")>("@/lib/sharpening");

  return {
    ...actual,
    applySharpeningToRgbaBytes: vi.fn((input: Uint8ClampedArray, output: Uint8ClampedArray) => {
      // Make the processor observable: invert red channel.
      for (let i = 0; i < input.length; i += 4) {
        output[i] = 255 - (input[i] ?? 0);
        output[i + 1] = input[i + 1] ?? 0;
        output[i + 2] = input[i + 2] ?? 0;
        output[i + 3] = input[i + 3] ?? 0;
      }
    }),
  };
});

describe("pixel pipeline (sharpening)", () => {
  const getSharpeningProcessor = async () => {
    vi.resetModules();
    const mod = await import("@/editor/pixel-pipeline/processors/sharpening");
    return mod.sharpeningProcessor;
  };

  test("runs sharpening processor and changes output", async () => {
    const sharpeningProcessor = await getSharpeningProcessor();
    const width = 3;
    const height = 3;

    // Non-uniform input (grayscale) with a center impulse.
    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 0;
      input[i + 1] = 0;
      input[i + 2] = 0;
      input[i + 3] = 128;
    }

    const center = (1 * width + 1) * 4;
    input[center] = 255;
    input[center + 1] = 255;
    input[center + 2] = 255;

    const originalInput = new Uint8ClampedArray(input);

    const buffers = {
      in: input,
      out: new Uint8ClampedArray(input.length),
      temp: new Uint8ClampedArray(input.length),
    };

    const context = {
      width,
      height,
      sharpening: { ...DEFAULT_SHARPENING_SETTINGS, amount: 120, masking: 0 },
    };

    runPipeline([sharpeningProcessor] satisfies PixelProcessor[], buffers, context);

    // Processor should write through to temp/out.
    expect(Array.from(buffers.out)).not.toEqual(Array.from(originalInput));

    for (let i = 3; i < buffers.out.length; i += 4) {
      expect(buffers.out[i]).toBe(128);
    }
  });

  test("uniform image remains unchanged", async () => {
    const sharpeningProcessor = await getSharpeningProcessor();
    const width = 3;
    const height = 3;

    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 100;
      input[i + 1] = 100;
      input[i + 2] = 100;
      input[i + 3] = 255;
    }

    const buffers = {
      in: input,
      out: new Uint8ClampedArray(input.length),
      temp: new Uint8ClampedArray(input.length),
    };

    runPipeline([sharpeningProcessor] satisfies PixelProcessor[], buffers, {
      width,
      height,
      sharpening: { ...DEFAULT_SHARPENING_SETTINGS, amount: 150 },
    });

    expect(Array.from(buffers.out)).toEqual(Array.from(input));
  });
});
