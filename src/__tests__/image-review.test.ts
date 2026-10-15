// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { rgbToHsl } from "../engine/color";
import { constrainWarpedCrop } from "../engine/crop-constraints";
import type { Raster } from "../engine/pixels";
import { chooseRepairSource } from "../engine/repair";
import { PhotoRenderer, processPixels } from "../engine/renderer";
import { initialEdits } from "../model/settings";
import type { ImageEditorEdits, Rectangle } from "../model/types";

type Rgba = [number, number, number, number];

function raster(width: number, height: number, pixel: (x: number, y: number) => Rgba): Raster {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, pixels };
}

async function renderer(source: Raster): Promise<PhotoRenderer> {
  const canvas = createCanvas(source.width, source.height);
  canvas.getContext("2d").putImageData(new ImageData(source.pixels, source.width, source.height), 0, 0);
  const image = await loadImage(canvas.toBuffer("image/png"));
  // The native image/canvas supply the DOM drawing operations used by the renderer.
  return new PhotoRenderer(image as unknown as HTMLImageElement);
}

function framePixels(canvas: HTMLCanvasElement): Raster {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Missing native canvas context");
  return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
}

async function exported(photo: PhotoRenderer, edits: ImageEditorEdits): Promise<Raster> {
  const blob = await photo.encode(edits, "png", 100);
  const image = await loadImage(await blob.arrayBuffer());
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, pixels: context.getImageData(0, 0, image.width, image.height).data };
}

function pixel(image: Raster, x: number, y: number): number[] {
  const index = (y * image.width + x) * 4;
  return Array.from(image.pixels.slice(index, index + 4));
}

function commitCrop(edits: ImageEditorEdits, rect: Rectangle): ImageEditorEdits {
  return { ...edits, crop: { ...edits.crop, rect, committed: true, commit: {
    outputWidth: Math.max(1, Math.round(rect.width)), outputHeight: Math.max(1, Math.round(rect.height)),
    bakedOffset: { x: -rect.x, y: -rect.y }, rotationDegrees: edits.crop.settings.rotation ?? 0,
  } } };
}

