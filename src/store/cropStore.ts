import { create } from "zustand";

import type { Handle } from "../crop-handles";

import type { ImageEditorEdits } from "./edits";


export type Point = {
  x: number;
  y: number;
};
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropSettings = {
  aspectRatio: string;
  aspectRatioLocked: boolean;
  customAspectRatio?: string; // Format: "WxH" like "3x2"
  rotation?: number; // Rotation angle in degrees (-45 to +45)
  constrainCrop?: boolean;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type LightAdjustments = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
};

export type LightAdjustmentName = keyof LightAdjustments;

export const DEFAULT_LIGHT_ADJUSTMENTS: LightAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};

export type ColorAdjustments = {
  vibrance: number;
  saturation: number;
};

export type ColorAdjustmentName = keyof ColorAdjustments;

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  vibrance: 0,
  saturation: 0,
};

export type SharpeningSettings = {
  amount: number;
  radius: number;
  detail: number;
  masking: number;
};

export type DenoiseSettings = {
  luminance: number;
  color: number;
  detail: number;
};

export const DEFAULT_SHARPENING_SETTINGS: SharpeningSettings = {
  amount: 0,
  radius: 1,
  detail: 25,
  masking: 0,
};

export const DEFAULT_DENOISE_SETTINGS: DenoiseSettings = {
  luminance: 0,
  color: 0,
  detail: 50,
};

export type ToneCurveChannel = "rgb" | "r" | "g" | "b";

export type CurvePoint = {
  x: number;
  y: number;
};

export type ToneCurveParametricSettings = {
  highlights: number;
  lights: number;
  darks: number;
  shadows: number;
};

export type ToneCurveSettings = {
  mode: "point" | "parametric";
  activeChannel: ToneCurveChannel;
  point: Record<ToneCurveChannel, CurvePoint[]>;
  parametric: {
    rgb: ToneCurveParametricSettings;
  };
};

