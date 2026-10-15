import type { ColorBand, ImageEditorEdits, Dimensions, WhiteBalancePreset } from "./types";

export const COLOR_BANDS: readonly ColorBand[] = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];

export const ASPECT_OPTIONS = [
  ["original", "Original"], ["1x1", "1x1"], ["4x5", "4x5/8x10"], ["8.5x11", "8.5x11"],
  ["5x7", "5x7"], ["2x3", "2x3/4x6"], ["4x3", "4x3"], ["16x9", "16x9"],
  ["16x10", "16x10"], ["custom", "Custom"],
] as const;

export const BALANCE_PRESETS: readonly { id: WhiteBalancePreset; name: string; kelvin: number; tint: number }[] = [
  { id: "custom", name: "Custom", kelvin: 6500, tint: 0 },
  { id: "daylight", name: "Daylight", kelvin: 5500, tint: 0 },
  { id: "cloudy", name: "Cloudy", kelvin: 6500, tint: 0 },
  { id: "shade", name: "Shade", kelvin: 7500, tint: 0 },
  { id: "tungsten", name: "Tungsten", kelvin: 2850, tint: 0 },
  { id: "fluorescent", name: "Fluorescent", kelvin: 3800, tint: 10 },
  { id: "flash", name: "Flash", kelvin: 6000, tint: 0 },
];

export function initialEdits(size: Dimensions = { width: 0, height: 0 }): ImageEditorEdits {
  const hsl = () => ({ hue: 0, saturation: 0, luminance: 0 });
  const line = () => [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  return {
    version: 1,
    crop: {
      rect: { x: 0, y: 0, width: size.width, height: size.height },
      settings: { aspectRatio: "original", aspectRatioLocked: false, rotation: 0, constrainCrop: true },
      committed: false,
    },
    whiteBalance: { temperatureKelvin: 6500, tint: 0, preset: "custom" },
    light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
    color: {
      vibrance: 0, saturation: 0,
      mixerHsl: { red: hsl(), orange: hsl(), yellow: hsl(), green: hsl(), aqua: hsl(), blue: hsl(), purple: hsl(), magenta: hsl() },
      pointColor: { hue: null, range: 50, hueShift: 0, saturationShift: 0, luminanceShift: 0 },
    },
    toneCurve: {
      mode: "point", activeChannel: "rgb",
      point: { rgb: line(), r: line(), g: line(), b: line() },
      parametric: { rgb: { highlights: 0, lights: 0, darks: 0, shadows: 0 } },
    },
    preset: { activePresetId: "none", intensity: 100 },
    sharpening: { amount: 0, radius: 1, detail: 25, masking: 0 },
    denoise: { luminance: 0, color: 0, detail: 50 },
    geometryOptics: {
      perspective: { vertical: 0, horizontal: 0, aspect: 0 },
      lensCorrections: { distortion: 0, chromaticAberration: false },
      optics: { vignette: 0, grain: 0, dehaze: 0 },
    },
    healing: { version: 1, mode: "spot", brush: { size: 30, feather: 50 }, ops: [], cloneSource: null },
  };
}
