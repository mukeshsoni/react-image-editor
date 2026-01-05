import type {
  WhiteBalancePreset,
  WhiteBalanceSettings,
} from "../store/cropStore";

export const WHITE_BALANCE_PRESETS: Record<
  Exclude<WhiteBalancePreset, "custom">,
  Pick<WhiteBalanceSettings, "temperatureKelvin" | "tint">
> = {
  // Approximate Lightroom-like defaults; tune visually.
  daylight: { temperatureKelvin: 5500, tint: 0 },
  cloudy: { temperatureKelvin: 6500, tint: 0 },
  shade: { temperatureKelvin: 7500, tint: 0 },
  tungsten: { temperatureKelvin: 2850, tint: 0 },
  fluorescent: { temperatureKelvin: 3800, tint: 0 },
  flash: { temperatureKelvin: 5500, tint: 0 },
};

export function hasNonNeutralWhiteBalance(settings: WhiteBalanceSettings): boolean {
  return settings.temperatureKelvin !== 6500 || settings.tint !== 0;
}

export function applyWhiteBalanceToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  whiteBalance: WhiteBalanceSettings,
): void {
  if (output.length !== input.length) {
    throw new Error("Output buffer must match input length");
  }

  // Approximation: map temperature to a warm/cool bias by adjusting R/B gains.
  // 6500K is neutral. Lower K = warmer (more red), higher K = cooler (more blue).
  const temperatureNormalized = (whiteBalance.temperatureKelvin - 6500) / 3500;
  const temperatureClamped = clamp(temperatureNormalized, -1, 1);

  // Positive normalized = cooler => decrease red, increase blue.
  const redGain = 1 - temperatureClamped * 0.15;
  const blueGain = 1 + temperatureClamped * 0.15;

  // Tint: green ↔ magenta, implemented as a green channel gain.
  const tintNormalized = clamp(whiteBalance.tint / 100, -1, 1);
  const greenGain = 1 - tintNormalized * 0.15;

  for (let i = 0; i < input.length; i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    const r = clampByte(r0 * redGain);
    const g = clampByte(g0 * greenGain);
    const b = clampByte(b0 * blueGain);

    output[i] = r;
    output[i + 1] = g;
    output[i + 2] = b;
    output[i + 3] = a0;
  }
}

export function estimateWhiteBalanceFromRgb(
  rgb: { r: number; g: number; b: number },
): Pick<WhiteBalanceSettings, "temperatureKelvin" | "tint"> {
  // Heuristic: neutralize a sampled patch by comparing channels.
  // If R > B, we likely need cooler temperature; if B > R, warmer.
  const r = Math.max(1, rgb.r);
  const g = Math.max(1, rgb.g);
  const b = Math.max(1, rgb.b);

  const ratioRB = r / b;
  // ratioRB > 1 means red-dominant; shift cooler (increase K)
  // ratioRB < 1 means blue-dominant; shift warmer (decrease K)
  const temperatureShift = clamp((ratioRB - 1) * 2500, -3500, 3500);
  const temperatureKelvin = clamp(6500 + temperatureShift, 2000, 10000);

  const ratioG = g / ((r + b) / 2);
  // ratioG > 1 means green cast -> positive tint (magenta) should reduce green
  // ratioG < 1 means magenta cast -> negative tint (green) should increase green
  const tintShift = clamp((ratioG - 1) * 100, -100, 100);

  return {
    temperatureKelvin,
    tint: tintShift,
  };
}

export function sampleAverageRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): { r: number; g: number; b: number } {
  const clampedRadius = Math.max(0, Math.floor(radius));
  const startX = clampInt(x - clampedRadius, 0, Math.max(0, width - 1));
  const endX = clampInt(x + clampedRadius, 0, Math.max(0, width - 1));
  const startY = clampInt(y - clampedRadius, 0, Math.max(0, height - 1));
  const endY = clampInt(y + clampedRadius, 0, Math.max(0, height - 1));

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let yy = startY; yy <= endY; yy += 1) {
    for (let xx = startX; xx <= endX; xx += 1) {
      const idx = (yy * width + xx) * 4;
      rSum += data[idx] ?? 0;
      gSum += data[idx + 1] ?? 0;
      bSum += data[idx + 2] ?? 0;
      count += 1;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0 };

  return {
    r: rSum / count,
    g: gSum / count,
    b: bSum / count,
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
