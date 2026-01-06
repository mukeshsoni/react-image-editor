import type {
  ColorAdjustments,
  CropRect,
  CropSettings,
  LightAdjustments,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "./cropStore";

export type ImageEditorEdits = {
  version: 1;
  crop: {
    rect: CropRect;
    settings: CropSettings;
  };
  whiteBalance: WhiteBalanceSettings;
  light: LightAdjustments;
  color: ColorAdjustments;
  toneCurve: ToneCurveSettings;
};
