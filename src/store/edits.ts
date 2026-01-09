import type {
  ColorAdjustments,
  CropRect,
  CropSettings,
  LightAdjustments,
  DenoiseSettings,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "./cropStore";

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
  whiteBalance: WhiteBalanceSettings;
  light: LightAdjustments;
  color: ColorAdjustments;
  toneCurve: ToneCurveSettings;
  sharpening?: SharpeningSettings;
  denoise?: DenoiseSettings;
};
