import { describe, expect, test } from "vitest";

import { createDefaultPipeline, runPipeline } from "@/editor/pixel-pipeline";
import type { PipelineBuffers } from "@/editor/pixel-pipeline/types";


function makeSolidRgba(width: number, height: number, r: number, g: number, b: number) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  return out;
}

describe("geometry-optics processor", () => {
  test("vignette modifies pixels", () => {
    const width = 40;
    const height = 40;

    const input = makeSolidRgba(width, height, 200, 200, 200);

    const buffers: PipelineBuffers = {
      in: input,
      out: new Uint8ClampedArray(width * height * 4),
      temp: new Uint8ClampedArray(width * height * 4),
    };

    const pipeline = createDefaultPipeline();
    expect(pipeline.map((p) => p.id)).toContain("geometry-optics");

    const original = new Uint8ClampedArray(input);

    runPipeline(pipeline, buffers, {
      width,
      height,
      geometryOptics: {
        perspective: { vertical: 0, horizontal: 0, aspect: 0 },
        lensCorrections: { distortion: 0, chromaticAberration: false },
        optics: { vignette: 80, grain: 0, dehaze: 0 },
      },
    });

    const diffCount = buffers.out.reduce(
      (count, value, index) => count + (value !== original[index] ? 1 : 0),
      0,
    );

    expect(diffCount).toBeGreaterThan(0);
  });

  test("distortion modifies pixels", () => {
    const width = 32;
    const height = 32;

    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        data[idx] = x * 8;
        data[idx + 1] = y * 8;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }

    const input = new Uint8ClampedArray(data);

    const buffers: PipelineBuffers = {
      in: input,
      out: new Uint8ClampedArray(data.length),
      temp: new Uint8ClampedArray(data.length),
    };

    const pipeline = createDefaultPipeline();
    expect(pipeline.map((p) => p.id)).toContain("geometry-optics");

    const original = new Uint8ClampedArray(input);

    runPipeline(pipeline, buffers, {
      width,
      height,
      geometryOptics: {
        perspective: { vertical: 0, horizontal: 0, aspect: 0 },
        lensCorrections: { distortion: 70, chromaticAberration: false },
        optics: { vignette: 0, grain: 0, dehaze: 0 },
      },
    });

    const diffCount = buffers.out.reduce(
      (count, value, index) => count + (value !== original[index] ? 1 : 0),
      0,
    );

    expect(diffCount).toBeGreaterThan(0);
  });
});
