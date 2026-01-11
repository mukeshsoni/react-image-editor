import { describe, expect, test } from "vitest";

import { estimateStraightenDegreesFromLuminance } from "@/geometry/auto-straighten";

function makeEdgeImage(width: number, height: number, edgeDegrees: number): Uint8Array {
  const out = new Uint8Array(width * height);

  const radians = (edgeDegrees * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);

  // Create a binary half-plane separated by a line with direction `edgeDegrees`.
  // This yields a strong, long edge for the gradient-based estimator.
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = (x - cx) * dx + (y - cy) * dy;
      out[y * width + x] = t > 0 ? 240 : 10;
    }
  }

  return out;
}

describe("auto-straighten", () => {
  test("estimates near-zero for horizontal edge", () => {
    const grays = makeEdgeImage(220, 160, 0);
    const result = estimateStraightenDegreesFromLuminance(grays, 220, 160);
    expect(Math.abs(result.degrees)).toBeLessThan(3);
  });

  test("returns near-neutral when only one edge exists", () => {
    const grays = makeEdgeImage(240, 180, 12);
    const result = estimateStraightenDegreesFromLuminance(grays, 240, 180);

    // A single step edge is often ambiguous for horizon detection.
    expect(Math.abs(result.degrees)).toBeLessThan(5);
  });
});
