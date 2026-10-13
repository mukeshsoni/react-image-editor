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

  test("clips committed crops and follows the zoom/pan camera", () => {
    const imageRef = {
      current: createImage(80, 20, (ctx) => {
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, 80, 20);
        ctx.fillStyle = "blue";
        ctx.fillRect(20, 0, 20, 20);
      }),
    };
    useCropStore.getState().commitCrop({
      outputWidth: 20,
      outputHeight: 20,
      bakedOffset: { x: -20, y: 0 },
      rotationDegrees: 0,
    });
    const canvasRef = createRef<HTMLCanvasElement>();
    const props = {
      canvasRef,
      imageRef,
      rotation: 0,
      listeners: {},
      isPickingWhiteBalance: false,
      onPickWhiteBalance: () => {},
      isPickingPointColor: false,
      onPickPointColor: () => {},
    };
    const { rerender } = render(
      <EditorCanvas {...props} zoomLevel={1} offset={{ x: 10, y: 10 }} />,
    );
    expect(pixelAt(canvasRef.current!, 15, 15)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvasRef.current!, 35, 15)).toEqual([0, 0, 0, 0]);

    rerender(<EditorCanvas {...props} zoomLevel={2} offset={{ x: 30, y: 10 }} />);
    expect(pixelAt(canvasRef.current!, 65, 15)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvasRef.current!, 15, 15)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(canvasRef.current!, 75, 15)).toEqual([0, 0, 0, 0]);

    rerender(<EditorCanvas {...props} zoomLevel={2} offset={{ x: 60, y: 10 }} />);
    expect(pixelAt(canvasRef.current!, 95, 15)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvasRef.current!, 35, 15)).toEqual([0, 0, 0, 0]);

    // Re-entering crop mode reveals the original for a non-destructive re-crop.
    rerender(<EditorCanvas {...props} cropMode zoomLevel={1} offset={{ x: 0, y: 0 }} />);
    expect(pixelAt(canvasRef.current!, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvasRef.current!, 25, 5)).toEqual([0, 0, 255, 255]);
  });
});
