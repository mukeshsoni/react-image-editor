import type {
  ColorAdjustments,
  LightAdjustments,
  WhiteBalanceSettings,
} from "@/store/cropStore";
import type { PresetEdits, PresetId } from "@/store/edits";

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

export const BUILT_IN_PRESETS: ReadonlyArray<PresetDefinition> = [
  { id: "none", name: "None", deltas: {} },
  {
    id: "auto-enhance",
    name: "Auto Enhance",
    deltas: {
      light: { exposure: 0.1, contrast: 10, highlights: -5, shadows: 5 },
      color: { vibrance: 10, saturation: 5 },
    },
  },
  {
    id: "vibrant",
    name: "Vibrant",
    deltas: {
      light: { contrast: 10 },
      color: { vibrance: 30, saturation: 15 },
    },
  },
  {
    id: "warm",
    name: "Warm",
    deltas: {
      whiteBalance: { temperatureKelvin: 400, tint: 2 },
      color: { saturation: 5 },
    },
  },
  {
    id: "cool",
    name: "Cool",
    deltas: {
      whiteBalance: { temperatureKelvin: -400, tint: -2 },
      light: { contrast: 5 },
    },
  },
  {
    id: "matte",
    name: "Matte",
    deltas: {
      light: { contrast: -15, highlights: -5, shadows: 10, blacks: 20 },
      color: { saturation: -5 },
    },
  },
  {
    id: "bw",
    name: "B&W",
    deltas: {
      color: { saturation: -100 },
      light: { contrast: 10 },
    },
  },
  {
    id: "bw-high-contrast",
    name: "B&W High Contrast",
    deltas: {
      color: { saturation: -100 },
      light: { contrast: 30, blacks: -10, whites: 5 },
    },
  },
  {
    id: "vintage-film",
    name: "Vintage Film",
    deltas: {
      whiteBalance: { temperatureKelvin: 300, tint: 2 },
      light: { contrast: -10, highlights: -5, shadows: 10, blacks: 15 },
      color: { saturation: -15, vibrance: -5 },
    },
  },
];

export function getPresetDefinition(presetId: PresetId): PresetDefinition | undefined {
  return BUILT_IN_PRESETS.find((preset) => preset.id === presetId);
}

export function getEffectiveAdjustments(params: {
  manual: ManualAdjustments;
  preset: PresetEdits;
}): ManualAdjustments {
  const definition = getPresetDefinition(params.preset.activePresetId);
  if (!definition || definition.id === "none") {
    return params.manual;
  }

  return combineAdjustments(
    params.manual,
    scalePresetAdjustments(definition.deltas, params.preset.intensity),
  );
}

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
