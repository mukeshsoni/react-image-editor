import { describe, expect, test } from "vitest";

import { applyHomography, getKeystoneHomography } from "@/geometry/perspective";

describe("perspective", () => {
  test("identity-like params keeps origin stable", () => {
    const matrix = getKeystoneHomography({ vertical: 0, horizontal: 0 });
    const p = applyHomography(matrix, 0, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  test("non-zero params produce finite mapping", () => {
    const matrix = getKeystoneHomography({ vertical: 50, horizontal: -25 });
    const p = applyHomography(matrix, 100, 50);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