export const DEFAULT_TONE_CURVE: ToneCurveSettings = {
  mode: "point",
  activeChannel: "rgb",
  point: {
    rgb: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    r: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    g: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    b: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  parametric: {
    rgb: {
      highlights: 0,
      lights: 0,
      darks: 0,
      shadows: 0,
    },
  },
};

function cloneDefaultToneCurve(): ToneCurveSettings {
  return {
    mode: DEFAULT_TONE_CURVE.mode,
    activeChannel: DEFAULT_TONE_CURVE.activeChannel,
    point: {
      rgb: DEFAULT_TONE_CURVE.point.rgb.map((point) => ({ ...point })),
      r: DEFAULT_TONE_CURVE.point.r.map((point) => ({ ...point })),
      g: DEFAULT_TONE_CURVE.point.g.map((point) => ({ ...point })),
      b: DEFAULT_TONE_CURVE.point.b.map((point) => ({ ...point })),
    },
    parametric: {
      rgb: { ...DEFAULT_TONE_CURVE.parametric.rgb },
    },
  };
}

export type WhiteBalancePreset =
  | "daylight"
  | "cloudy"
  | "shade"
  | "tungsten"
  | "fluorescent"
  | "flash"
  | "custom";

export type WhiteBalanceSettings = {
  temperatureKelvin: number;
  tint: number;
  preset: WhiteBalancePreset;
};

export const DEFAULT_WHITE_BALANCE: WhiteBalanceSettings = {
  temperatureKelvin: 6500,
  tint: 0,
  preset: "custom",
};

export type { ImageEditorEdits } from "./edits";

export type CropCommit = {
  outputWidth: number;
  outputHeight: number;
  bakedOffset: {
    x: number;
    y: number;
  };
  rotationDegrees: number;
};

interface CropStore {
  // State
  cropRect: CropRect;
  cropSettings: CropSettings;
  cropBounds: Bounds;
  cropCommitted: boolean;
  cropCommit: CropCommit | null;
  whiteBalance: WhiteBalanceSettings;
  lightAdjustments: LightAdjustments;
  colorAdjustments: ColorAdjustments;
  toneCurve: ToneCurveSettings;

  // Actions
  setCropRect: (cropRect: CropRect) => void;
  updateCropRect: (updates: Partial<CropRect>) => void;
  setCropSettings: (cropSettings: CropSettings) => void;
  updateCropSettings: (updates: Partial<CropSettings>) => void;

  // Initialize crop rect based on bounds
  initializeCropRect: (bounds: Bounds) => void;

  // Reset to default values
  resetCropSettings: () => void;
  resetCropRect: (bounds: Bounds) => void;
  resetAll: (bounds: Bounds) => void;
  handleCropSettingsChange: (newSettings: CropSettings) => void;

  commitCrop: (commit: CropCommit) => void;
  clearCommittedCrop: () => void;
  moveCropRect: (newPoint: Point, oldPoint: Point) => void;
  resizeCropRect: (
    newPoint: Point,
    oldPoint: Point,
    activeHandle: Handle,
  ) => void;

  // Rotation actions
  setRotation: (angle: number) => void;
  resetRotation: () => void;

  // Crop constraint
  setConstrainCrop: (constrainCrop: boolean) => void;

  // White balance
  setWhiteBalance: (updates: Partial<WhiteBalanceSettings>) => void;
  setWhiteBalancePreset: (preset: WhiteBalancePreset) => void;
  resetWhiteBalance: () => void;

  // Light adjustments
  setLightAdjustment: (name: LightAdjustmentName, value: number) => void;
  resetLightAdjustments: () => void;
  resetLightAdjustment: (name: LightAdjustmentName) => void;

  // Color adjustments
  setColorAdjustment: (name: ColorAdjustmentName, value: number) => void;
  resetColorAdjustments: () => void;
  resetColorAdjustment: (name: ColorAdjustmentName) => void;

  // Tone curve
  setToneCurveMode: (mode: ToneCurveSettings["mode"]) => void;
  setToneCurveChannel: (channel: ToneCurveChannel) => void;
  setToneCurvePoints: (channel: ToneCurveChannel, points: CurvePoint[]) => void;
  setToneCurveParametricRgb: (
    updates: Partial<ToneCurveParametricSettings>,
  ) => void;
  resetToneCurve: () => void;

  // Exportable snapshot of all edits
  getEdits: () => ImageEditorEdits;
}

export const useCropStore = create<CropStore>((set, get) => ({
  // Initial state
  cropRect: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  cropSettings: {
    aspectRatio: "original",
    aspectRatioLocked: false,
    customAspectRatio: undefined,
    rotation: 0,
    constrainCrop: true,
  },
  cropCommitted: false,
  cropCommit: null,
  cropBounds: {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  },
  whiteBalance: { ...DEFAULT_WHITE_BALANCE },
  lightAdjustments: { ...DEFAULT_LIGHT_ADJUSTMENTS },
  colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS },
  toneCurve: cloneDefaultToneCurve(),

  // Actions
  setCropRect: (cropRect: CropRect) => set({ cropRect }),

  updateCropRect: (updates: Partial<CropRect>) =>
    set((state) => ({
      cropRect: { ...state.cropRect, ...updates },
    })),

  setCropSettings: (cropSettings: CropSettings) => {
    get().updateCropSettings(cropSettings);
  },

  updateCropSettings: (updates: Partial<CropSettings>) => {
    const { cropSettings, cropRect, cropBounds } = get();
    const newCropSettings = { ...cropSettings, ...updates };
    let newCropRect = cropRect;
    switch (newCropSettings.aspectRatio) {
      case "original":
        // Set to full image dimensions
        newCropRect = {
          x: cropBounds.minX,
          y: cropBounds.minY,
          width: cropBounds.maxX - cropBounds.minX,
          height: cropBounds.maxY - cropBounds.minY,
        };
        break;
      case "custom": {
        // Apply custom aspect ratio if available
        if (newCropSettings.customAspectRatio) {
          const [widthRatio, heightRatio] = newCropSettings.customAspectRatio
            .split("x")
            .map(Number);
          if (widthRatio && heightRatio) {
            const targetAspectRatio = widthRatio / heightRatio;

            // Get current crop rect center
            const centerX = cropRect.x + cropRect.width / 2;
            const centerY = cropRect.y + cropRect.height / 2;

            // Calculate available space
            const maxWidth = cropBounds.maxX - cropBounds.minX;
            const maxHeight = cropBounds.maxY - cropBounds.minY;

            // Calculate new dimensions maintaining aspect ratio
            let newWidth, newHeight;

            if (maxWidth / maxHeight > targetAspectRatio) {
              // Height is the limiting factor
              newHeight = Math.min(maxHeight, cropRect.height);
              newWidth = newHeight * targetAspectRatio;
            } else {
              // Width is the limiting factor
              newWidth = Math.min(maxWidth, cropRect.width);
              newHeight = newWidth / targetAspectRatio;
            }

            // Try to center the new crop rect around the current center
            let newX = centerX - newWidth / 2;
            let newY = centerY - newHeight / 2;

            // Clamp to bounds
            newX = Math.max(
              cropBounds.minX,
              Math.min(cropBounds.maxX - newWidth, newX),
            );
            newY = Math.max(
              cropBounds.minY,
              Math.min(cropBounds.maxY - newHeight, newY),
            );

            newCropRect = {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }
        }
        // If no custom aspect ratio is set, do nothing - user can freely resize
        break;
      }
      default: {
        // Handle predefined aspect ratios like "2x3", "16x9", etc.
        const [widthRatio, heightRatio] = newCropSettings.aspectRatio
          .split("x")
          .map(Number);
        if (widthRatio && heightRatio) {
          const targetAspectRatio = widthRatio / heightRatio;

          // Get current crop rect center
          const centerX = cropRect.x + cropRect.width / 2;
          const centerY = cropRect.y + cropRect.height / 2;

          // Calculate available space
          const maxWidth = cropBounds.maxX - cropBounds.minX;
          const maxHeight = cropBounds.maxY - cropBounds.minY;

          // Calculate new dimensions maintaining aspect ratio
          let newWidth, newHeight;

          if (maxWidth / maxHeight > targetAspectRatio) {
            // Height is the limiting factor
            newHeight = Math.min(maxHeight, cropRect.height);
            newWidth = newHeight * targetAspectRatio;
          } else {
            // Width is the limiting factor
            newWidth = Math.min(maxWidth, cropRect.width);
            newHeight = newWidth / targetAspectRatio;
          }

          // Try to center the new crop rect around the current center
          let newX = centerX - newWidth / 2;
          let newY = centerY - newHeight / 2;

          // Clamp to bounds
          newX = Math.max(
            cropBounds.minX,
            Math.min(cropBounds.maxX - newWidth, newX),
          );
          newY = Math.max(
            cropBounds.minY,
            Math.min(cropBounds.maxY - newHeight, newY),
          );

          newCropRect = {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          };
        }
        break;
      }
    }
    set({
      cropRect: newCropRect,
      cropSettings: newCropSettings,
    });
  },

  initializeCropRect: (bounds: Bounds) => {
    const { cropRect } = get();
    const hasExistingRect = cropRect.width > 0 && cropRect.height > 0;

    set({
      cropRect: hasExistingRect
        ? clampRect(cropRect, bounds)
        : {
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
        },
      cropBounds: bounds,
    });
  },

  resetCropSettings: () =>
    set({
      cropSettings: {
        aspectRatio: "original",
        aspectRatioLocked: false,
        customAspectRatio: undefined,
        rotation: 0,
        constrainCrop: true,
      },
    }),

  setRotation: (angle: number) => {
    const clampedAngle = clampRotation(angle);
    set((state) => ({
      cropSettings: {
        ...state.cropSettings,
        rotation: clampedAngle,
      },
    }));
  },

  resetRotation: () => {
    set((state) => ({
      cropSettings: {
        ...state.cropSettings,
        rotation: 0,
      },
    }));
  },

  setConstrainCrop: (constrainCrop: boolean) => {
    set((state) => ({
      cropSettings: {
        ...state.cropSettings,
        constrainCrop,
      },
    }));
  },

   resetCropRect: (bounds: Bounds) =>
     set({
       cropRect: {
         x: bounds.minX,
         y: bounds.minY,
         width: bounds.maxX - bounds.minX,
         height: bounds.maxY - bounds.minY,
       },
     }),

   commitCrop: (commit) => {
     set({ cropCommitted: true, cropCommit: commit });
   },

   clearCommittedCrop: () => {
     set({ cropCommitted: false, cropCommit: null });
   },


    resetAll: (bounds) => {
      const {
        clearCommittedCrop,
        resetCropSettings,
        resetCropRect,
        resetWhiteBalance,
        resetLightAdjustments,
        resetColorAdjustments,
        resetToneCurve,
      } = get();
      clearCommittedCrop();
      resetCropSettings();
      resetCropRect(bounds);
      resetWhiteBalance();
      resetLightAdjustments();
      resetColorAdjustments();
      resetToneCurve();
    },

  setWhiteBalance: (updates) => {
    set((state) => {
      const nextWhiteBalance = { ...state.whiteBalance, ...updates };
      const hasManualChange =
        updates.temperatureKelvin !== undefined || updates.tint !== undefined;
      const shouldForceCustom = hasManualChange && updates.preset === undefined;

      return {
        whiteBalance: {
          ...nextWhiteBalance,
          preset: shouldForceCustom ? "custom" : nextWhiteBalance.preset,
        },
      };
    });
  },

  setWhiteBalancePreset: (preset) => {
    set((state) => ({
      whiteBalance: {
        ...state.whiteBalance,
        preset,
      },
    }));
  },

  resetWhiteBalance: () => {
    set({ whiteBalance: { ...DEFAULT_WHITE_BALANCE } });
  },

  setLightAdjustment: (name, value) => {
    set((state) => ({
      lightAdjustments: {
        ...state.lightAdjustments,
        [name]: value,
      },
    }));
  },

  resetLightAdjustments: () => {
    set({ lightAdjustments: { ...DEFAULT_LIGHT_ADJUSTMENTS } });
  },

   resetLightAdjustment: (name) => {
     set((state) => ({
       lightAdjustments: {
         ...state.lightAdjustments,
         [name]: DEFAULT_LIGHT_ADJUSTMENTS[name],
       },
     }));
   },

   setColorAdjustment: (name, value) => {
     set((state) => ({
       colorAdjustments: {
         ...state.colorAdjustments,
         [name]: value,
       },
     }));
   },

   resetColorAdjustments: () => {
     set({ colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS } });
   },

   resetColorAdjustment: (name) => {
     set((state) => ({
       colorAdjustments: {
         ...state.colorAdjustments,
         [name]: DEFAULT_COLOR_ADJUSTMENTS[name],
       },
     }));
   },

   setToneCurveMode: (mode) => {
     set((state) => ({
       toneCurve: {
         ...state.toneCurve,
         mode,
       },
     }));
   },

   setToneCurveChannel: (channel) => {
     set((state) => ({
       toneCurve: {
         ...state.toneCurve,
         activeChannel: channel,
       },
     }));
   },

   setToneCurvePoints: (channel, points) => {
     set((state) => ({
       toneCurve: {
         ...state.toneCurve,
         point: {
           ...state.toneCurve.point,
           [channel]: points,
         },
       },
     }));
   },

   setToneCurveParametricRgb: (updates) => {
     set((state) => ({
       toneCurve: {
         ...state.toneCurve,
         parametric: {
           ...state.toneCurve.parametric,
           rgb: {
             ...state.toneCurve.parametric.rgb,
             ...updates,
           },
         },
       },
     }));
   },

   resetToneCurve: () => {
     set({ toneCurve: cloneDefaultToneCurve() });
   },

   getEdits: () => {
     const {
       cropRect,
       cropSettings,
       cropCommitted,
       cropCommit,
       whiteBalance,
       lightAdjustments,
       colorAdjustments,
       toneCurve,
     } = get();

      return {
        version: 1,
        crop: {
          rect: cropRect,
          settings: cropSettings,
          committed: cropCommitted,
          commit: cropCommit ?? undefined,
        },
        // NOTE: `geometryOptics` state is owned by `geometryOpticsStore`.
        // `cropStore.getEdits()` is retained for legacy usage but isn’t the
        // canonical snapshot path; use `getImageEditorEdits()` instead.
        geometryOptics: {
          perspective: { vertical: 0, horizontal: 0, aspect: 0 },
          lensCorrections: { distortion: 0, chromaticAberration: false },
          optics: { vignette: 0, grain: 0, dehaze: 0 },
        },
        whiteBalance,
        light: lightAdjustments,
        color: colorAdjustments,
        toneCurve,
        healing: {
          version: 1,
          mode: "spot",
          brush: {
            size: 30,
            feather: 50,
          },
          ops: [],
          cloneSource: null,
        },
      };

   },


  handleCropSettingsChange: (newSettings: CropSettings) => {
    set({ cropSettings: newSettings });
  },

  moveCropRect(newPoint: Point, oldPoint: Point) {
    const { cropBounds, cropRect, updateCropRect } = get();

    // Find how much it has moved from the last mouse position
    const deltaX = newPoint.x - oldPoint.x;
    const deltaY = newPoint.y - oldPoint.y;
    const imageWidth = cropBounds.maxX - cropBounds.minX;
    const imageHeight = cropBounds.maxY - cropBounds.minY;

    const newX = Math.max(
      // This is clamp the min x on the left side we allow x to go.
      cropBounds.minX,
      Math.min(
        // This is the max we allow x to go on the right side. Beyond that the right side of crop rectangle
        // will go outside the image right edge
        imageWidth - cropRect.width + cropBounds.minX,
        cropRect.x + deltaX,
      ),
    );
    const newY = Math.max(
      // This is the min y on the top side we allow y to go.
      cropBounds.minY,
      Math.min(
        // This is the max we allow y to go. Beyond that the bottom side of crop rectangle
        // will go outside the image bottom edge
        imageHeight - cropRect.height + cropBounds.minY,
        cropRect.y + deltaY,
      ),
    );

    updateCropRect({
      x: newX,
      y: newY,
    });
  },

  resizeCropRect(oldPoint: Point, newPoint: Point, activeHandle: Handle) {
    const { cropRect, cropBounds, cropSettings, setCropRect } = get();
    const newRect = getResizedRect(
      cropBounds,
      cropSettings,
      cropRect,
      activeHandle,
      oldPoint,
      newPoint,
    );
    const boundedRect = clampRect(newRect, cropBounds);

    setCropRect(boundedRect);
  },
}));

