import type { MouseEvent as ReactMouseEvent } from "react";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useCanvasZoomPan } from "@/use-canvas-zoom-pan";
import type { ZoomPanOptions } from "@/use-canvas-zoom-pan";

function setup(options: Partial<ZoomPanOptions> = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  document.body.append(canvas);
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));
  const image = document.createElement("img");
  image.width = 800;
  image.height = 600;
  const canvasRef = { current: canvas };
  const imageRef = { current: image };
  const hook = renderHook(() => useCanvasZoomPan(canvasRef, imageRef, options));
  return { ...hook, canvas };
}

function finishAnimation() {
  act(() => vi.advanceTimersByTime(400));
}

function touch(canvas: HTMLCanvasElement, type: string, distance: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: [{ pageX: 100, pageY: 100 }, { pageX: 100 + distance, pageY: 100 }],
  });
  act(() => canvas.dispatchEvent(event));
}

describe("useCanvasZoomPan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) =>
      setTimeout(() => callback(performance.now()), 16) as unknown as number,
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => clearTimeout(id));
  });

  afterEach(() => {
    cleanup();
    document.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("zoomIn honors the configured step", () => {
    const { result } = setup({ zoomStep: 0.2 });
    act(() => result.current.zoomIn());
    finishAnimation();
    expect(result.current.zoomLevel).toBeCloseTo(1.2);
  });

  test("panning updates the camera within image bounds", () => {
    const { result } = setup();
    act(() => result.current.setCamera(2, { x: 0, y: 0 }));
    act(() => result.current.listeners.onMouseDown({ pageX: 100, pageY: 100 } as ReactMouseEvent<HTMLCanvasElement>));
    act(() => vi.advanceTimersByTime(16));
    act(() => result.current.listeners.onMouseMove({ pageX: 50, pageY: 20 } as ReactMouseEvent<HTMLCanvasElement>));
    expect(result.current.offset).toEqual({ x: -50, y: -80 });
  });

  test.each([50, 100, 10000])("keeps wheel zoom positive for deltaY=%s", (deltaY) => {
    const { result, canvas } = setup({ enableWheel: true, minZoom: 0.2 });
    act(() => canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY, clientX: 400, clientY: 300, bubbles: true, cancelable: true,
    })));
    finishAnimation();
    expect(result.current.zoomLevel).toBe(0.2);
    expect(Number.isFinite(result.current.offset.x)).toBe(true);
    expect(Number.isFinite(result.current.offset.y)).toBe(true);
  });

  test("limits large wheel zoom-in events", () => {
    const { result, canvas } = setup({ enableWheel: true, maxZoom: 3 });
    act(() => canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY: -10000, clientX: 400, clientY: 300, bubbles: true,
    })));
    finishAnimation();
    expect(result.current.zoomLevel).toBe(3);
  });

  test("clamps both ends of a pinch gesture", () => {
    const { result, canvas } = setup({ minZoom: 0.25, maxZoom: 3 });
    touch(canvas, "touchstart", 100);
    touch(canvas, "touchmove", 0);
    expect(result.current.zoomLevel).toBe(0.25);
    touch(canvas, "touchstart", 1);
    touch(canvas, "touchmove", 10000);
    expect(result.current.zoomLevel).toBe(3);
  });

  test("double-click zoom respects the maximum", () => {
    const { result, canvas } = setup({ maxZoom: 1.5 });
    act(() => canvas.dispatchEvent(new MouseEvent("dblclick", {
      clientX: 400, clientY: 300, bubbles: true,
    })));
    finishAnimation();
    expect(result.current.zoomLevel).toBe(1.5);
  });
});
