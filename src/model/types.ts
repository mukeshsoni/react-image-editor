export type ThemeMode = "light" | "dark" | "system";
export type Point = { x: number; y: number };
export type Dimensions = { width: number; height: number };
export type Rectangle = Point & Dimensions;
export type LightSettings = Record<"exposure" | "contrast" | "highlights" | "shadows" | "whites" | "blacks", number>;
export type WhiteBalancePreset = "custom" | "daylight" | "cloudy" | "shade" | "tungsten" | "fluorescent" | "flash";
export type WhiteBalanceSettings = { temperatureKelvin: number; tint: number; preset: WhiteBalancePreset };
export type ColorBand = "red" | "orange" | "yellow" | "green" | "aqua" | "blue" | "purple" | "magenta";
export type HslSettings = Record<"hue" | "saturation" | "luminance", number>;
export type ColorSettings = {
  vibrance: number;
  saturation: number;
  mixerHsl: Record<ColorBand, HslSettings>;
  pointColor: {
    hue: number | null;
    range: number;
    hueShift: number;
    saturationShift: number;
    luminanceShift: number;
  };
};
export type CurveChannel = "rgb" | "r" | "g" | "b";
export type CurveRegions = Record<"highlights" | "lights" | "darks" | "shadows", number>;
export type CurveSettings = {
  mode: "point" | "parametric";
  activeChannel: CurveChannel;
  point: Record<CurveChannel, Point[]>;
  parametric: { rgb: CurveRegions };
};
export type CropSettings = {
  aspectRatio: string;
  aspectRatioLocked: boolean;
  customAspectRatio?: string;
  rotation?: number;
  constrainCrop?: boolean;
};
export type CropCommit = {
  outputWidth: number;
  outputHeight: number;
  bakedOffset: Point;
  rotationDegrees: number;
};
export type GeometrySettings = {
  perspective: { vertical: number; horizontal: number; aspect?: number };
  lensCorrections: { distortion: number; chromaticAberration: boolean };
  optics: { vignette: number; grain: number; dehaze: number };
};
export type SharpeningSettings = { amount: number; radius: number; detail: number; masking: number };
export type DenoiseSettings = { luminance: number; color: number; detail: number };
export type RepairMode = "spot" | "heal" | "clone";
type RepairBrush = { id: string; radius: number; feather: number; opacity: number; source?: Point };
export type RepairOperation = RepairBrush & (
  | { type: "spot"; mode: "spot" | "heal"; center: Point }
  | { type: "stroke"; mode: "heal" | "clone"; points: Point[] }
);
export type HealingSettings = {
  version: 1;
  mode: RepairMode;
  brush: { size: number; feather: number };
  ops: RepairOperation[];
  cloneSource: Point | null;
};
export type PresetId = "none" | "auto-enhance" | "vibrant" | "warm" | "cool" | "matte" | "bw" | "bw-high-contrast" | "vintage-film";

/** Public version-one snapshot. Rectangles and repair points are image pixels. */
export type ImageEditorEdits = {
  version: 1;
  crop: { rect: Rectangle; settings: CropSettings; committed?: boolean; commit?: CropCommit };
  whiteBalance: WhiteBalanceSettings;
  light: LightSettings;
  color: ColorSettings;
  toneCurve: CurveSettings;
  preset: { activePresetId: PresetId; intensity: number };
  sharpening?: SharpeningSettings;
  denoise?: DenoiseSettings;
  geometryOptics: GeometrySettings;
  healing: HealingSettings;
};

export type Camera = { scale: number; origin: Point };
export type Viewport = Dimensions & { coveredHeight: number };
export type EditorTool = "inspect" | "crop" | "repair";
export type SampleTool = "balance" | "color" | "clone" | null;