function clampRotation(angle: number): number {
  const MIN_ROTATION = -45;
  const MAX_ROTATION = 45;

  return Math.max(MIN_ROTATION, Math.min(MAX_ROTATION, angle));
}


export function getResizedRect(
  cropBounds: Bounds,
  cropSettings: CropSettings,
  rect: CropRect,
  handle: string,
  currentPoint: Point,
  startPoint: Point,
): CropRect {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;

  // Calculate the base resize without aspect ratio constraints
  let newRect: CropRect;

  switch (handle) {
    case "top-left":
      newRect = {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width - deltaX,
        height: rect.height - deltaY,
      };
      break;
    case "top":
      newRect = {
        ...rect,
        y: rect.y + deltaY,
        height: rect.height - deltaY,
      };
      break;
    case "top-right":
      newRect = {
        ...rect,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height - deltaY,
      };
      break;
    case "left":
      newRect = {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
      };
      break;
    case "right":
      newRect = {
        ...rect,
        width: rect.width + deltaX,
      };
      break;
    case "bottom-left":
      newRect = {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
        height: rect.height + deltaY,
      };
      break;
    case "bottom":
      newRect = {
        ...rect,
        height: rect.height + deltaY,
      };
      break;
    case "bottom-right":
      newRect = {
        ...rect,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
      };
      break;
    default:
      return rect;
  }

  // If aspect ratio is not locked, return the new rect as-is
  if (!cropSettings.aspectRatioLocked) {
    return newRect;
  }

  // If it's custom but no custom aspect ratio is set, return as-is
  if (
    cropSettings.aspectRatio === "custom" &&
    !cropSettings.customAspectRatio
  ) {
    return newRect;
  }

  // Apply aspect ratio constraints
  return applyAspectRatioConstraints(
    cropBounds,
    newRect,
    handle,
    cropSettings.aspectRatio,
    cropSettings.customAspectRatio,
  );
}

