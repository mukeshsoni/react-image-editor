import type { PixelProcessor } from "../processor";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyVignette(
  buffers: { in: Uint8ClampedArray; out: Uint8ClampedArray; temp: Uint8ClampedArray },
  width: number,
  height: number,
  amount: number,
): void {
  const input = buffers.in;
  const output = buffers.temp;

  const a = clamp(amount, -100, 100) / 100;
  if (a === 0) {
    buffers.out.set(input);
    return;
  }

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.hypot(cx, cy);

  // Positive amount darkens edges, negative brightens.
  const strength = a;

  for (let y = 0; y < height; y += 1) {
    const dy = y - cy;
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const r = Math.hypot(dx, dy) / maxR;

      // Smooth falloff towards edges.
      const falloff = r * r;
      const gain = 1 - strength * falloff;

      const idx = (y * width + x) * 4;
      output[idx] = clamp(input[idx] * gain, 0, 255);
      output[idx + 1] = clamp(input[idx + 1] * gain, 0, 255);
      output[idx + 2] = clamp(input[idx + 2] * gain, 0, 255);
      output[idx + 3] = input[idx + 3];
    }
  }

  buffers.out.set(output);
}

function applyGrain(
  buffers: { in: Uint8ClampedArray; out: Uint8ClampedArray; temp: Uint8ClampedArray },
  width: number,
  height: number,
  amount: number,
): void {
  const input = buffers.in;
  const output = buffers.temp;

  const a = clamp(amount, 0, 100) / 100;
  if (a === 0) {
    buffers.out.set(input);
    return;
  }

  // Deterministic LCG based on pixel index.
  function noise(seed: number): number {
    let s = seed | 0;
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  }

  const strength = 30 * a;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const n = noise(idx) * 2 - 1;
      const delta = n * strength;

      output[idx] = clamp(input[idx] + delta, 0, 255);
      output[idx + 1] = clamp(input[idx + 1] + delta, 0, 255);
      output[idx + 2] = clamp(input[idx + 2] + delta, 0, 255);
      output[idx + 3] = input[idx + 3];
    }
  }

  buffers.out.set(output);
}

function applyDehaze(
  buffers: { in: Uint8ClampedArray; out: Uint8ClampedArray; temp: Uint8ClampedArray },
  _width: number,
  _height: number,
  amount: number,
): void {
  const input = buffers.in;
  const output = buffers.temp;

  const a = clamp(amount, -100, 100) / 100;
  if (a === 0) {
    buffers.out.set(input);
    return;
  }

  // Fast approximation: increase/decrease contrast around midtones.
  const contrast = 1 + a * 0.6;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < input.length; i += 4) {
    output[i] = clamp(input[i] * contrast + intercept, 0, 255);
    output[i + 1] = clamp(input[i + 1] * contrast + intercept, 0, 255);
    output[i + 2] = clamp(input[i + 2] * contrast + intercept, 0, 255);
    output[i + 3] = input[i + 3];
  }

  buffers.out.set(output);
}

