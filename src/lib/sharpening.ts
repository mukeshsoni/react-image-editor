import type { SharpeningSettings } from "@/store/cropStore";

export type SharpeningBuffers = {
  temp: Float32Array;
  blurred: Float32Array;
  luma: Float32Array;
};

export function createSharpeningBuffers(pixelCount: number): SharpeningBuffers {
  return {
    temp: new Float32Array(pixelCount),
    blurred: new Float32Array(pixelCount),
    luma: new Float32Array(pixelCount),
  };
}

export function applySharpeningToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
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

  if (buffers.luma.length !== pixelCount) {
    throw new Error("Sharpening buffers must match pixel count");
  }

  if (isNeutralSharpening(settings)) {
    output.set(input);
    return;
  }

  const amount = clamp01(settings.amount / 150);

  // For v1, keep this purely 1D (row-wise) to provide a stable baseline implementation.
  // A full 2D separable blur will come in follow-up commits.
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

  // Placeholder blur: 1D gaussian along the luma array.
  gaussianBlur1d(buffers.luma, buffers.blurred, buffers.temp, sigma);

  // Apply unsharp mask in luma space, then map back to RGB by scaling.
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    const l0 = buffers.luma[p] ?? 0;
    const blurred = buffers.blurred[p] ?? 0;

    const highFreq = l0 - blurred;

    // "Detail" biases toward fine texture by amplifying smaller high-frequency signals.
    // detail=0 => damp small changes; detail=1 => preserve full signal.
    const hfAbs = Math.abs(highFreq);
    const detailWeight = smoothstep(0.0, 0.08, hfAbs * (0.5 + detail));

    // "Masking" reduces effect in smooth areas.
    const edgeStrength = smoothstep(0.02, 0.12, hfAbs);
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

function gaussianBlur1d(
  input: Float32Array,
  output: Float32Array,
  temp: Float32Array,
  sigma: number,
): void {
  if (input.length !== output.length || input.length !== temp.length) {
    throw new Error("Blur buffers must match");
  }

  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernelSize = radius * 2 + 1;

  // Build kernel into temp[0..kernelSize).
  let sum = 0;
  for (let k = -radius; k <= radius; k += 1) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    temp[k + radius] = w;
    sum += w;
  }
  for (let idx = 0; idx < kernelSize; idx += 1) {
    temp[idx] = (temp[idx] ?? 0) / sum;
  }

  // Convolve.
  for (let i = 0; i < input.length; i += 1) {
    let acc = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = clampInt(i + k, 0, input.length - 1);
      const w = temp[k + radius] ?? 0;
      acc += (input[j] ?? 0) * w;
    }
    output[i] = acc;
  }
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
