import type { ReactNode } from "react";

import type {
  ColorAdjustments,
  CurvePoint,
  LightAdjustments,
  ToneCurveChannel,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "@/store/cropStore";

export type PanelSliderProps = {
  label: string;
  name: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  format: (value: number) => string;
  onValueChange: (value: number) => void;
};

export type PanelContext = {
  isImageLoaded: boolean;

  Slider: (props: PanelSliderProps) => ReactNode;
  formatSigned: (value: number, digits: number) => string;
  formatSignedInt: (value: number) => string;

  whiteBalance: WhiteBalanceSettings;
  resetWhiteBalance: () => void;
  setIsPickingWhiteBalance: (updater: (current: boolean) => boolean) => void;
  setWhiteBalance: (updates: Partial<WhiteBalanceSettings>) => void;

  lightAdjustments: LightAdjustments;
  resetLightAdjustments: () => void;
  setLightAdjustment: (name: keyof LightAdjustments, value: number) => void;

  colorAdjustments: ColorAdjustments;
  resetColorAdjustments: () => void;
  setColorAdjustment: (name: keyof ColorAdjustments, value: number) => void;

  toneCurve: ToneCurveSettings;
  resetToneCurve: () => void;
  setToneCurveMode: (mode: ToneCurveSettings["mode"]) => void;
  setToneCurveChannel: (channel: ToneCurveChannel) => void;
  setToneCurvePoints: (channel: ToneCurveChannel, points: CurvePoint[]) => void;
  setToneCurveParametricRgb: (updates: {
    highlights?: number;
    lights?: number;
    darks?: number;
    shadows?: number;
  }) => void;
};
