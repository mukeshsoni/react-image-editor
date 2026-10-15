import type { Dimensions, GeometrySettings, Point } from "../model/types";
import { limit } from "./geometry";
import type { Raster } from "./pixels";

export function needsWarp(settings: GeometrySettings): boolean {
  return Boolean(settings.perspective.vertical || settings.perspective.horizontal || settings.perspective.aspect || settings.lensCorrections.distortion);
}

/** Maps a displayed, corrected pixel back to the original source sample. */
export function sourceCoordinate(point: Point, size: Dimensions, settings: GeometrySettings): Point {
  if (!needsWarp(settings)) return point;
  const cx = (size.width - 1) / 2, cy = (size.height - 1) / 2;
  const rx = Math.max(1, cx), ry = Math.max(1, cy);
  const aspect = Math.exp((settings.perspective.aspect ?? 0) / 180);
  let x = (point.x - cx) / rx / aspect, y = (point.y - cy) / ry * aspect;
  const denominator = 1 + x * settings.perspective.horizontal / 250 + y * settings.perspective.vertical / 250;
  x /= denominator; y /= denominator;
  const radial = 1 + settings.lensCorrections.distortion / 500 * (x * x + y * y);
  return { x: cx + x * radial * rx, y: cy + y * radial * ry };
}

/** Numerically invert the same mapping for source/target overlay pins. */
export function correctedCoordinate(point: Point, size: Dimensions, settings: GeometrySettings): Point {
  if (!needsWarp(settings)) return point;
  let guess = { ...point };
  for (let iteration = 0; iteration < 10; iteration++) {
    const value = sourceCoordinate(guess, size, settings);
    const error = { x: value.x - point.x, y: value.y - point.y };
    if (Math.hypot(error.x, error.y) < 0.01) break;
    const x = sourceCoordinate({ x: guess.x + 0.1, y: guess.y }, size, settings);
    const y = sourceCoordinate({ x: guess.x, y: guess.y + 0.1 }, size, settings);
    const a = (x.x - value.x) * 10, b = (y.x - value.x) * 10;
    const c = (x.y - value.y) * 10, d = (y.y - value.y) * 10;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) break;
    guess = { x: guess.x - (d * error.x - b * error.y) / determinant, y: guess.y - (a * error.y - c * error.x) / determinant };
  }
  return guess;
}

function bilinear(image: Raster, x: number, y: number, channel: number): number {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(image.width - 1, x0 + 1), y1 = Math.min(image.height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const at = (px: number, py: number) => image.pixels[(py * image.width + px) * 4 + channel];
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x1, y0) * fx * (1 - fy) + at(x0, y1) * (1 - fx) * fy + at(x1, y1) * fx * fy;
}

export function geometryPass(image: Raster, settings: GeometrySettings): Raster {
  if (!needsWarp(settings) && !settings.lensCorrections.chromaticAberration) return image;
  const result: Raster = { width: image.width, height: image.height, pixels: new Uint8ClampedArray(image.pixels.length) };
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const point = sourceCoordinate({ x, y }, image, settings);
    const index = (y * image.width + x) * 4;
    for (let channel = 0; channel < 4; channel++) {
      const shift = settings.lensCorrections.chromaticAberration && channel < 3 ? (channel - 1) * 0.001 : 0;
      result.pixels[index + channel] = bilinear(image, point.x + (point.x - image.width / 2) * shift, point.y + (point.y - image.height / 2) * shift, channel);
    }
  }
  return result;
}

export function opticalEffects(image: Raster, { vignette, grain, dehaze }: GeometrySettings["optics"]): void {
  if (!vignette && !grain && !dehaze) return;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const index = (y * image.width + x) * 4;
    if (!image.pixels[index + 3]) continue;
    const nx = (x + 0.5) / image.width * 2 - 1, ny = (y + 0.5) / image.height * 2 - 1;
    const edge = Math.min(1, (nx * nx + ny * ny) / 1.8) * vignette / 100;
    const seed = Math.imul(x + 11, 374761393) ^ Math.imul(y + 37, 668265263);
    const random = ((Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) / 4294967295 - 0.5) * grain * 0.6;
    for (let channel = 0; channel < 3; channel++) {
      let value = (image.pixels[index + channel] - 128 - dehaze / 8) * (1 + dehaze / 160) + 128;
      value = edge >= 0 ? value * (1 - edge) : value + (255 - value) * -edge;
      image.pixels[index + channel] = limit(value + random, 0, 255);
    }
  }
}
