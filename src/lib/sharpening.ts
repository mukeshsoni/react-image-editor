import type { SharpeningSettings } from "@/store/cropStore";

export type SharpeningBuffers = {
  blurred: Float32Array;
  luma: Float32Array;
  scratch: Float32Array;
};

export function createSharpeningBuffers(pixelCount: number): SharpeningBuffers {
  return {
    blurred: new Float32Array(pixelCount),
    luma: new Float32Array(pixelCount),
    scratch: new Float32Array(pixelCount),
  };
}

export function applySharpeningToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  settings: SharpeningSettings,
  buffers: SharpeningBuffers,
): void {
  if (output.length !== input.length) {
    throw new Error("Output buffer must match input length");
  }

  const pixelCount = input.length / 4;
  if (!Number.isInteger(pixelCount)) {
    throw new Error("Input buffer must be RGBA");
  }

  if (width <= 0 || height <= 0 || width * height !== pixelCount) {
    throw new Error("Width/height must match input buffer");
  }

  if (buffers.luma.length !== pixelCount) {
    throw new Error("Sharpening buffers must match pixel count");
  }

  if (isNeutralSharpening(settings)) {
    output.set(input);
    return;
  }

  // Map UI "Amount" (0..150) into a more aggressive multiplier.
  // This is intentionally stronger than typical USM so each slider step is visible.
  const amount = clamp(settings.amount / 35, 0, 6);

  const radiusPx = clamp(settings.radius, 0.5, 3);

  // Radius maps to sigma, tuned so radius=1 feels meaningful.
  const sigma = Math.max(0.25, radiusPx * 0.75);

  const masking = clamp01(settings.masking / 100);
  const detail = clamp01(settings.detail / 100);

  // Compute luma per pixel.
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r = (input[i] ?? 0) / 255;
    const g = (input[i + 1] ?? 0) / 255;
    const b = (input[i + 2] ?? 0) / 255;

    buffers.luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  gaussianBlurLumaSeparable(
    buffers.luma,
    buffers.blurred,
    buffers.scratch,
    width,
    height,
    sigma,
  );

  // Apply unsharp mask in luma space, then map back to RGB by scaling.
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    const l0 = buffers.luma[p] ?? 0;
    const blurred = buffers.blurred[p] ?? 0;

    const highFreq = l0 - blurred;

    const hfAbs = Math.abs(highFreq);

    // "Detail" controls how much we bias toward fine texture.
    // Keep default (25) close to neutral.
    const detailWeight = lerp(0.75, 1.75, detail);

    // "Masking" reduces effect in smooth areas.
    // Use a lower threshold than before so the effect is visible at common radii.
    const edgeStrength = smoothstep(0.005, 0.06, hfAbs);
    const mask = lerp(1, edgeStrength, masking);

    const delta = highFreq * amount * detailWeight * mask;
    const l1 = clamp01(l0 + delta);

    // Scale RGB toward new luma to preserve chroma.
    const scale = l0 > 1e-6 ? l1 / l0 : 1;

    output[i] = floatToByte((r0 / 255) * scale);
    output[i + 1] = floatToByte((g0 / 255) * scale);
    output[i + 2] = floatToByte((b0 / 255) * scale);
    output[i + 3] = a0;
  }
}

export function isNeutralSharpening(settings: SharpeningSettings): boolean {
  return settings.amount === 0;
}

function gaussianBlurLumaSeparable(
  input: Float32Array,
  output: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number,
  sigma: number,
): void {
  if (input.length !== output.length || input.length !== scratch.length) {
    throw new Error("Blur buffers must match");
  }

  const { kernel, radius } = createGaussianKernel(sigma);

  // Horizontal pass: input -> scratch
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;

    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sx = clampInt(x + k, 0, width - 1);
        const w = kernel[k + radius] ?? 0;
        acc += (input[rowStart + sx] ?? 0) * w;
      }
      scratch[rowStart + x] = acc;
    }
  }

  // Vertical pass: scratch -> output
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;

    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sy = clampInt(y + k, 0, height - 1);
        const w = kernel[k + radius] ?? 0;
        acc += (scratch[sy * width + x] ?? 0) * w;
      }
      output[rowStart + x] = acc;
    }
  }
}

function createGaussianKernel(sigma: number): { kernel: Float32Array; radius: number } {
  const safeSigma = Math.max(0.001, sigma);
  const radius = Math.max(1, Math.ceil(safeSigma * 3));
  const size = radius * 2 + 1;

  const kernel = new Float32Array(size);

  let sum = 0;
  for (let k = -radius; k <= radius; k += 1) {
    const w = Math.exp(-(k * k) / (2 * safeSigma * safeSigma));
    kernel[k + radius] = w;
    sum += w;
  }

  for (let i = 0; i < size; i += 1) {
    kernel[i] = (kernel[i] ?? 0) / sum;
  }

  return { kernel, radius };
}

function floatToByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
