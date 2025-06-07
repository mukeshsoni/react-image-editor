import { type Handle } from "../Cropper";
import { create } from "zustand";

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
    switch (cropSettings.aspectRatio) {
      case "original":
        // Set to full image dimensions
        newCropRect = {
          x: cropBounds.minX,
          y: cropBounds.minY,
          width: cropBounds.maxX - cropBounds.minX,
          height: cropBounds.maxY - cropBounds.minY,
        };
        break;
      case "custom":
        // Do nothing - user can freely resize
        break;
      default: {
        // Handle predefined aspect ratios like "2x3", "16x9", etc.
        const [widthRatio, heightRatio] = cropSettings.aspectRatio
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

  initializeCropRect: (bounds: Bounds) =>
    set({
      cropRect: {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      },
      cropBounds: bounds,
    }),

  resetCropSettings: () =>
    set({
      cropSettings: {
        aspectRatio: "original",
        aspectRatioLocked: false,
      },
    }),

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
    console.log("resetAll");
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
    const { cropRect, cropBounds, setCropRect } = get();
    const newRect = getResizedRect(cropRect, activeHandle, oldPoint, newPoint);
    const boundedRect = clampRect(newRect, cropBounds);

    setCropRect(boundedRect);
  },
}));

function getResizedRect(
  rect: CropRect,
  handle: string,
  currentPoint: Point,
  startPoint: Point,
): CropRect {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;

  switch (handle) {
    case "top-left":
      return {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width - deltaX,
        height: rect.height - deltaY,
      };
    case "top":
      return {
        ...rect,
        y: rect.y + deltaY,
        height: rect.height - deltaY,
      };
    case "top-right":
      return {
        ...rect,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height - deltaY,
      };
    case "left":
      return {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
      };
    case "right":
      return {
        ...rect,
        width: rect.width + deltaX,
      };
    case "bottom-left":
      return {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
        height: rect.height + deltaY,
      };
    case "bottom":
      return {
        ...rect,
        height: rect.height + deltaY,
      };
    case "bottom-right":
      return {
        ...rect,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
      };
    default:
      return rect;
  }
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
