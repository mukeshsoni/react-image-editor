import { describe, expect, test } from "vitest";

import { computeMobileTrayNudge } from "@/editor/mobileTrayNudge";

describe("computeMobileTrayNudge", () => {
  test("nudges up just enough to clear tray when headroom allows", () => {
    const result = computeMobileTrayNudge({
      offsetY: 120,
      zoomLevel: 1,
      imageHeight: 400,
      viewportHeight: 700,
      trayHeight: 250,
      topMargin: 20,
    });

    // trayTopY = 450; imageBottom=520; needs 70px shift; allowed 100px shift.
    expect(result.appliedShiftUp).toBe(70);
    expect(result.nextOffsetY).toBe(50);
    expect(result.overlapPx).toBe(0);
  });

  test("caps nudge at top margin when headroom is insufficient", () => {
    const result = computeMobileTrayNudge({
      offsetY: 30,
      zoomLevel: 1,
      imageHeight: 500,
      viewportHeight: 700,
      trayHeight: 300,
      topMargin: 20,
    });

    // trayTopY = 400; imageBottom=530; needs 130px shift; allowed only 10px.
    expect(result.appliedShiftUp).toBe(10);
    expect(result.nextOffsetY).toBe(20);
    expect(result.overlapPx).toBe(120);
  });

  test("no tray yields zero overlap and no shift", () => {
    const result = computeMobileTrayNudge({
      offsetY: 80,
      zoomLevel: 1,
      imageHeight: 300,
      viewportHeight: 700,
      trayHeight: 0,
      topMargin: 20,
    });

    expect(result.appliedShiftUp).toBe(0);
    expect(result.nextOffsetY).toBe(80);
    expect(result.overlapPx).toBe(0);
  });
});
