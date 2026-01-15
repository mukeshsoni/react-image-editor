import type {
  ColorAdjustments,
  LightAdjustments,
  WhiteBalanceSettings,
} from "@/store/cropStore";
import type { PresetId } from "@/store/edits";

export type PresetDeltas = {
  light?: Partial<LightAdjustments>;
  color?: Partial<ColorAdjustments>;
  whiteBalance?: {
    temperatureKelvin?: number;
    tint?: number;
  };
};

export type PresetDefinition = {
  id: PresetId;
  name: string;
  deltas: PresetDeltas;
};

export type ManualAdjustments = {
  whiteBalance: WhiteBalanceSettings;
  light: LightAdjustments;
  color: ColorAdjustments;
};

const LIGHT_LIMITS: Record<keyof LightAdjustments, { min: number; max: number }> = {
  exposure: { min: -2, max: 2 },
  contrast: { min: -100, max: 100 },
  highlights: { min: -100, max: 100 },
  shadows: { min: -100, max: 100 },
  whites: { min: -100, max: 100 },
  blacks: { min: -100, max: 100 },
};

const COLOR_LIMITS: Record<keyof ColorAdjustments, { min: number; max: number }> = {
  vibrance: { min: -100, max: 100 },
  saturation: { min: -100, max: 100 },
};

const WHITE_BALANCE_LIMITS = {
  temperatureKelvin: { min: 2000, max: 10000 },
  tint: { min: -100, max: 100 },
} as const;

const LIGHT_KEYS = Object.keys(LIGHT_LIMITS) as Array<keyof LightAdjustments>;
const COLOR_KEYS = Object.keys(COLOR_LIMITS) as Array<keyof ColorAdjustments>;

export function scalePresetAdjustments(deltas: PresetDeltas, intensity: number): PresetDeltas {
  const clampedIntensity = clamp(intensity, 0, 100);
  const factor = clampedIntensity / 100;

  return {
    light: scaleNumericRecord(deltas.light, factor),
    color: scaleNumericRecord(deltas.color, factor),
    whiteBalance: deltas.whiteBalance
      ? {
          temperatureKelvin:
            deltas.whiteBalance.temperatureKelvin != null
              ? deltas.whiteBalance.temperatureKelvin * factor
              : undefined,
          tint:
            deltas.whiteBalance.tint != null
              ? deltas.whiteBalance.tint * factor
              : undefined,
        }
      : undefined,
  };
}

export function combineAdjustments(
  manual: ManualAdjustments,
  presetScaled: PresetDeltas,
): ManualAdjustments {
  const light: LightAdjustments = { ...manual.light };
  for (const key of LIGHT_KEYS) {
    const delta = presetScaled.light?.[key] ?? 0;
    const limits = LIGHT_LIMITS[key];
    light[key] = clamp(manual.light[key] + delta, limits.min, limits.max);
  }

  const color: ColorAdjustments = { ...manual.color };
  for (const key of COLOR_KEYS) {
    const delta = presetScaled.color?.[key] ?? 0;
    const limits = COLOR_LIMITS[key];
    color[key] = clamp(manual.color[key] + delta, limits.min, limits.max);
  }

  const wbDeltaK = presetScaled.whiteBalance?.temperatureKelvin ?? 0;
  const wbDeltaTint = presetScaled.whiteBalance?.tint ?? 0;
  const hasWbDelta = wbDeltaK !== 0 || wbDeltaTint !== 0;

  const whiteBalance: WhiteBalanceSettings = {
    ...manual.whiteBalance,
    temperatureKelvin: clamp(
      manual.whiteBalance.temperatureKelvin + wbDeltaK,
      WHITE_BALANCE_LIMITS.temperatureKelvin.min,
      WHITE_BALANCE_LIMITS.temperatureKelvin.max,
    ),
    tint: clamp(
      manual.whiteBalance.tint + wbDeltaTint,
      WHITE_BALANCE_LIMITS.tint.min,
      WHITE_BALANCE_LIMITS.tint.max,
    ),
    preset: hasWbDelta ? "custom" : manual.whiteBalance.preset,
  };

  return {
    whiteBalance,
    light,
    color,
  };
}

function scaleNumericRecord<T extends Record<string, number>>(
  values: Partial<T> | undefined,
  factor: number,
): Partial<T> | undefined {
  if (!values) return undefined;

  const entries = Object.entries(values).map(([key, value]) => [
    key,
    value * factor,
  ]);

  return Object.fromEntries(entries) as Partial<T>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