function expectOpaque(image: Raster) {
  expect(image.width).toBeGreaterThan(0); expect(image.height).toBeGreaterThan(0);
  expect(image.pixels.filter((_, index) => index % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
}

beforeEach(() => {
  vi.stubGlobal("document", { createElement: (tag: string) => {
    if (tag !== "canvas") throw new Error(`Unexpected element: ${tag}`);
    return createCanvas(1, 1);
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe("review: crop frame transforms", () => {
  test("an uncommitted rotation is preview-only, including after a cached crop preview", async () => {
    const source = raster(64, 48, (x, y) => [x * 3, y * 4, 100, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.crop.settings.rotation = 30;
    // A restored draft may also carry a stale commit; the committed flag is authoritative.
    edits.crop.commit = { outputWidth: 20, outputHeight: 20, bakedOffset: { x: -10, y: -10 }, rotationDegrees: 30 };
    const displayed = { x: 32 - 20 * Math.sqrt(3) / 2 + 7, y: 24 - 10 - 14 * Math.sqrt(3) / 2 };
    expect(photo.framePoint({ x: 12, y: 10 }, edits, true).x).toBeCloseTo(displayed.x, 10);
    expect(photo.sourcePoint(displayed, edits, true)?.y).toBeCloseTo(10, 10);
    expect(pixel(framePixels(photo.frame(edits, true)), 0, 0)[3]).toBe(0);
    expect(photo.sourcePoint({ x: 12, y: 10 }, edits, false)).toEqual({ x: 12, y: 10 });
    expect(photo.framePoint({ x: 12, y: 10 }, edits, false)).toEqual({ x: 12, y: 10 });
    expect(framePixels(photo.frame(edits)).pixels).toEqual(source.pixels);
    const output = await exported(photo, edits);
    expect([output.width, output.height]).toEqual([64, 48]);
    expect(output.pixels).toEqual(source.pixels);
  });

  test("committed rotation/offset still drive coordinates and export independently of draft settings", async () => {
    const source = raster(100, 100, (x, y) => x < 50 ? [255, y < 50 ? 0 : 128, 0, 255] : [0, y < 50 ? 0 : 128, 255, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.crop.settings.rotation = 30;
    const committed = commitCrop(edits, { x: 20, y: 20, width: 60, height: 60 });
    committed.crop.settings = { ...committed.crop.settings, rotation: -30 };
    const sourcePoint = { x: 50 - 10 * Math.sqrt(3), y: 60 };
    expect(photo.sourcePoint({ x: 10, y: 30 }, committed, false)?.x).toBeCloseTo(sourcePoint.x, 10);
    expect(photo.sourcePoint({ x: 10, y: 30 }, committed, false)?.y).toBeCloseTo(60, 10);
    expect(photo.framePoint(sourcePoint, committed, false).x).toBeCloseTo(10, 10);
    expect(photo.framePoint(sourcePoint, committed, false).y).toBeCloseTo(30, 10);
    const output = await exported(photo, committed);
    expect([output.width, output.height]).toEqual([60, 60]);
    expect(pixel(output, 10, 30)).toEqual([255, 128, 0, 255]);
    expect([photo.frame(committed, true).width, photo.frame(committed, true).height]).toEqual([100, 100]);
  });
});

describe("review: automatic repair samples", () => {
  test.each([
    [{ x: 50, y: 50 }, { width: 100, height: 100 }, 10, { x: 70, y: 50 }],
    [{ x: 12.5, y: 50 }, { width: 100, height: 100 }, 1.1, { x: 14.7, y: 50 }],
    [{ x: 96, y: 50 }, { width: 100, height: 100 }, 10, { x: 76, y: 50 }],
    [{ x: 50, y: 2 }, { width: 100, height: 100 }, 10, { x: 70, y: 2 }],
    [{ x: 96, y: 96 }, { width: 100, height: 100 }, 10, { x: 76, y: 96 }],
    [{ x: 10, y: 50 }, { width: 20, height: 100 }, 12, { x: 10, y: 74 }],
    [{ x: 10, y: 94 }, { width: 20, height: 100 }, 12, { x: 10, y: 70 }],
  ] as const)("finds a disjoint sample for %j in %j", (point, dimensions, radius, expected) => {
    const source = chooseRepairSource(point, dimensions, radius);
    expect(source).toEqual(expected);
    expect(Math.hypot(source.x - point.x, source.y - point.y)).toBeGreaterThanOrEqual(radius * 2 - 1e-9);
  });

  test("uses the most separated available pixel if a brush covers the image", () => {
    expect(chooseRepairSource({ x: 7, y: 4 }, { width: 8, height: 5 }, 100)).toEqual({ x: 0, y: 0 });
    expect(chooseRepairSource({ x: 0, y: 0 }, { width: 1, height: 1 }, 10)).toEqual({ x: 0, y: 0 });
  });

  test("repair fallback removes a right-edge blemish instead of sampling it again", () => {
    const source = raster(100, 60, (x, y) => Math.hypot(x + 0.5 - 96, y + 0.5 - 30) < 6 ? [230, 10, 10, 255] : [24, 180, 40, 255]);
    const edits = initialEdits(source);
    edits.healing.ops = [{ id: "edge", type: "spot", mode: "spot", center: { x: 96, y: 30 }, radius: 6, feather: 0, opacity: 1 }];
    const result = processPixels(source, edits);
    expect(pixel(result, 96, 30)).toEqual([24, 180, 40, 255]);
    expect(pixel(source, 96, 30)).toEqual([230, 10, 10, 255]);
    expect(pixel(result, 10, 10)).toEqual([24, 180, 40, 255]);
  });
});

describe("review: point color input domain", () => {
  test("picking gray at 2000K selects its blue hue and a Range 0 shift changes it", async () => {
    const source = raster(20, 20, () => [128, 128, 128, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.whiteBalance.temperatureKelvin = 2000;
    const sample = photo.samplePointColor({ x: 10, y: 10 }, edits, false);
    // Independent linear-sRGB WB calculation: gains exp(-.5625), 1, exp(.5625).
    expect(sample).toEqual([98, 128, 166]);
    if (!sample) throw new Error("Expected a point-color sample");
    const hue = rgbToHsl(sample)[0];
    expect(hue * 360).toBeCloseTo(213.5294117647, 6);
    edits.color.pointColor = { hue, range: 0, hueShift: 100, saturationShift: 0, luminanceShift: 0 };
    expect(pixel(await exported(photo, edits), 10, 10)).toEqual([106, 98, 166, 255]);
    expect(photo.samplePointColor({ x: 10, y: 10 }, edits, false)).toEqual(sample);
    expect(pixel(photo.original, 10, 10)).toEqual([128, 128, 128, 255]);
  });

  test("sampling includes tone curves and repairs, but excludes downstream color and optical effects", async () => {
    const source = raster(40, 30, (x) => x < 20 ? [255, 0, 0, 255] : [128, 128, 128, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.healing.ops = [{ id: "sample", type: "spot", mode: "spot", center: { x: 10, y: 15 }, source: { x: 30, y: 15 }, radius: 6, feather: 0, opacity: 1 }];
    edits.toneCurve.point.r = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    edits.color.saturation = -100;
    edits.color.mixerHsl.aqua.hue = 100;
    edits.geometryOptics.optics = { vignette: 100, grain: 100, dehaze: 100 };
    expect(photo.samplePointColor({ x: 10, y: 15 }, edits, false)).toEqual([0, 128, 128]);
    expect(pixel(photo.original, 10, 15)).toEqual([255, 0, 0, 255]);
  });

  test("corrected frame sampling accounts for perspective, committed crop, and rotation", async () => {
    // Corrected x=20 maps to source x~11 with horizontal=100. Raw x=20 is blue.
    const source = raster(100, 100, (x) => x < 16 ? [255, 0, 0, 255] : [0, 0, 255, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.geometryOptics.perspective.horizontal = 100;
    edits.crop.settings.rotation = 30;
    const committed = commitCrop(edits, { x: 10, y: 10, width: 80, height: 80 });
    committed.crop.settings = { ...committed.crop.settings, rotation: -30 };
    expect(photo.samplePointColor({ x: 40 - 15 * Math.sqrt(3), y: 25 }, committed, false)).toEqual([255, 0, 0]);
    expect(photo.samplePointColor({ x: 50 - 15 * Math.sqrt(3), y: 65 }, committed, true)).toEqual([255, 0, 0]);
    expect(photo.samplePointColor({ x: 20, y: 50 }, edits, false)).toEqual([255, 0, 0]);
    expect(photo.samplePointColor({ x: -1, y: 30 }, committed, false)).toBeNull();
    expect(photo.samplePointColor({ x: 81, y: 30 }, committed, false)).toBeNull();
    expect(photo.samplePointColor({ x: 5, y: 50 }, edits, false)).toBeNull();
  });

  test("transparent clicked pixels cannot borrow a hue from nearby opaque pixels", async () => {
    const source = raster(20, 20, (x, y) => x === 10 && y === 10 ? [0, 0, 0, 0] : [255, 0, 0, 255]);
    expect((await renderer(source)).samplePointColor({ x: 10, y: 10 }, initialEdits(source), false)).toBeNull();
  });
});

describe("review: warped crop constraints", () => {
  test("leaves constraint-disabled and identity geometry behavior unchanged", () => {
    const edits = initialEdits({ width: 100, height: 100 });
    const rect = { x: 12, y: 8, width: 60, height: 40 };
    edits.crop.settings.rotation = 30;
    expect(constrainWarpedCrop(rect, { width: 100, height: 100 }, edits.crop.settings, edits.geometryOptics)).toBe(rect);
    edits.geometryOptics.perspective.horizontal = 100;
    expect(constrainWarpedCrop(rect, { width: 100, height: 100 }, { ...edits.crop.settings, constrainCrop: false }, edits.geometryOptics)).toBe(rect);
  });

  test("Original at horizontal=100 exports an opaque constrained crop without filling alpha", async () => {
    const source = raster(100, 100, () => [42, 99, 130, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.geometryOptics.perspective.horizontal = 100;
    const before = structuredClone(edits);
    expect(pixel(await exported(photo, commitCrop(edits, edits.crop.rect)), 5, 50)[3]).toBe(0);
    const rect = constrainWarpedCrop(edits.crop.rect, source, edits.crop.settings, edits.geometryOptics);
    expect(edits).toEqual(before);
    expect(rect.width).toBeGreaterThan(60); expect(rect.width).toBeLessThan(100);
    expect(rect.width / rect.height).toBeCloseTo(1, 12);
    const constrained = commitCrop(edits, rect);
    expectOpaque(framePixels(photo.frame(constrained)));
    const output = await exported(photo, constrained);
    expectOpaque(output);
    expect(pixel(output, 5, Math.floor(output.height / 2))).toEqual([42, 99, 130, 255]);
  });

  test("checks nonlinear boundary extrema even when all four warped corners are valid", async () => {
    const source = raster(100, 100, () => [42, 99, 130, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.geometryOptics.perspective = { horizontal: 50, vertical: 50, aspect: -100 };
    edits.geometryOptics.lensCorrections.distortion = -50;
    const warped = processPixels(source, edits);
    for (const [x, y] of [[0, 0], [25, 0], [0, 10], [25, 10]]) expect(pixel(warped, x, y)[3]).toBe(255);
    expect(pixel(warped, 13, 0)[3]).toBe(0);
    const rect = constrainWarpedCrop({ x: 0, y: 0, width: 25, height: 10 }, source, edits.crop.settings, edits.geometryOptics);
    expect(rect.width / rect.height).toBeCloseTo(2.5, 12);
    expectOpaque(await exported(photo, commitCrop(edits, rect)));
  });

  test.each([
    [100, 0, 0, 0, 45], [-100, 0, 0, 0, -45], [0, 100, 0, 0, 30], [0, -100, 0, 0, -30],
    [100, 100, 100, 100, 37], [-100, -100, -100, 100, -37],
    [100, -100, -100, -100, 45], [-100, 100, 100, -50, -45],
    [0, 0, 0, 100, 0], [0, 0, 0, -100, 20],
  ])("keeps translated crops opaque under h=%s v=%s aspect=%s lens=%s rotation=%s", async (horizontal, vertical, aspect, distortion, rotation) => {
    const source = raster(144, 108, () => [42, 99, 130, 255]);
    const photo = await renderer(source), edits = initialEdits(source);
    edits.geometryOptics.perspective = { horizontal, vertical, aspect };
    edits.geometryOptics.lensCorrections.distortion = distortion;
    edits.crop.settings.rotation = rotation;
    for (const proposed of [{ x: 5, y: 12, width: 96, height: 72 }, { x: 84, y: 60, width: 54, height: 36 }]) {
      const rect = constrainWarpedCrop(proposed, source, edits.crop.settings, edits.geometryOptics);
      expect(rect.width / rect.height).toBeCloseTo(proposed.width / proposed.height, 12);
      expectOpaque(await exported(photo, commitCrop(edits, rect)));
    }
  });

  test("already valid translated crops stay put and extreme aspect ratios remain positive", () => {
    const size = { width: 100, height: 100 }, edits = initialEdits(size);
    edits.geometryOptics.perspective.horizontal = 100;
    const small = { x: 60, y: 35, width: 12, height: 8 };
    expect(constrainWarpedCrop(small, size, edits.crop.settings, edits.geometryOptics)).toBe(small);
    for (const ratio of [1e-10, 1e10]) {
      const width = Math.min(100, 100 * ratio), height = width / ratio;
      const rect = constrainWarpedCrop({ x: (100 - width) / 2, y: (100 - height) / 2, width, height }, size, edits.crop.settings, edits.geometryOptics);
      expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
      expect(rect.width / rect.height / ratio).toBeCloseTo(1, 12);
    }
  });
});
