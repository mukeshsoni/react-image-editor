import React from "react";
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
    const zoomStep = 0.2;

    const { result } = renderHook(() =>
      useCanvasZoomPan(canvasRef, canvasRef, { zoomStep }),
    );

    const initialZoom = result.current.zoomLevel;

    act(() => {
      result.current.zoomIn();
    });

    // Zoom should increase by 10%
    expect(result.current.zoomLevel).toBeCloseTo(initialZoom * (1 + zoomStep));
  });
  test("panning with mouse updates offset correctly", () => {
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
    const imageRef = {
      current: {
        width: 1800,
        height: 1600,
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
        }),
      },
    };

    const { result } = renderHook(() => useCanvasZoomPan(canvasRef, imageRef));

    const initialOffset = { ...result.current.offset };

    // Simulate mouse down
    act(() => {
      result.current.listeners.onMouseDown({
        pageX: 100,
        pageY: 100,
      } as React.MouseEvent<HTMLCanvasElement>);
    });

    // Simulate mouse move
    act(() => {
      result.current.listeners.onMouseMove({
        pageX: 50, // Moved 50px right
        pageY: 20, // Moved 20px down
      } as React.MouseEvent<HTMLCanvasElement>);
    });

    // Check if offset changed by the amount mouse moved
    expect(result.current.offset.x).toBe(initialOffset.x - 50);
    expect(result.current.offset.y).toBe(initialOffset.y - 80);
  });
});
