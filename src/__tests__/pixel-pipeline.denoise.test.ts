import { describe, expect, test, vi } from "vitest";

import { runPipeline } from "@/editor/pixel-pipeline";
import type { PixelProcessor } from "@/editor/pixel-pipeline";
import { DEFAULT_DENOISE_SETTINGS } from "@/store/cropStore";

vi.mock("@/lib/denoise", async () => {
  const actual = await vi.importActual<typeof import("@/lib/denoise")>("@/lib/denoise");

  return {
    ...actual,
    applyDenoiseToRgbaBytes: vi.fn((input: Uint8ClampedArray, output: Uint8ClampedArray) => {
      // Make the processor observable: invert green channel.
      for (let i = 0; i < input.length; i += 4) {
        output[i] = input[i] ?? 0;
        output[i + 1] = 255 - (input[i + 1] ?? 0);
        output[i + 2] = input[i + 2] ?? 0;
        output[i + 3] = input[i + 3] ?? 0;
      }
    }),
  };
});

describe("pixel pipeline (denoise)", () => {
  const getDenoiseProcessor = async () => {
    vi.resetModules();
    const mod = await import("@/editor/pixel-pipeline/processors/denoise");
    return mod.denoiseProcessor;
  };

  test("runs denoise processor and changes output", async () => {
    const denoiseProcessor = await getDenoiseProcessor();
    const width = 3;
    const height = 3;

    const input = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = 10;
      input[i + 1] = 20;
      input[i + 2] = 30;
      input[i + 3] = 128;
    }

    const originalInput = new Uint8ClampedArray(input);

    const buffers = {
      in: input,
      out: new Uint8ClampedArray(input.length),
      temp: new Uint8ClampedArray(input.length),
    };

    const context = {
      width,
      height,
      denoise: { ...DEFAULT_DENOISE_SETTINGS, luminance: 80 },
    };

    runPipeline([denoiseProcessor] satisfies PixelProcessor[], buffers, context);

    expect(Array.from(buffers.out)).not.toEqual(Array.from(originalInput));

    for (let i = 3; i < buffers.out.length; i += 4) {
      expect(buffers.out[i]).toBe(128);
    }
  });

  test("uniform image remains unchanged when denoise is neutral", async () => {
    const denoiseProcessor = await getDenoiseProcessor();
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

    runPipeline([denoiseProcessor] satisfies PixelProcessor[], buffers, {
      width,
      height,
      denoise: { ...DEFAULT_DENOISE_SETTINGS, luminance: 0, color: 0 },
    });

    expect(Array.from(buffers.out)).toEqual(Array.from(input));
  });

  test("denoise runs before sharpening when both are enabled", async () => {
    vi.resetModules();

    vi.doMock("@/lib/sharpening", async () => {
      const actual = await vi.importActual<typeof import("@/lib/sharpening")>("@/lib/sharpening");
      return {
        ...actual,
        applySharpeningToRgbaBytes: vi.fn((input: Uint8ClampedArray, output: Uint8ClampedArray) => {
          // Make processor observable: invert red channel.
          for (let i = 0; i < input.length; i += 4) {
            output[i] = 255 - (input[i] ?? 0);
            output[i + 1] = input[i + 1] ?? 0;
            output[i + 2] = input[i + 2] ?? 0;
            output[i + 3] = input[i + 3] ?? 0;
          }
        }),
      };
    });

    const denoiseMod = await import("@/editor/pixel-pipeline/processors/denoise");
    const sharpeningMod = await import("@/editor/pixel-pipeline/processors/sharpening");

    const denoiseProcessor = denoiseMod.denoiseProcessor;
    const sharpeningProcessor = sharpeningMod.sharpeningProcessor;

    const width = 1;
    const height = 1;

    const input = new Uint8ClampedArray([10, 20, 30, 255]);

    const buffers = {
      in: input,
      out: new Uint8ClampedArray(input.length),
      temp: new Uint8ClampedArray(input.length),
    };

    runPipeline(
      [sharpeningProcessor, denoiseProcessor] satisfies PixelProcessor[],
      buffers,
      {
        width,
        height,
        denoise: { ...DEFAULT_DENOISE_SETTINGS, luminance: 80 },
        sharpening: { amount: 120, radius: 1, detail: 25, masking: 0 },
      },
    );

    // Pipeline sorts by `order`, so denoise (45) runs before sharpening (50).
    // Expect order:
    // - Denoise inverts green: g=235
    // - Sharpening then inverts red: r=245
    expect(Array.from(buffers.out)).toEqual([245, 235, 30, 255]);
  });
});
