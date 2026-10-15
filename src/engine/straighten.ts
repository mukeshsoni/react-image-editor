import { luminance } from "./pixels";
import type { Raster } from "./pixels";

export function estimateLevel(image: Raster): { angle: number; confidence: number } {
  const stride = Math.max(1, Math.ceil(Math.max(image.width, image.height) / 320));
  const at = (x: number, y: number) => {
    const i = (y * image.width + x) * 4;
    return luminance(image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]) * image.pixels[i + 3] / 255;
  };
  let horizontal = 0, vertical = 0, weight = 0;
  for (let y = stride; y < image.height - stride; y += stride) for (let x = stride; x < image.width - stride; x += stride) {
    const gx = at(x + stride, y - stride) + 2 * at(x + stride, y) + at(x + stride, y + stride)
      - at(x - stride, y - stride) - 2 * at(x - stride, y) - at(x - stride, y + stride);
    const gy = at(x - stride, y + stride) + 2 * at(x, y + stride) + at(x + stride, y + stride)
      - at(x - stride, y - stride) - 2 * at(x, y - stride) - at(x + stride, y - stride);
    const magnitude = Math.hypot(gx, gy);
    if (magnitude < 40) continue;
    const angle = Math.atan2(gy, gx) * 4;
    horizontal += Math.cos(angle) * magnitude;
    vertical += Math.sin(angle) * magnitude;
    weight += magnitude;
  }
  return weight ? { angle: -Math.atan2(vertical, horizontal) * 45 / Math.PI, confidence: Math.hypot(horizontal, vertical) / weight }
    : { angle: 0, confidence: 0 };
}
