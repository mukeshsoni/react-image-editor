import { describe, expect, test } from "vitest";

import { centeredCrop, rotate, trayDisplacement, visibleView } from "../engine/geometry";
import { correctedCoordinate, sourceCoordinate } from "../engine/optics";
import { initialEdits } from "../model/settings";

describe("image-space transforms", () => {
  test("all constrained crop corners stay inside the original at every supported angle", () => {
    const size = { width: 640, height: 480 };
    for (const rotation of [-45, -30, -1, 0, 1, 30, 45]) for (const aspectRatio of ["1x2", "3x4", "1x1", "4x3", "16x9"]) {
      const rect = centeredCrop(size, { aspectRatio, rotation, constrainCrop: true, aspectRatioLocked: false });
      for (const x of [rect.x, rect.x + rect.width]) for (const y of [rect.y, rect.y + rect.height]) {
        const point = rotate({ x, y }, size, -rotation);
        expect(point.x).toBeGreaterThanOrEqual(-0.000001);
        expect(point.x).toBeLessThanOrEqual(640.000001);
        expect(point.y).toBeGreaterThanOrEqual(-0.000001);
        expect(point.y).toBeLessThanOrEqual(480.000001);
      }
    }
  });

  test("very narrow and wide ratios still fit within the image", () => {
    for (const customAspectRatio of ["10000000000x1", "1x10000000000"]) {
      const rect = centeredCrop({ width: 320, height: 240 }, { aspectRatio: "custom", customAspectRatio, aspectRatioLocked: false });
      expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
      expect(rect.width).toBeLessThanOrEqual(320); expect(rect.height).toBeLessThanOrEqual(240);
    }
  });

  test("source and pin coordinates agree after combined perspective and lens corrections", () => {
    const geometry = initialEdits().geometryOptics;
    geometry.perspective = { vertical: 25, horizontal: -15, aspect: 12 };
    geometry.lensCorrections.distortion = 30;
    for (const original of [{ x: 80, y: 70 }, { x: 160, y: 120 }, { x: 240, y: 180 }]) {
      const displayed = correctedCoordinate(original, { width: 320, height: 240 }, geometry);
      const sampled = sourceCoordinate(displayed, { width: 320, height: 240 }, geometry);
      expect(sampled.x).toBeCloseTo(original.x, 1); expect(sampled.y).toBeCloseTo(original.y, 1);
    }
  });

  test("tray displacement never mutates the saved camera", () => {
    const camera = { scale: 1, origin: { x: 35, y: 200 } };
    const original = structuredClone(camera);
    const frame = { width: 320, height: 240 };
    expect(visibleView(camera, trayDisplacement(camera, frame, { width: 390, height: 600, coveredHeight: 300 })).origin.y).toBeLessThan(200);
    expect(visibleView(camera, trayDisplacement(camera, frame, { width: 390, height: 600, coveredHeight: 0 }))).toEqual(original);
    expect(camera).toEqual(original);
  });
});
