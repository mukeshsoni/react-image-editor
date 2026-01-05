import type { ColorAdjustments } from "../store/cropStore";

export function hasNonNeutralColorAdjustments(settings: ColorAdjustments): boolean {
  return settings.vibrance !== 0 || settings.saturation !== 0;
}

/**
 * Color adjustment pipeline for RGBA pixels.
 *
 * Implementation notes:
 * - We convert RGB bytes (0–255) to floats (0–1).
 * - We apply saturation/vibrance using HSL saturation.
 * - We preserve alpha as-is.
 */
export function applyColorAdjustmentsToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  adjustments: ColorAdjustments,
): void {
  if (output.length !== input.length) {
    throw new Error("Output buffer must match input length");
  }

  const saturationScale = 1 + adjustments.saturation / 100;
  const vibranceAmount = adjustments.vibrance / 100;

  for (let i = 0; i < input.length; i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    const r = r0 / 255;
    const g = g0 / 255;
    const b = b0 / 255;

    const hsl = rgbToHsl(r, g, b);

    // Saturation: uniform scale.
    let s = clamp01(hsl.s * saturationScale);

    // Vibrance: boost (or reduce) low-saturation colors more than high-saturation.
    // This is a lightweight approximation intended for v1.
    if (vibranceAmount !== 0) {
      const weight = 1 - s;
      s = clamp01(s + vibranceAmount * weight * 0.8);
    }

    const rgb = hslToRgb({ h: hsl.h, s, l: hsl.l });

    output[i] = floatToByte(rgb.r);
    output[i + 1] = floatToByte(rgb.g);
    output[i + 2] = floatToByte(rgb.b);
    output[i + 3] = a0;
  }
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / delta) % 6;
      break;
    case g:
      h = (b - r) / delta + 2;
      break;
    default:
      h = (r - g) / delta + 4;
      break;
  }

  h /= 6;
  if (h < 0) h += 1;

  return { h, s, l };
}

function hslToRgb(hsl: Hsl): { r: number; g: number; b: number } {
  const { h, s, l } = hsl;

  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3),
  };
}

function hueToRgb(p: number, q: number, t0: number): number {
  let t = t0;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;

  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function floatToByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}
