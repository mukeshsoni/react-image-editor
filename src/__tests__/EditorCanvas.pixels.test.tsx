import { createRef } from "react";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { EditorCanvas } from "@/editor/EditorCanvas";
import { useCropStore } from "@/store/cropStore";

import { installPixelCanvas, pixelAt } from "./test-helpers/pixelCanvas";

describe("EditorCanvas pixels", () => {
  let createImage: ReturnType<typeof installPixelCanvas>["createImage"];

  beforeEach(() => {
    ({ createImage } = installPixelCanvas());
    useCropStore.getState().clearCommittedCrop();
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("replaces cached pixels when a same-size image is loaded", () => {
    const imageRef = {
      current: createImage(20, 20, (ctx) => {
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, 20, 20);
      }),
    };
    const canvasRef = createRef<HTMLCanvasElement>();
    const props = {
      canvasRef,
      imageRef,
      zoomLevel: 1,
      rotation: 0,
      listeners: {},
      isPickingWhiteBalance: false,
      onPickWhiteBalance: () => {},
      isPickingPointColor: false,
      onPickPointColor: () => {},
    };
    const { rerender } = render(<EditorCanvas {...props} offset={{ x: 0, y: 0 }} />);
    expect(pixelAt(canvasRef.current!, 10, 10)).toEqual([255, 0, 0, 255]);

    imageRef.current = createImage(20, 20, (ctx) => {
      ctx.fillStyle = "blue";
      ctx.fillRect(0, 0, 20, 20);
    });
    // Loading resets the camera to the same coordinates, with a new offset object.
    rerender(<EditorCanvas {...props} offset={{ x: 0, y: 0 }} />);

    expect(pixelAt(canvasRef.current!, 10, 10)).toEqual([0, 0, 255, 255]);
  });
});
