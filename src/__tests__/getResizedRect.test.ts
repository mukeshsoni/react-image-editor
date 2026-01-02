import { describe, test, expect } from "vitest";
import { getResizedRect } from "../store/cropStore";
import type { CropSettings, CropRect, Point, Bounds } from "../store/cropStore";

describe("getResizedRect", () => {
  const baseRect: CropRect = {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
  };

  const cropBounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: 800,
    maxY: 600,
  };

  const startPoint: Point = { x: 0, y: 0 };

  describe("without aspect ratio constraints", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: false,
      rotation: 0,
      constrainCrop: true,
    };

    test("top-left handle resize", () => {
      const currentPoint: Point = { x: 20, y: 10 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top-left", currentPoint, startPoint);

      expect(result).toEqual({
        x: 120, // x + deltaX (100 + 20)
        y: 110, // y + deltaY (100 + 10)
        width: 180, // width - deltaX (200 - 20)
        height: 90, // height - deltaY (100 - 10)
      });
    });

    test("top handle resize", () => {
      const currentPoint: Point = { x: 0, y: 15 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 115, // y + deltaY (100 + 15)
        width: 200, // unchanged
        height: 85, // height - deltaY (100 - 15)
      });
    });

    test("top-right handle resize", () => {
      const currentPoint: Point = { x: 30, y: 20 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top-right", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 120, // y + deltaY (100 + 20)
        width: 230, // width + deltaX (200 + 30)
        height: 80, // height - deltaY (100 - 20)
      });
    });

    test("left handle resize", () => {
      const currentPoint: Point = { x: 25, y: 0 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "left", currentPoint, startPoint);

      expect(result).toEqual({
        x: 125, // x + deltaX (100 + 25)
        y: 100, // unchanged
        width: 175, // width - deltaX (200 - 25)
        height: 100, // unchanged
      });
    });

    test("right handle resize", () => {
      const currentPoint: Point = { x: 40, y: 0 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "right", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 100, // unchanged
        width: 240, // width + deltaX (200 + 40)
        height: 100, // unchanged
      });
    });

    test("bottom-left handle resize", () => {
      const currentPoint: Point = { x: 10, y: 50 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-left", currentPoint, startPoint);

      expect(result).toEqual({
        x: 110, // x + deltaX (100 + 10)
        y: 100, // unchanged
        width: 190, // width - deltaX (200 - 10)
        height: 150, // height + deltaY (100 + 50)
      });
    });

    test("bottom handle resize", () => {
      const currentPoint: Point = { x: 0, y: 35 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 100, // unchanged
        width: 200, // unchanged
        height: 135, // height + deltaY (100 + 35)
      });
    });

    test("bottom-right handle resize", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 100, // unchanged
        width: 250, // width + deltaX (200 + 50)
        height: 125, // height + deltaY (100 + 25)
      });
    });

    test("invalid handle returns original rect", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "invalid", currentPoint, startPoint);

      expect(result).toEqual(baseRect);
    });

    test("negative deltas (dragging inward)", () => {
      const currentPoint: Point = { x: -20, y: -10 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      expect(result).toEqual({
        x: 100, // unchanged
        y: 100, // unchanged
        width: 180, // width + deltaX (200 + (-20))
        height: 90, // height + deltaY (100 + (-10))
      });
    });
  });

  describe("with aspect ratio locked - 16x9", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "16x9",
      aspectRatioLocked: true,
      rotation: 0,
      constrainCrop: true,
    };

    test("bottom-right handle maintains 16:9 aspect ratio", () => {
      const currentPoint: Point = { x: 80, y: 45 }; // deltaX: 80, deltaY: 45
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // New width would be 280 (200 + 80)
      // For 16:9, height should be 280 / (16/9) = 157.5
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(280);
      expect(result.height).toBeCloseTo(157.5, 1);
    });

    test("top-left handle maintains aspect ratio and adjusts position", () => {
      const currentPoint: Point = { x: 32, y: 18 }; // deltaX: 32, deltaY: 18
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top-left", currentPoint, startPoint);

      // New width would be 168 (200 - 32)
      // For 16:9, height should be 168 / (16/9) = 94.5
      // Y position should adjust: y + originalHeight - newHeight = 100 + 100 - 94.5 = 105.5
      expect(result.x).toBe(132);
      expect(result.y).toBeCloseTo(105.5, 1);
      expect(result.width).toBe(168);
      expect(result.height).toBeCloseTo(94.5, 1);
    });

    test("right handle maintains aspect ratio", () => {
      const currentPoint: Point = { x: 90, y: 0 }; // deltaX: 90, deltaY: 0
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "right", currentPoint, startPoint);

      // New width would be 290 (200 + 90)
      // For 16:9, height should be 290 / (16/9) = 163.125
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(290);
      expect(result.height).toBeCloseTo(163.125, 1);
    });

    test("top handle adjusts width to maintain aspect ratio", () => {
      const currentPoint: Point = { x: 0, y: 20 }; // deltaX: 0, deltaY: 20
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top", currentPoint, startPoint);

      // New height would be 80 (100 - 20)
      // For 16:9, width should be 80 * (16/9) = 142.22
      // X position should center: x - (newWidth - originalWidth) / 2 = 100 - (142.22 - 200) / 2 = 128.89
      expect(result.x).toBeCloseTo(128.89, 1);
      expect(result.y).toBe(120);
      expect(result.width).toBeCloseTo(142.22, 1);
      expect(result.height).toBe(80);
    });
  });

  describe("with aspect ratio locked - 1x1 (square)", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "1x1",
      aspectRatioLocked: true,
    };

    test("bottom-right handle creates square", () => {
      const currentPoint: Point = { x: 50, y: 30 }; // deltaX: 50, deltaY: 30
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // New width would be 250 (200 + 50)
      // For 1:1, height should equal width = 250
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(250);
      expect(result.height).toBe(250);
    });

    test("left handle creates square", () => {
      const currentPoint: Point = { x: 40, y: 0 }; // deltaX: 40, deltaY: 0
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "left", currentPoint, startPoint);

      // New width would be 160 (200 - 40)
      // For 1:1, height should equal width = 160
      expect(result.x).toBe(140);
      expect(result.y).toBe(100);
      expect(result.width).toBe(160);
      expect(result.height).toBe(160);
    });
  });

  describe("with aspect ratio locked - original", () => {
    const rect: CropRect = {
      x: 50,
      y: 50,
      width: 400,
      height: 100,
    };

    const cropSettings: CropSettings = {
      aspectRatio: "original",
      aspectRatioLocked: true,
      rotation: 0,
      constrainCrop: true,
    };

    test("maintains crop bounds aspect ratio", () => {
      const currentPoint: Point = { x: 100, y: 25 }; // deltaX: 100, deltaY: 25
      const result = getResizedRect(
        cropBounds,
        cropSettings,
        rect,
        "bottom-right",
        currentPoint,
        startPoint,
      );

      // New width would be 500 (400 + 100)
      // For bounds aspect ratio 800:600 (4:3), height should be 500 / (4/3) = 375
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
      expect(result.width).toBe(500);
      expect(result.height).toBe(375);
    });
  });

  describe("with aspect ratio unlocked but specific ratio set", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "16x9",
      aspectRatioLocked: false,
    };

    test("ignores aspect ratio when not locked", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should behave like free resize, ignoring the 16:9 ratio
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250, // width + deltaX (200 + 50)
        height: 125, // height + deltaY (100 + 25)
      });
    });
  });

  describe("edge cases", () => {
    test("zero delta movement", () => {
      const currentPoint: Point = { x: 0, y: 0 };
      const cropSettings: CropSettings = {
        aspectRatio: "custom",
        aspectRatioLocked: false,
      };

      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      expect(result).toEqual(baseRect);
    });

    test("invalid aspect ratio format", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const cropSettings: CropSettings = {
        aspectRatio: "invalid",
        aspectRatioLocked: true,
      };

      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should return the unconstrained resize since aspect ratio is invalid
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 125,
      });
    });

    test("aspect ratio with zero denominator", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const cropSettings: CropSettings = {
        aspectRatio: "16x0",
        aspectRatioLocked: true,
      };

      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should return the unconstrained resize since aspect ratio is invalid
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 125,
      });
    });

    test("very small rectangle", () => {
      const smallRect: CropRect = { x: 0, y: 0, width: 1, height: 1 };
      const currentPoint: Point = { x: 10, y: 10 };
      const cropSettings: CropSettings = {
        aspectRatio: "1x1",
        aspectRatioLocked: true,
      };

      const result = getResizedRect(cropBounds, cropSettings, smallRect, "bottom-right", currentPoint, startPoint);

      expect(result.width).toBe(11);
      expect(result.height).toBe(11);
    });
  });

  describe("with custom aspect ratio locked", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: true,
      customAspectRatio: "3x2",
    };

    test("bottom-right handle maintains 3:2 custom aspect ratio", () => {
      const currentPoint: Point = { x: 60, y: 40 }; // deltaX: 60, deltaY: 40
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // New width would be 260 (200 + 60)
      // For 3:2, height should be 260 / (3/2) = 173.33
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(260);
      expect(result.height).toBeCloseTo(173.33, 1);
    });

    test("top-left handle maintains custom aspect ratio and adjusts position", () => {
      const currentPoint: Point = { x: 30, y: 20 }; // deltaX: 30, deltaY: 20
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top-left", currentPoint, startPoint);

      // New width would be 170 (200 - 30)
      // For 3:2, height should be 170 / (3/2) = 113.33
      // Y position should adjust: y + originalHeight - newHeight = 100 + 100 - 113.33 = 86.67
      expect(result.x).toBe(130);
      expect(result.y).toBeCloseTo(86.67, 1);
      expect(result.width).toBe(170);
      expect(result.height).toBeCloseTo(113.33, 1);
    });

    test("right handle maintains custom aspect ratio", () => {
      const currentPoint: Point = { x: 90, y: 0 }; // deltaX: 90, deltaY: 0
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "right", currentPoint, startPoint);

      // New width would be 290 (200 + 90)
      // For 3:2, height should be 290 / (3/2) = 193.33
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
      expect(result.width).toBe(290);
      expect(result.height).toBeCloseTo(193.33, 1);
    });

    test("top handle adjusts width to maintain custom aspect ratio", () => {
      const currentPoint: Point = { x: 0, y: 20 }; // deltaX: 0, deltaY: 20
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "top", currentPoint, startPoint);

      // New height would be 80 (100 - 20)
      // For 3:2, width should be 80 * (3/2) = 120
      // X position should center: x - (newWidth - originalWidth) / 2 = 100 - (120 - 200) / 2 = 140
      expect(result.x).toBe(140);
      expect(result.y).toBe(120);
      expect(result.width).toBe(120);
      expect(result.height).toBe(80);
    });
  });

  describe("with custom aspect ratio but not locked", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: false,
      customAspectRatio: "4x3",
    };

    test("ignores custom aspect ratio when not locked", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should behave like free resize, ignoring the 4:3 custom ratio
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250, // width + deltaX (200 + 50)
        height: 125, // height + deltaY (100 + 25)
      });
    });
  });

  describe("with custom aspect ratio set to 'custom' but no customAspectRatio defined", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: true,
      customAspectRatio: undefined,
    };

    test("behaves like free resize when custom aspect ratio is undefined", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should behave like free resize since no customAspectRatio is defined
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 125,
      });
    });
  });

  describe("with invalid custom aspect ratio", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: true,
      customAspectRatio: "invalid",
    };

    test("behaves like free resize when custom aspect ratio is invalid", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should behave like free resize since customAspectRatio is invalid
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 125,
      });
    });
  });

  describe("with custom aspect ratio containing zero", () => {
    const cropSettings: CropSettings = {
      aspectRatio: "custom",
      aspectRatioLocked: true,
      customAspectRatio: "5x0",
    };

    test("behaves like free resize when custom aspect ratio has zero denominator", () => {
      const currentPoint: Point = { x: 50, y: 25 };
      const result = getResizedRect(cropBounds, cropSettings, baseRect, "bottom-right", currentPoint, startPoint);

      // Should behave like free resize since customAspectRatio has zero denominator
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 125,
      });
    });
  });
});