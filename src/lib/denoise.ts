import type { DenoiseSettings } from "@/store/cropStore";

export type DenoiseBuffers = {
  y: Float32Array;
  cb: Float32Array;
  cr: Float32Array;

  blurredY: Float32Array;
  blurredCb: Float32Array;
  blurredCr: Float32Array;

  scratch: Float32Array;
};

export function createDenoiseBuffers(pixelCount: number): DenoiseBuffers {
  return {
    y: new Float32Array(pixelCount),
    cb: new Float32Array(pixelCount),
    cr: new Float32Array(pixelCount),

    blurredY: new Float32Array(pixelCount),
    blurredCb: new Float32Array(pixelCount),
    blurredCr: new Float32Array(pixelCount),

    scratch: new Float32Array(pixelCount),
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

  // Fast denoise strategy:
  // - Blur luma/chroma with separable gaussian.
  // - Compute a per-pixel edge mask from |original - blurred|.
  // - Blend blurred->original based on mask (edge preservation), then blend by amount.
  //
  // This is much faster than a true bilateral filter (no per-neighbor exp).
  const sigmaY = lerp(0.6, 1.6, 1 - detail);
  const sigmaC = sigmaY * 1.25;

  // Convert slider to a slightly stronger blend so low slider values are visible.
  const luminanceStrength = clamp01(Math.pow(luminanceAmount, 0.6));
  const colorStrength = clamp01(Math.pow(colorAmount, 0.6));

  if (luminanceAmount > 0) {
    gaussianBlurSeparable(
      buffers.y,
      buffers.blurredY,
      buffers.scratch,
      width,
      height,
      sigmaY,
    );

    // Higher `detail` preserves edges more aggressively by lowering thresholds.
    const edge0 = lerp(0.04, 0.012, detail);
    const edge1 = lerp(0.14, 0.05, detail);

    for (let p = 0; p < pixelCount; p += 1) {
      const y0 = buffers.y[p] ?? 0;
      const blurred = buffers.blurredY[p] ?? y0;
      const hfAbs = Math.abs(y0 - blurred);

      const edge = smoothstep(edge0, edge1, hfAbs);
      const preserved = lerp(blurred, y0, edge);

      // Amount blends original -> edge-preserved blur.
      buffers.y[p] = lerp(y0, preserved, luminanceStrength);
    }
  }

  if (colorAmount > 0) {
    gaussianBlurSeparable(
      buffers.cb,
      buffers.blurredCb,
      buffers.scratch,
      width,
      height,
      sigmaC,
    );
    gaussianBlurSeparable(
      buffers.cr,
      buffers.blurredCr,
      buffers.scratch,
      width,
      height,
      sigmaC,
    );

    // Chroma noise is often more objectionable, so use slightly higher thresholds.
    const edge0 = lerp(0.05, 0.02, detail);
    const edge1 = lerp(0.18, 0.07, detail);

    for (let p = 0; p < pixelCount; p += 1) {
      const cb0 = buffers.cb[p] ?? 0;
      const cr0 = buffers.cr[p] ?? 0;

      const cbBlur = buffers.blurredCb[p] ?? cb0;
      const crBlur = buffers.blurredCr[p] ?? cr0;

      const hfAbs = Math.max(Math.abs(cb0 - cbBlur), Math.abs(cr0 - crBlur));
      const edge = smoothstep(edge0, edge1, hfAbs);

      const preservedCb = lerp(cbBlur, cb0, edge);
      const preservedCr = lerp(crBlur, cr0, edge);

      buffers.cb[p] = lerp(cb0, preservedCb, colorStrength);
      buffers.cr[p] = lerp(cr0, preservedCr, colorStrength);
    }
  }

  // Convert back to RGB and write output.
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    output[i + 3] = a0;

    // Preserve chroma when doing luma-only denoise.
    if (colorStrength === 0 && luminanceStrength > 0) {
      const l0 = 0.2126 * (r0 / 255) + 0.7152 * (g0 / 255) + 0.0722 * (b0 / 255);
      const l1 = buffers.y[p] ?? l0;
      const scale = l0 > 1e-6 ? clamp01(l1) / clamp01(l0) : 1;
      output[i] = floatToByte((r0 / 255) * scale);
      output[i + 1] = floatToByte((g0 / 255) * scale);
      output[i + 2] = floatToByte((b0 / 255) * scale);
      continue;
    }

    const { r, g, b } = yCbCrToRgb(
      buffers.y[p] ?? 0,
      buffers.cb[p] ?? 0,
      buffers.cr[p] ?? 0,
    );

    output[i] = floatToByte(r);
    output[i + 1] = floatToByte(g);
    output[i + 2] = floatToByte(b);
  }
}

export function isNeutralDenoise(settings: DenoiseSettings): boolean {
  return settings.luminance === 0 && settings.color === 0;
}

function gaussianBlurSeparable(
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
