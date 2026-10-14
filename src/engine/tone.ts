import type { ImageEditorEdits, Point } from "../model/types";
import { limit } from "./geometry";
import type { Raster } from "./pixels";

/** Shape-preserving Hermite interpolation through the user-controlled points. */
export function interpolateCurve(input: readonly Point[]): Float64Array {
  const points = [...input].sort((a, b) => a.x - b.x).filter((point, i, sorted) => i === 0 || point.x - sorted[i - 1].x > 0.00001);
  if (points.length < 2) return Float64Array.from({ length: 256 }, (_, value) => value);
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  const derivatives = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[index - 1];
    const a = slopes[index - 1], b = slopes[index];
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  });
  return Float64Array.from({ length: 256 }, (_, value) => {
    const x = value / 255;
    let left = 0;
    while (left + 2 < points.length && points[left + 1].x < x) left++;
    const a = points[left], b = points[left + 1], dx = b.x - a.x;
    const t = limit((x - a.x) / dx, 0, 1);
    const t2 = t * t, t3 = t2 * t;
    return 255 * limit((2 * t3 - 3 * t2 + 1) * a.y + (t3 - 2 * t2 + t) * derivatives[left] * dx
      + (-2 * t3 + 3 * t2) * b.y + (t3 - t2) * derivatives[left + 1] * dx, 0, 1);
  });
}

export function toneAndBalance(image: Raster, edits: ImageEditorEdits): void {
  const light = edits.light, balance = edits.whiteBalance, curve = edits.toneCurve;
  const warmth = (balance.temperatureKelvin - 6500) / 8000;
  const gains = [Math.exp(warmth + balance.tint / 1000), Math.exp(-balance.tint / 450), Math.exp(-warmth + balance.tint / 1000)];
  const master = interpolateCurve(curve.point.rgb);
  const channels = [curve.point.r, curve.point.g, curve.point.b].map(interpolateCurve);
  const region = curve.parametric.rgb;
  const regions = [region.shadows, region.darks, region.lights, region.highlights];
  const exposure = 2 ** light.exposure, contrast = Math.exp(light.contrast / 125);
  const table = gains.map((gain, channel) => Uint8ClampedArray.from({ length: 256 }, (_, value) => {
    let v = value / 255;
    if (exposure !== 1 || gain !== 1) {
      const linear = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const adjusted = limit(linear * exposure * gain, 0, 1);
      v = adjusted <= 0.0031308 ? adjusted * 12.92 : 1.055 * adjusted ** (1 / 2.4) - 0.055;
    }
    v = (v - 0.5) * contrast + 0.5;
    const brightness = limit(v, 0, 1);
    v += light.shadows / 100 * brightness * (1 - brightness) ** 3 * 2;
    v += light.highlights / 100 * brightness ** 3 * (1 - brightness) * 2;
    v += light.blacks / 100 * (1 - brightness) ** 4 * 0.3;
    v += light.whites / 100 * brightness ** 4 * 0.3;
    v = limit(v, 0, 1);
    if (curve.mode === "point") return channels[channel][Math.round(master[Math.round(v * 255)])];
    let adjustment = 0;
    for (let band = 0; band < 4; band++) adjustment += regions[band] / 100 * Math.exp(-(((v - (band + 0.5) / 4) / 0.2) ** 2)) * 0.2;
    return limit(v + adjustment * Math.sin(v * Math.PI), 0, 1) * 255;
  }));
  for (let i = 0; i < image.pixels.length; i += 4) {
    if (!image.pixels[i + 3]) continue;
    for (let channel = 0; channel < 3; channel++) image.pixels[i + channel] = table[channel][image.pixels[i + channel]];
  }
}
