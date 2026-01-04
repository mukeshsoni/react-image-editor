import { describe, expect, test, vi } from "vitest";

import { renderCommittedImageToOffscreenCanvas } from "../export-download";

// Minimal ImageData polyfill (jsdom doesn't always expose it).
if (typeof globalThis.ImageData === "undefined") {
  Object.defineProperty(globalThis, "ImageData", {
    configurable: true,
    writable: true,
    value: class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(
        dataOrWidth: Uint8ClampedArray | number,
        width?: number,
        height?: number,
      ) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = width ?? 0;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
          return;
        }

        this.data = dataOrWidth;
        this.width = width ?? 0;
        this.height = height ?? 0;
      }
    },
  });
}

describe("export-download applies light adjustments", () => {
  test("applies adjustments when non-neutral", () => {
    const ctx = {
      fillStyle: "",
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(
        () =>
          new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1) as ImageData,
      ),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ctx,
    );

    const image = new Image();
    Object.defineProperty(image, "width", { value: 1 });
    Object.defineProperty(image, "height", { value: 1 });

    const offscreen = renderCommittedImageToOffscreenCanvas(image, 0, "white", {
      exposure: 1,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
    });

    expect(offscreen).toBeTruthy();
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
