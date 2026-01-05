import { cleanup, render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

describe("ReactImageEditor render integration (white balance)", () => {
  test("applies white balance during render", async () => {
    vi.resetModules();

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

    const applySpy = vi.fn((input: Uint8ClampedArray, output: Uint8ClampedArray) => {
      output.set(input);
    });

    vi.doMock("../lib/white-balance", async () => {
      const actual = await vi.importActual<typeof import("../lib/white-balance")>(
        "../lib/white-balance",
      );

      return {
        ...actual,
        applyWhiteBalanceToRgbaBytes: applySpy,
      };
    });

    const nonNeutralStore = {
      resetAll: vi.fn(),
      cropSettings: { rotation: 0, constrainCrop: true },
      setRotation: vi.fn(),
      resetRotation: vi.fn(),
      whiteBalance: {
        temperatureKelvin: 5500,
        tint: 0,
        preset: "custom",
      },
      setWhiteBalance: vi.fn(),
      setWhiteBalancePreset: vi.fn(),
      resetWhiteBalance: vi.fn(),
      lightAdjustments: {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
      },
      setLightAdjustment: vi.fn(),
      resetLightAdjustments: vi.fn(),
      resetLightAdjustment: vi.fn(),

      colorAdjustments: {
        vibrance: 0,
        saturation: 0,
      },
      setColorAdjustment: vi.fn(),
      resetColorAdjustments: vi.fn(),
      resetColorAdjustment: vi.fn(),

      getEdits: vi.fn(),
    };

    vi.doMock("../store/cropStore", () => ({
      useCropStore: () => nonNeutralStore,
    }));

    vi.doMock("../Cropper", () => ({
      Cropper: () => null,
      CropOptions: () => null,
    }));

    vi.doMock("../use-canvas-zoom-pan", () => ({
      useCanvasZoomPan: () => ({
        zoomLevel: 1,
        offset: { x: 0, y: 0 },
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetZoom: vi.fn(),
        listeners: {},
      }),
    }));

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          getImageData: () =>
            new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1),
          putImageData: vi.fn(),
          fillStyle: "",
        }) as unknown as CanvasRenderingContext2D,
    );

    const originalImage = globalThis.Image;
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: class MockImage {
        width = 1;
        height = 1;
        crossOrigin: string | null = null;
        onload: (() => void) | null = null;
        private _src = "";

        get src() {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
          queueMicrotask(() => {
            this.onload?.();
          });
        }
      },
    });

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { ReactImageEditor } = await import("../ReactImageEditor");
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalled();
    });

    cleanup();
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });
});
