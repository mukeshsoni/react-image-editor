import type {
  ColorAdjustments,
  LightAdjustments,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";

export type PipelineBuffers = {
  in: Uint8ClampedArray;
  out: Uint8ClampedArray;
  temp: Uint8ClampedArray;
};

export type PixelPipelineContext = {
  whiteBalance?: WhiteBalanceSettings;
  lightAdjustments?: LightAdjustments;
  toneCurve?: ToneCurveSettings;
  colorAdjustments?: ColorAdjustments;
};
