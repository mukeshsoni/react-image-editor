import { describe, expect, test } from "vitest";

import { cloneRaster } from "../engine/pixels";
import type { Raster } from "../engine/pixels";
import { processPixels } from "../engine/renderer";
import { estimateLevel } from "../engine/straighten";
import { initialEdits } from "../model/settings";

function image(width: number, height: number, pixel: (x: number, y: number) => number[]): Raster {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, pixels };
}

describe("non-destructive rendering", () => {
  test("neutral settings preserve RGBA and edits never alter the source", () => {
    const source = image(16, 16, (x, y) => [x * 17, y * 17, x * y, (x + y) % 2 ? 127 : 255]);
    const original = cloneRaster(source);
    expect(processPixels(source, initialEdits(source)).pixels).toEqual(original.pixels);
    const edits = initialEdits(source); edits.light.exposure = 2;
    expect(processPixels(source, edits).pixels).not.toEqual(original.pixels);
    expect(source.pixels).toEqual(original.pixels);
  });

  test("copies dimensions exposed by DOM-style prototype getters", () => {
    class BrowserPixels {
      pixels = new Uint8ClampedArray([255, 0, 0, 255]);
      get width() { return 1; }
      get height() { return 1; }
    }
    const result = processPixels(new BrowserPixels(), initialEdits({ width: 1, height: 1 }));
    expect([result.width, result.height]).toEqual([1, 1]);
    expect(Array.from(result.pixels)).toEqual([255, 0, 0, 255]);
  });

  test("exposure operates in linear light", () => {
    const edits = initialEdits(); edits.light.exposure = -2;
    const result = processPixels(image(1, 1, () => [255, 255, 255, 255]), edits);
    expect(Array.from(result.pixels)).toEqual([137, 137, 137, 255]);
  });

  test("grain is repeatable and unaffected by crop metadata", () => {
    const source = image(32, 24, () => [128, 128, 128, 255]);
    const edits = initialEdits(source); edits.geometryOptics.optics.grain = 100;
    const first = processPixels(source, edits);
    expect(first.pixels).not.toEqual(source.pixels);
    edits.crop.committed = true;
    edits.crop.commit = { outputWidth: 10, outputHeight: 10, bakedOffset: { x: -5, y: -5 }, rotationDegrees: 0 };
    expect(processPixels(source, edits).pixels).toEqual(first.pixels);
  });

  test("chroma-only denoise preserves grayscale texture", () => {
    const source = image(16, 16, (x, y) => { const v = (x + y) % 2 ? 70 : 180; return [v, v, v, 255]; });
    const edits = initialEdits(source); edits.denoise = { luminance: 0, color: 100, detail: 0 };
    expect(processPixels(source, edits).pixels).toEqual(source.pixels);
  });

  test("automatic level finds a sloped edge and rejects a featureless image", () => {
    const slope = image(120, 80, (x, y) => { const v = Math.min(255, Math.max(0, 128 + (y - x / 4 - 30) * 8)); return [v, v, v, 255]; });
    const result = estimateLevel(slope);
    expect(result.confidence).toBeGreaterThan(0.12);
    expect(Math.abs(result.angle + Math.atan(0.25) * 180 / Math.PI)).toBeLessThan(3);
    expect(estimateLevel(image(40, 40, () => [100, 100, 100, 255])).confidence).toBe(0);
  });
});
