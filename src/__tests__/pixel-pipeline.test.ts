import { describe, expect, test } from "vitest";

import type { PixelProcessor } from "@/editor/pixel-pipeline";
import { runPipeline } from "@/editor/pixel-pipeline";

describe("pixel pipeline", () => {
  test("copies input to output when no processors enabled", () => {
    const input = new Uint8ClampedArray([10, 20, 30, 255]);
    const buffers = {
      in: input,
      out: new Uint8ClampedArray(input.length),
      temp: new Uint8ClampedArray(input.length),
    };

    const disabledProcessor = {
      id: "color",
      order: 1,
      isEnabled: () => false,
      apply: () => {
        throw new Error("should not run");
      },
    } satisfies PixelProcessor;

    runPipeline([disabledProcessor], buffers, {});

    expect(Array.from(buffers.out)).toEqual(Array.from(input));
  });
});