export function applyAspectRatioConstraints(
  cropBounds: Bounds,
  newRect: CropRect,
  handle: string,
  aspectRatio: string,
  customAspectRatio?: string,
): CropRect {
  // Parse aspect ratio
  let targetAspectRatio: number;
  const imageWidth = cropBounds.maxX - cropBounds.minX;
  const imageHeight = cropBounds.maxY - cropBounds.minY;

  if (aspectRatio === "original") {
    // Use the crop bounds aspect ratio
    targetAspectRatio = imageWidth / imageHeight;
  } else if (aspectRatio === "custom") {
    if (!customAspectRatio) {
      return newRect; // No custom aspect ratio set
    }
    const [widthRatio, heightRatio] = customAspectRatio.split("x").map(Number);
    if (!widthRatio || !heightRatio) {
      return newRect; // Invalid custom aspect ratio
    }
    targetAspectRatio = widthRatio / heightRatio;
  } else {
    // Parse aspect ratio like "16x9", "4x3", etc.
    const [widthRatio, heightRatio] = aspectRatio.split("x").map(Number);
    if (!widthRatio || !heightRatio) {
      return newRect; // Invalid aspect ratio, return unconstrained
    }
    targetAspectRatio = widthRatio / heightRatio;
  }

  // Calculate constrained dimensions based on the handle being dragged
  let constrainedRect = { ...newRect };

  switch (handle) {
    case "top-left":
    case "bottom-right": {
      // For corner handles, prioritize width and adjust height
      const newHeight = newRect.width / targetAspectRatio;
      if (handle === "top-left") {
        constrainedRect = {
          x: newRect.x,
          y: newRect.y + newRect.height - newHeight,
          width: newRect.width,
          height: newHeight,
        };
      } else {
        constrainedRect = {
          ...newRect,
          height: newHeight,
        };
      }
      break;
    }
    case "top-right":
    case "bottom-left": {
      // For other corner handles, prioritize width and adjust height
      const newHeight = newRect.width / targetAspectRatio;
      if (handle === "top-right") {
        constrainedRect = {
          x: newRect.x,
          y: newRect.y + newRect.height - newHeight,
          width: newRect.width,
          height: newHeight,
        };
      } else {
        constrainedRect = {
          ...newRect,
          height: newHeight,
        };
      }
      break;
    }
    case "left":
    case "right": {
      // For horizontal handles, adjust height to maintain aspect ratio
      const newHeight = newRect.width / targetAspectRatio;
      constrainedRect = {
        ...newRect,
        height: newHeight,
      };
      break;
    }
    case "top":
    case "bottom": {
      // For vertical handles, adjust width to maintain aspect ratio
      const newWidth = newRect.height * targetAspectRatio;
      if (handle === "top") {
        constrainedRect = {
          x: newRect.x - (newWidth - newRect.width) / 2,
          y: newRect.y,
          width: newWidth,
          height: newRect.height,
        };
      } else {
        constrainedRect = {
          x: newRect.x - (newWidth - newRect.width) / 2,
          y: newRect.y,
          width: newWidth,
          height: newRect.height,
        };
      }
      break;
    }
  }

  return constrainedRect;
}

// The rectangle we calculate on mouse movement should not go outside the bounds of the image
function clampRect(rect: CropRect, bounds: Bounds): CropRect {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX - rect.width, rect.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY - rect.height, rect.y)),
    width: Math.max(0, Math.min(bounds.maxX - bounds.minX, rect.width)),
    height: Math.max(0, Math.min(bounds.maxY - bounds.minY, rect.height)),
  };
}
