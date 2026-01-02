import { create } from "zustand";

import type { Handle } from "../crop-handles";

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
  rotation: number; // Rotation angle in degrees (-45 to +45)
  constrainCrop: boolean;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

interface CropStore {
  // State
  cropRect: CropRect;
  cropSettings: CropSettings;
  cropBounds: Bounds;

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
  cropBounds: {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  },

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

  resetAll: (bounds) => {
    const { resetCropSettings, resetCropRect } = get();
    resetCropSettings();
    resetCropRect(bounds);
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
    // Use the original rectangle's aspect ratio
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
