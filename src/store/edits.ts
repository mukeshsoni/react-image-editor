import type {
  ColorAdjustments,
  CropRect,
  CropSettings,
  DenoiseSettings,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "./cropStore";
import type { GeometryOpticsSettings } from "./geometryOpticsStore";
import type { HealingEdits } from "./healingStore";

export type PresetId =
  | "none"
  | "auto-enhance"
  | "vibrant"
  | "warm"
  | "cool"
  | "matte"
  | "bw"
  | "bw-high-contrast"
  | "vintage-film";

export type PresetEdits = {
  activePresetId: PresetId;
  intensity: number; // 0-100
};

export type ImageEditorEdits = {
  version: 1;
  crop: {
    rect: CropRect;
    settings: CropSettings;
    committed?: boolean;
    commit?: {
      outputWidth: number;
      outputHeight: number;
      bakedOffset: {
        x: number;
        y: number;
      };
      rotationDegrees: number;
    };
  };
  geometryOptics: GeometryOpticsSettings;
  whiteBalance: WhiteBalanceSettings;
  light: LightAdjustments;
  color: ColorAdjustments;
  toneCurve: ToneCurveSettings;
  preset: PresetEdits;
  sharpening?: SharpeningSettings;
  denoise?: DenoiseSettings;
  healing: HealingEdits;
};
