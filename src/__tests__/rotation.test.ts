import { describe, test, expect } from "vitest";
import { getMaxInnerAxisAlignedRectSize } from "@/geometry/rotation";

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

describe("getMaxInnerAxisAlignedRectSize", () => {
  test("returns original size at 0°", () => {
    expect(getMaxInnerAxisAlignedRectSize(200, 100, 0)).toEqual({
      width: 200,
      height: 100,
    });
  });

  test("is symmetric for +/- angles", () => {
    expect(getMaxInnerAxisAlignedRectSize(200, 100, 12.5)).toEqual(
      getMaxInnerAxisAlignedRectSize(200, 100, -12.5),
    );
  });

  test("square at 45° becomes 1/sqrt(2) scaled", () => {
    const result = getMaxInnerAxisAlignedRectSize(100, 100, 45);
    const expected = 100 / Math.sqrt(2);

    expect(result.width).toBeCloseTo(expected, 4);
    expect(result.height).toBeCloseTo(expected, 4);
  });

  test("result fits inside the rotated rectangle", () => {
    const width = 200;
    const height = 100;
    const rotationDegrees = 25;

    const { width: innerWidth, height: innerHeight } =
      getMaxInnerAxisAlignedRectSize(width, height, rotationDegrees);

    // Validate feasibility with the same corner-inside-rotated-rect inequalities.
    const radians = Math.abs(degreesToRadians(rotationDegrees));
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const x = innerWidth / 2;
    const y = innerHeight / 2;

    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);

    const epsilon = 1e-6;
    expect(x * cos + y * sin).toBeLessThanOrEqual(halfWidth + epsilon);
    expect(x * sin + y * cos).toBeLessThanOrEqual(halfHeight + epsilon);
  });
});
