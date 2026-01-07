import type { DenoiseSettings } from "@/store/cropStore";

export type DenoiseBuffers = {
  y: Float32Array;
  cb: Float32Array;
  cr: Float32Array;
  outY: Float32Array;
  outCb: Float32Array;
  outCr: Float32Array;
};

export function createDenoiseBuffers(pixelCount: number): DenoiseBuffers {
  return {
    y: new Float32Array(pixelCount),
    cb: new Float32Array(pixelCount),
    cr: new Float32Array(pixelCount),
    outY: new Float32Array(pixelCount),
    outCb: new Float32Array(pixelCount),
    outCr: new Float32Array(pixelCount),
  };
}

export function applyDenoiseToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  settings: DenoiseSettings,
  buffers: DenoiseBuffers,
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

  if (buffers.y.length !== pixelCount) {
    throw new Error("Denoise buffers must match pixel count");
  }

  if (isNeutralDenoise(settings)) {
    output.set(input);
    return;
  }

  const luminanceAmount = clamp01(settings.luminance / 100);
  const colorAmount = clamp01(settings.color / 100);
  const detail = clamp01(settings.detail / 100);

  // Internal representation matches other adjustments: operate in float 0..1.
  // Convert RGB -> YCbCr-ish (BT.709 luma).
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r = (input[i] ?? 0) / 255;
    const g = (input[i + 1] ?? 0) / 255;
    const b = (input[i + 2] ?? 0) / 255;

    const { y, cb, cr } = rgbToYCbCr(r, g, b);
    buffers.y[p] = y;
    buffers.cb[p] = cb;
    buffers.cr[p] = cr;
  }

  // Edge-aware smoothing using a tiny bilateral-like filter.
  // We use a 3x3 neighborhood (radius=1) and weight neighbors by similarity.
  // "Detail" tightens the similarity threshold (more edge preservation).
  const sigmaBase = lerp(0.02, 0.12, 1 - detail);
  const sigmaY = sigmaBase;
  const sigmaC = sigmaBase * 1.5;

  if (luminanceAmount > 0) {
    denoiseChannelEdgeAware(
      buffers.y,
      buffers.outY,
      width,
      height,
      sigmaY,
      luminanceAmount,
    );
  } else {
    buffers.outY.set(buffers.y);
  }

  if (colorAmount > 0) {
    denoiseChannelEdgeAware(
      buffers.cb,
      buffers.outCb,
      width,
      height,
      sigmaC,
      colorAmount,
    );
    denoiseChannelEdgeAware(
      buffers.cr,
      buffers.outCr,
      width,
      height,
      sigmaC,
      colorAmount,
    );
  } else {
    buffers.outCb.set(buffers.cb);
    buffers.outCr.set(buffers.cr);
  }

  // Convert back to RGB and write output.
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    // Preserve alpha channel exactly.
    const { r, g, b } = yCbCrToRgb(
      buffers.outY[p] ?? buffers.y[p] ?? 0,
      buffers.outCb[p] ?? buffers.cb[p] ?? 0,
      buffers.outCr[p] ?? buffers.cr[p] ?? 0,
    );

    // If only luminance denoise is enabled, preserve chroma by scaling.
    // (In practice, chroma denoise may be enabled too; conversion already handles it.)
    // As a small safety, keep extreme chroma shifts from causing big deltas when colorAmount=0.
    if (colorAmount === 0) {
      const l0 = 0.2126 * (r0 / 255) + 0.7152 * (g0 / 255) + 0.0722 * (b0 / 255);
      const l1 = buffers.outY[p] ?? l0;
      const scale = l0 > 1e-6 ? clamp01(l1) / clamp01(l0) : 1;
      output[i] = floatToByte((r0 / 255) * scale);
      output[i + 1] = floatToByte((g0 / 255) * scale);
      output[i + 2] = floatToByte((b0 / 255) * scale);
      output[i + 3] = a0;
      continue;
    }

    output[i] = floatToByte(r);
    output[i + 1] = floatToByte(g);
    output[i + 2] = floatToByte(b);
    output[i + 3] = a0;
  }
}

export function isNeutralDenoise(settings: DenoiseSettings): boolean {
  return settings.luminance === 0 && settings.color === 0;
}

function denoiseChannelEdgeAware(
  input: Float32Array,
  output: Float32Array,
  width: number,
  height: number,
  sigma: number,
  amount: number,
): void {
  const invTwoSigma2 = 1 / (2 * sigma * sigma);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const center = input[idx] ?? 0;

      let sum = 0;
      let wSum = 0;

      for (let oy = -1; oy <= 1; oy += 1) {
        const sy = clampInt(y + oy, 0, height - 1);
        for (let ox = -1; ox <= 1; ox += 1) {
          const sx = clampInt(x + ox, 0, width - 1);
          const nIdx = sy * width + sx;
          const value = input[nIdx] ?? 0;

          const delta = value - center;
          const w = Math.exp(-(delta * delta) * invTwoSigma2);

          sum += value * w;
          wSum += w;
        }
      }

      const filtered = wSum > 1e-6 ? sum / wSum : center;

      // Amount blends original -> filtered.
      output[idx] = center + (filtered - center) * amount;
    }
  }
}

function rgbToYCbCr(r: number, g: number, b: number): {
  y: number;
  cb: number;
  cr: number;
} {
  // BT.709 luma.
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Simple chroma deltas around luma.
  // Keep cb/cr around 0 for neutral grey.
  const cb = (b - y) * 0.5;
  const cr = (r - y) * 0.5;

  return { y, cb, cr };
}

function yCbCrToRgb(y: number, cb: number, cr: number): { r: number; g: number; b: number } {
  const r = y + 2 * cr;
  const b = y + 2 * cb;

  // Solve g from luma equation.
  const g = (y - 0.2126 * r - 0.0722 * b) / 0.7152;

  return {
    r: clamp01(r),
    g: clamp01(g),
    b: clamp01(b),
  };
}

function floatToByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
