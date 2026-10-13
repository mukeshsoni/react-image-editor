import type { MouseEvent } from "react";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { useCanvasZoomPan } from "@/use-canvas-zoom-pan";

afterEach(cleanup);

describe("crop camera bounds", () => {
  test("fits and pans using the committed output dimensions", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const image = document.createElement("img");
    image.width = 2000;
    image.height = 1600;
    let cropSize: { width: number; height: number } | null = null;
    const canvasRef = { current: canvas };
    const imageRef = { current: image };
    const { result } = renderHook(() =>
      useCanvasZoomPan(canvasRef, imageRef, { getImageSize: () => cropSize }),
    );
    expect(result.current.zoomLevel).toBe(0.375);

    cropSize = { width: 500, height: 400 };
    act(() => result.current.resetZoom());
    expect(result.current.zoomLevel).toBe(1);
    expect(result.current.offset).toEqual({ x: 150, y: 100 });

    act(() => result.current.setCamera(2, { x: 0, y: 0 }));
    act(() => result.current.listeners.onMouseDown({ pageX: 0, pageY: 0 } as MouseEvent<HTMLCanvasElement>));
    act(() => result.current.listeners.onMouseMove({ pageX: -1000, pageY: -1000 } as MouseEvent<HTMLCanvasElement>));
    expect(result.current.offset).toEqual({ x: -200, y: -200 });

    cropSize = null;
    act(() => result.current.resetZoom());
    expect(result.current.zoomLevel).toBe(0.375);
  });
});
