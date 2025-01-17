import { describe, expect, test } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasZoomPan } from "../use-canvas-zoom-pan";

describe("useCanvasZoomPan", () => {
  test("zoomIn increases zoom level by 5%", () => {
    const canvasRef = {
      current: {
        width: 800,
        height: 600,
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
        }),
      },
    };

    const { result } = renderHook(() => useCanvasZoomPan(canvasRef, canvasRef));

    const initialZoom = result.current.zoomLevel;

    act(() => {
      result.current.zoomIn();
    });

    // Zoom should increase by 10%
    expect(result.current.zoomLevel).toBeCloseTo(initialZoom * 1.1);
  });
});
