import type { DenoiseSettings, SharpeningSettings } from "../model/types";
import { limit } from "./geometry";
import { luminance } from "./pixels";
import type { Raster } from "./pixels";

export function reduceNoise(image: Raster, settings?: DenoiseSettings): void {
  if (!settings || (!settings.luminance && !settings.color)) return;
  const original = new Uint8ClampedArray(image.pixels);
  const lum = settings.luminance / 100, chroma = settings.color / 100;
  const tolerance = 100 - settings.detail * 0.85;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const index = (y * image.width + x) * 4;
    if (!original[index + 3]) continue;
    const level = luminance(original[index], original[index + 1], original[index + 2]);
    let r = 0, g = 0, b = 0, sum = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const near = (limit(y + dy, 0, image.height - 1) * image.width + limit(x + dx, 0, image.width - 1)) * 4;
      const difference = luminance(original[near], original[near + 1], original[near + 2]) - level;
      const weight = Math.exp(-(dx * dx + dy * dy) / 5) / (1 + (difference / tolerance) ** 2) * original[near + 3] / 255;
      r += original[near] * weight; g += original[near + 1] * weight; b += original[near + 2] * weight; sum += weight;
    }
    if (!sum) continue;
    const average = [r / sum, g / sum, b / sum];
    const averageL = luminance(average[0], average[1], average[2]);
    const newL = level + (averageL - level) * lum;
    for (let c = 0; c < 3; c++) image.pixels[index + c] = newL + (original[index + c] - level) * (1 - chroma) + (average[c] - averageL) * chroma;
  }
}

export function sharpen(image: Raster, settings?: SharpeningSettings): void {
  if (!settings?.amount) return;
  const { width, height, pixels } = image;
  const count = width * height;
  const source = Float32Array.from({ length: count }, (_, i) => luminance(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]));
  const horizontal = new Float32Array(count), blur = new Float32Array(count);
  const reach = Math.ceil(settings.radius * 2);
  const kernel = Array.from({ length: reach * 2 + 1 }, (_, i) => Math.exp(-((i - reach) ** 2) / (2 * settings.radius ** 2)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, weight = 0;
    for (let k = -reach; k <= reach; k++) {
      const j = y * width + limit(x + k, 0, width - 1), w = kernel[k + reach] * pixels[j * 4 + 3] / 255;
      sum += source[j] * w; weight += w;
    }
    horizontal[y * width + x] = sum / (weight || 1);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, weight = 0;
    for (let k = -reach; k <= reach; k++) {
      const j = limit(y + k, 0, height - 1) * width + x, w = kernel[k + reach] * pixels[j * 4 + 3] / 255;
      sum += horizontal[j] * w; weight += w;
    }
    blur[y * width + x] = sum / (weight || 1);
  }
  for (let i = 0; i < count; i++) {
    const edge = source[i] - blur[i];
    const gate = settings.masking ? limit((Math.abs(edge) - settings.masking / 8) / 12, 0, 1) : 1;
    const difference = edge * settings.amount / 100 * (0.75 + settings.detail / 100) * gate;
    for (let c = 0; c < 3; c++) pixels[i * 4 + c] += difference;
  }
}
