import { limit } from "../engine/geometry";
import type { ImageEditorEdits, LightSettings, PresetId } from "./types";

type Recipe = { id: PresetId; name: string; tone?: Partial<LightSettings>; color?: Partial<Record<"vibrance" | "saturation", number>>; temperature?: number; tint?: number };
export const PRESETS: readonly Recipe[] = [
  { id: "none", name: "None" },
  { id: "auto-enhance", name: "Auto Enhance", tone: { exposure: 0.1, contrast: 10, highlights: -5, shadows: 5 }, color: { vibrance: 10, saturation: 5 } },
  { id: "vibrant", name: "Vibrant", tone: { contrast: 10 }, color: { vibrance: 30, saturation: 15 } },
  { id: "warm", name: "Warm", temperature: 400, tint: 2, color: { saturation: 5 } },
  { id: "cool", name: "Cool", temperature: -400, tint: -2, tone: { contrast: 5 } },
  { id: "matte", name: "Matte", tone: { contrast: -15, highlights: -5, shadows: 10, blacks: 20 }, color: { saturation: -5 } },
  { id: "bw", name: "B&W", tone: { contrast: 10 }, color: { saturation: -100 } },
  { id: "bw-high-contrast", name: "B&W High Contrast", tone: { contrast: 30, blacks: -10, whites: 5 }, color: { saturation: -100 } },
  { id: "vintage-film", name: "Vintage Film", temperature: 300, tint: 2, tone: { contrast: -10, highlights: -5, shadows: 10, blacks: 15 }, color: { saturation: -15, vibrance: -5 } },
];

export function withPreset(edits: ImageEditorEdits, preset: Recipe): ImageEditorEdits {
  const amount = limit(edits.preset.intensity, 0, 100) / 100;
  const light = { ...edits.light };
  for (const key of Object.keys(light) as (keyof LightSettings)[]) {
    const bound = key === "exposure" ? 2 : 100;
    light[key] = limit(light[key] + (preset.tone?.[key] ?? 0) * amount, -bound, bound);
  }
  return {
    ...edits, light,
    whiteBalance: {
      temperatureKelvin: limit(edits.whiteBalance.temperatureKelvin + (preset.temperature ?? 0) * amount, 2000, 10000),
      tint: limit(edits.whiteBalance.tint + (preset.tint ?? 0) * amount, -100, 100),
      preset: preset.temperature || preset.tint ? "custom" : edits.whiteBalance.preset,
    },
    color: { ...edits.color,
      vibrance: limit(edits.color.vibrance + (preset.color?.vibrance ?? 0) * amount, -100, 100),
      saturation: limit(edits.color.saturation + (preset.color?.saturation ?? 0) * amount, -100, 100),
    },
    preset: { activePresetId: "none", intensity: edits.preset.intensity },
  };
}
