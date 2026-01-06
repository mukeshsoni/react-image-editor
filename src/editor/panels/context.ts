import type { ReactNode } from "react";

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

  setIsPickingWhiteBalance: (updater: (current: boolean) => boolean) => void;
};
