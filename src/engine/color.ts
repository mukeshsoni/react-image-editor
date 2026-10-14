import { COLOR_BANDS } from "../model/settings";
import type { ColorSettings } from "../model/types";
import { limit } from "./geometry";
import type { Raster, Triplet } from "./pixels";

export function rgbToHsl([red, green, blue]: Triplet): Triplet {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), difference = max - min;
  const light = (max + min) / 2;
  if (difference === 0) return [0, 0, light];
  let hue = max === r ? (g - b) / difference : max === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
  hue = ((hue / 6) % 1 + 1) % 1;
  return [hue, difference / (1 - Math.abs(2 * light - 1)), light];
}

export function hslToRgb([hue, saturation, lightness]: Triplet): Triplet {
  const h = ((hue % 1) + 1) % 1 * 6, s = limit(saturation, 0, 1), l = limit(lightness, 0, 1);
  const chroma = (1 - Math.abs(2 * l - 1)) * s, intermediate = chroma * (1 - Math.abs(h % 2 - 1));
  const floor = l - chroma / 2;
  const rgb = h < 1 ? [chroma, intermediate, 0] : h < 2 ? [intermediate, chroma, 0] : h < 3 ? [0, chroma, intermediate]
    : h < 4 ? [0, intermediate, chroma] : h < 5 ? [intermediate, 0, chroma] : [chroma, 0, intermediate];
  return rgb.map((value) => Math.round((value + floor) * 255)) as Triplet;
}

const centers = [0, 30, 60, 120, 180, 240, 270, 300].map((value) => value / 360);
const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
const mask = (d: number, radius: number) => d >= radius ? 0 : (1 + Math.cos(Math.PI * d / radius)) / 2;

export function adjustColor(image: Raster, settings: ColorSettings): void {
  const mixer = COLOR_BANDS.map((name, index) => ({ ...settings.mixerHsl[name], center: centers[index] }))
    .filter((band) => band.hue || band.saturation || band.luminance);
  const point = settings.pointColor;
  const hasPoint = point.hue !== null && Boolean(point.hueShift || point.saturationShift || point.luminanceShift);
  if (!settings.vibrance && !settings.saturation && !mixer.length && !hasPoint) return;
  for (let i = 0; i < image.pixels.length; i += 4) {
    if (!image.pixels[i + 3]) continue;
    const [h, s, l] = rgbToHsl([image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]]);
    let hue = h, sat = s * (1 + settings.saturation / 100), light = l;
    sat += settings.vibrance / 100 * (1 - sat) * sat;
    let changed = Boolean(settings.vibrance || settings.saturation);
    for (const band of mixer) {
      const weight = mask(distance(h, band.center), 1 / 6) * limit(s * 4, 0, 1);
      if (weight === 0) continue;
      changed = true;
      hue += band.hue / 1200 * weight;
      sat *= 1 + band.saturation / 100 * weight;
      light += band.luminance / 250 * weight;
    }
    if (hasPoint) {
      const weight = mask(distance(h, point.hue!), (5 + point.range * 0.55) / 360) * limit(s * 2, 0, 1);
      if (weight) {
        changed = true;
        hue += point.hueShift / 600 * weight;
        sat *= 1 + point.saturationShift / 100 * weight;
        light += point.luminanceShift / 250 * weight;
      }
    }
    if (!changed) continue;
    const result = hslToRgb([hue, sat, light]);
    image.pixels[i] = result[0]; image.pixels[i + 1] = result[1]; image.pixels[i + 2] = result[2];
  }
}
