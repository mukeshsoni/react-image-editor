import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "@napi-rs/canvas";

export const imageSizes = {
  red: [320, 240], blue: [320, 240], grid: [320, 240], ramp: [320, 240],
  palette: [320, 240], noise: [320, 240], healing: [400, 200], alpha: [320, 240],
  portrait: [240, 640], landscape: [1200, 800], odd: [317, 239], tiny: [3, 2], large: [2400, 1600],
} as const;
export type ImageName = keyof typeof imageSizes;
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
const cache = new Map<string, Buffer>();

export function imageFile(name: ImageName, format: "png" | "jpeg" = "png"): Buffer {
  const key = `${name}.${format}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const [width, height] = imageSizes[name];
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (name === "red" || name === "blue") {
    ctx.fillStyle = name;
    ctx.fillRect(0, 0, width, height);
  } else if (name === "healing") {
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "blue"; ctx.fillRect(180, 80, 40, 40);
    ctx.fillStyle = "red"; ctx.fillRect(280, 80, 40, 40);
  } else if (name === "alpha") {
    ctx.fillStyle = "red"; ctx.fillRect(60, 40, 100, 100);
    ctx.fillStyle = "rgba(0,0,255,0.5)"; ctx.fillRect(170, 80, 90, 90);
  } else {
    const pixels = ctx.createImageData(width, height);
    let seed = 731;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const value = 65 + (seed % 130);
        const ramp = 20 + Math.round(215 * x / Math.max(1, width - 1));
        const band = Math.floor(x * 6 / width);
        const colors = [[220, 40, 40], [220, 160, 40], [70, 190, 70], [40, 190, 190], [40, 70, 220], [190, 40, 190]];
        const rgb = name === "noise" ? [value, value, value]
          : name === "ramp" ? [ramp, ramp, ramp]
            : name === "palette" ? colors[band]
              : [50 + Math.round(x / width * 150), 45 + Math.round(y / height * 150), ((Math.floor(x / 20) + Math.floor(y / 20)) % 2) ? 170 : 90];
        pixels.data.set([...rgb, 255], (y * width + x) * 4);
      }
    }
    ctx.putImageData(pixels, 0, 0);
  }
  const bytes = format === "jpeg" ? canvas.toBuffer("image/jpeg", 90) : canvas.toBuffer("image/png");
  cache.set(key, bytes);
  return bytes;
}

export async function decodeImage(bytes: Buffer): Promise<Pixels> {
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data };
}

export function pixel(image: Pixels, x: number, y: number): number[] {
  const i = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  return Array.from(image.data.slice(i, i + 4));
}

export function pixelHash(image: Pixels): string {
  return createHash("sha256").update(image.data).digest("hex");
}

export function mean(image: Pixels, channel = 0): number {
  let total = 0;
  let count = 0;
  for (let i = channel; i < image.data.length; i += 4) {
    if (image.data[i - channel + 3] !== 255) continue;
    total += image.data[i]; count++;
  }
  return count ? total / count : 0;
}

export function variation(image: Pixels): number {
  let total = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      total += Math.abs(image.data[i] - image.data[i - 4]);
    }
  }
  return total / (image.height * (image.width - 1));
}