function applyLensDistortion(
  buffers: { in: Uint8ClampedArray; out: Uint8ClampedArray; temp: Uint8ClampedArray },
  width: number,
  height: number,
  amount: number,
): void {
  const input = buffers.in;
  const output = buffers.temp;

  const a = clamp(amount, -100, 100) / 100;
  if (a === 0) {
    buffers.out.set(input);
    return;
  }

  // Simple radial model: r' = r * (1 + k * r^2)
  const k = a * 0.35;

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.hypot(cx, cy);

  function sample(srcX: number, srcY: number, channel: number): number {
    const x0 = Math.floor(srcX);
    const y0 = Math.floor(srcY);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);

    const tx = srcX - x0;
    const ty = srcY - y0;

    const i00 = (y0 * width + x0) * 4 + channel;
    const i10 = (y0 * width + x1) * 4 + channel;
    const i01 = (y1 * width + x0) * 4 + channel;
    const i11 = (y1 * width + x1) * 4 + channel;

    const a00 = input[i00];
    const a10 = input[i10];
    const a01 = input[i01];
    const a11 = input[i11];

    const b0 = a00 + (a10 - a00) * tx;
    const b1 = a01 + (a11 - a01) * tx;
    return b0 + (b1 - b0) * ty;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / maxR;
      const ny = (y - cy) / maxR;
      const r2 = nx * nx + ny * ny;
      const scale = 1 + k * r2;

      const srcX = cx + (x - cx) * scale;
      const srcY = cy + (y - cy) * scale;

      const idx = (y * width + x) * 4;

      if (srcX < 0 || srcX > width - 1 || srcY < 0 || srcY > height - 1) {
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
        output[idx + 3] = 0;
        continue;
      }

      output[idx] = clamp(sample(srcX, srcY, 0), 0, 255);
      output[idx + 1] = clamp(sample(srcX, srcY, 1), 0, 255);
      output[idx + 2] = clamp(sample(srcX, srcY, 2), 0, 255);
      output[idx + 3] = clamp(sample(srcX, srcY, 3), 0, 255);
    }
  }

  buffers.out.set(output);
}

function applyChromaticAberration(
  buffers: { in: Uint8ClampedArray; out: Uint8ClampedArray; temp: Uint8ClampedArray },
  width: number,
  height: number,
): void {
  // Very subtle channel shift: scale red/blue slightly towards center.
  const input = buffers.in;
  const output = buffers.temp;

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  function get(x: number, y: number, channel: number): number {
    const ix = clamp(Math.round(x), 0, width - 1);
    const iy = clamp(Math.round(y), 0, height - 1);
    return input[(iy * width + ix) * 4 + channel];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;

      const rX = cx + dx * 0.997;
      const rY = cy + dy * 0.997;
      const bX = cx + dx * 1.003;
      const bY = cy + dy * 1.003;

      const idx = (y * width + x) * 4;
      output[idx] = get(rX, rY, 0);
      output[idx + 1] = get(x, y, 1);
      output[idx + 2] = get(bX, bY, 2);
      output[idx + 3] = get(x, y, 3);
    }
  }

  buffers.out.set(output);
}

export const geometryOpticsProcessor = {
  id: "geometry-optics",
  order: 42,
  isEnabled: (context) => {
    const settings = context.geometryOptics;
    if (!settings) return false;

    return (
      settings.lensCorrections.distortion !== 0 ||
      settings.lensCorrections.chromaticAberration ||
      settings.optics.vignette !== 0 ||
      settings.optics.grain !== 0 ||
      settings.optics.dehaze !== 0
    );
  },
  apply: (buffers, context) => {
    const settings = context.geometryOptics;
    const width = context.width ?? 0;
    const height = context.height ?? 0;

    if (!settings || !width || !height) {
      buffers.out.set(buffers.in);
      return;
    }

    // Lens corrections first.
    if (settings.lensCorrections.distortion !== 0) {
      applyLensDistortion(buffers, width, height, settings.lensCorrections.distortion);
      buffers.in.set(buffers.out);
    }

    if (settings.lensCorrections.chromaticAberration) {
      applyChromaticAberration(buffers, width, height);
      buffers.in.set(buffers.out);
    }

    // Optics effects.
    if (settings.optics.vignette !== 0) {
      applyVignette(buffers, width, height, settings.optics.vignette);
      buffers.in.set(buffers.out);
    }

    if (settings.optics.grain !== 0) {
      applyGrain(buffers, width, height, settings.optics.grain);
      buffers.in.set(buffers.out);
    }

    if (settings.optics.dehaze !== 0) {
      applyDehaze(buffers, width, height, settings.optics.dehaze);
      buffers.in.set(buffers.out);
    }

    buffers.out.set(buffers.in);
  },
} satisfies PixelProcessor;
