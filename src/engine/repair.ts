import type { Dimensions, Point, RepairOperation } from "../model/types";
import { limit } from "./geometry";
import { cloneRaster } from "./pixels";
import type { Raster, Triplet } from "./pixels";

/** Prefer a non-overlapping sample to the right, then the other available sides. */
export function chooseRepairSource(point: Point, dimensions: Dimensions, radius: number): Point {
  const maxX = Math.max(0, dimensions.width - 1), maxY = Math.max(0, dimensions.height - 1);
  const anchor = { x: limit(point.x, 0, maxX), y: limit(point.y, 0, maxY) };
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const separation = r * 2;
  const offsets = [{ x: separation, y: 0 }, { x: -separation, y: 0 }, { x: 0, y: separation }, { x: 0, y: -separation }];
  // Keep the entire (possibly edge-clipped) target footprint available at the source.
  const left = Math.min(r, anchor.x), right = maxX - Math.min(r, maxX - anchor.x);
  const top = Math.min(r, anchor.y), bottom = maxY - Math.min(r, maxY - anchor.y);
  const candidates = offsets.map((offset) => ({ x: limit(anchor.x + offset.x, left, right), y: limit(anchor.y + offset.y, top, bottom) }));
  for (const x of [right, left]) for (const y of [bottom, top]) candidates.push({ x, y });
  const distance = (candidate: Point) => Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y);
  const separated = candidates.find((candidate) => distance(candidate) >= separation - 1e-9);
  if (separated) return separated;
  // A large brush may leave no full, disjoint source patch. Maximize separation instead
  // of clamping a preferred source back onto the blemish.
  for (const x of [maxX, 0]) for (const y of [maxY, 0]) candidates.push({ x, y });
  return candidates.reduce((best, candidate) => distance(candidate) > distance(best) ? candidate : best, anchor);
}

function surroundings(image: Raster, point: Point, radius: number): Triplet {
  const rgb: Triplet = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const x = limit(Math.round(point.x + radius * Math.cos(angle)), 0, image.width - 1);
    const y = limit(Math.round(point.y + radius * Math.sin(angle)), 0, image.height - 1);
    const index = (y * image.width + x) * 4;
    if (!image.pixels[index + 3]) continue;
    for (let c = 0; c < 3; c++) rgb[c] += image.pixels[index + c];
    count++;
  }
  return rgb.map((value) => value / (count || 1)) as Triplet;
}

export function repair(image: Raster, operations: readonly RepairOperation[]): void {
  for (const operation of operations) {
    const path = operation.type === "spot" ? [operation.center] : operation.points;
    const anchor = path[0];
    if (!anchor || operation.radius <= 0) continue;
    const source = operation.source ?? chooseRepairSource(anchor, image, operation.radius);
    const before = cloneRaster(image);
    const targetMean = surroundings(before, anchor, operation.radius * 2);
    const sourceMean = surroundings(before, source, operation.radius * 2);
    const correction = targetMean.map((value, c) => operation.mode === "heal" ? value - sourceMean[c] : 0);
    const coverage = new Float32Array(image.width * image.height);
    const radius = operation.radius, solid = radius * (1 - limit(operation.feather, 0, 1));

    function stamp(point: Point) {
      for (let y = Math.max(0, Math.floor(point.y - radius)); y <= Math.min(image.height - 1, Math.ceil(point.y + radius)); y++) {
        for (let x = Math.max(0, Math.floor(point.x - radius)); x <= Math.min(image.width - 1, Math.ceil(point.x + radius)); x++) {
          const d = Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y);
          if (d > radius) continue;
          const opacity = operation.opacity * (d <= solid ? 1 : (radius - d) / Math.max(0.0001, radius - solid));
          const pixel = y * image.width + x;
          if (coverage[pixel] >= opacity) continue;
          coverage[pixel] = opacity;
          const sx = limit(Math.round(source.x + x - anchor.x), 0, image.width - 1);
          const sy = limit(Math.round(source.y + y - anchor.y), 0, image.height - 1);
          const targetIndex = pixel * 4, sourceIndex = (sy * image.width + sx) * 4;
          if (!before.pixels[sourceIndex + 3]) continue;
          for (let c = 0; c < 4; c++) {
            const sample = limit(before.pixels[sourceIndex + c] + (c < 3 ? correction[c] : 0), 0, 255);
            image.pixels[targetIndex + c] = before.pixels[targetIndex + c] * (1 - opacity) + sample * opacity;
          }
        }
      }
    }
    stamp(anchor);
    for (let segment = 1; segment < path.length; segment++) {
      const a = path[segment - 1], b = path[segment];
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, radius / 4));
      for (let step = 1; step <= steps; step++) stamp({ x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps });
    }
  }
}
