import type { Dimensions, Point } from "../model/types";

export type Raster = Dimensions & { pixels: Uint8ClampedArray };
export type Triplet = [number, number, number];
export const luminance = (r: number, g: number, b: number): number => r * 0.2126 + g * 0.7152 + b * 0.0722;

export function cloneRaster(source: Raster): Raster {
  return { width: source.width, height: source.height, pixels: new Uint8ClampedArray(source.pixels) };
}

export function sampleNeighborhood(source: Raster, point: Point): Triplet | null {
  const sum: Triplet = [0, 0, 0];
  let weight = 0;
  for (let y = Math.max(0, Math.floor(point.y) - 2); y <= Math.min(source.height - 1, Math.floor(point.y) + 2); y++) {
    for (let x = Math.max(0, Math.floor(point.x) - 2); x <= Math.min(source.width - 1, Math.floor(point.x) + 2); x++) {
      const index = (y * source.width + x) * 4, alpha = source.pixels[index + 3] / 255;
      for (let channel = 0; channel < 3; channel++) sum[channel] += source.pixels[index + channel] * alpha;
      weight += alpha;
    }
  }
  return weight ? sum.map((value) => value / weight) as Triplet : null;
}
