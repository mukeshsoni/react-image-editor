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
  sharpening?: SharpeningSettings;
  denoise?: DenoiseSettings;
};
