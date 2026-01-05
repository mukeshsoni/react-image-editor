import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { createMockToneCurve } from "./test-helpers/mockToneCurve";

const mockSetLightAdjustment = vi.fn();
const mockResetLightAdjustments = vi.fn();

const mockLightAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};

vi.mock("../store/cropStore", () => ({
  useCropStore: () => ({
    resetAll: vi.fn(),
    cropSettings: {
      rotation: 0,
      constrainCrop: true,
    },
    setRotation: vi.fn(),
    resetRotation: vi.fn(),

    whiteBalance: {
      temperatureKelvin: 6500,
      tint: 0,
      preset: "custom",
    },
    setWhiteBalance: vi.fn(),
    setWhiteBalancePreset: vi.fn(),
    resetWhiteBalance: vi.fn(),

    lightAdjustments: mockLightAdjustments,
    setLightAdjustment: mockSetLightAdjustment,
    resetLightAdjustments: mockResetLightAdjustments,
    resetLightAdjustment: vi.fn(),

    colorAdjustments: {
      vibrance: 0,
      saturation: 0,
    },
    setColorAdjustment: vi.fn(),
    resetColorAdjustments: vi.fn(),
    resetColorAdjustment: vi.fn(),

    toneCurve: createMockToneCurve(),
    setToneCurveMode: vi.fn(),
    setToneCurveChannel: vi.fn(),
    setToneCurvePoints: vi.fn(),
    setToneCurveParametricRgb: vi.fn(),
    resetToneCurve: vi.fn(),

    getEdits: vi.fn(),
  }),
}));

vi.mock("../Cropper", () => ({
  Cropper: () => null,
  CropOptions: () => null,
}));

const mockResetZoom = vi.fn();
vi.mock("../use-canvas-zoom-pan", () => ({
  useCanvasZoomPan: () => ({
    zoomLevel: 1,
    offset: { x: 0, y: 0 },
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: mockResetZoom,
    listeners: {},
  }),
}));

describe("ReactImageEditor Basic panel (Tone)", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.clearAllMocks();

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
          getImageData: () => new ImageData(1, 1),
          putImageData: vi.fn(),
          fillStyle: "",
        }) as unknown as CanvasRenderingContext2D,
    );

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: class MockImage {
        width = 200;
        height = 150;
        crossOrigin: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
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

    // Make rendering deterministic.
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  test("renders Tone section with six sliders", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");

    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const toneSection = await screen.findByTestId("tone-section");

    const exposure = within(toneSection).getByLabelText("Exposure");
    const contrast = within(toneSection).getByLabelText("Contrast");
    const highlights = within(toneSection).getByLabelText("Highlights");
    const shadows = within(toneSection).getByLabelText("Shadows");
    const whites = within(toneSection).getByLabelText("Whites");
    const blacks = within(toneSection).getByLabelText("Blacks");

    expect(exposure).toBeTruthy();
    expect(contrast).toBeTruthy();
    expect(highlights).toBeTruthy();
    expect(shadows).toBeTruthy();
    expect(whites).toBeTruthy();
    expect(blacks).toBeTruthy();

    expect((exposure as HTMLInputElement).value).toBe("0");
    expect((contrast as HTMLInputElement).value).toBe("0");
    expect((highlights as HTMLInputElement).value).toBe("0");
    expect((shadows as HTMLInputElement).value).toBe("0");
    expect((whites as HTMLInputElement).value).toBe("0");
    expect((blacks as HTMLInputElement).value).toBe("0");
  });

  test("changing exposure slider updates store", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");

    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const toneSection = await screen.findByTestId("tone-section");
    const exposure = within(toneSection).getByLabelText("Exposure");

    fireEvent.change(exposure, { target: { value: "1" } });

    expect(mockSetLightAdjustment).toHaveBeenCalledWith("exposure", 1);
  });

  test("reset button calls resetLightAdjustments", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");

    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const toneSection = await screen.findByTestId("tone-section");
    const resetButton = within(toneSection).getByRole("button", {
      name: "Reset",
    });

    fireEvent.click(resetButton);

    expect(mockResetLightAdjustments).toHaveBeenCalled();
  });
});

describe("ReactImageEditor render integration", () => {
  test("applies light adjustments during render", async () => {
    vi.resetModules();

    const originalImageData = globalThis.ImageData;

    // Ensure it is referenced even if the environment provides ImageData.
    void originalImageData;

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

    vi.doMock("../lib/light-adjustments", () => ({
      applyLightAdjustmentsToRgbaBytes: applySpy,
    }));

     const nonNeutralStore = {
       resetAll: vi.fn(),
       cropSettings: { rotation: 0, constrainCrop: true },
       setRotation: vi.fn(),
       resetRotation: vi.fn(),
       whiteBalance: {
         temperatureKelvin: 6500,
         tint: 0,
         preset: "custom",
       },
       setWhiteBalance: vi.fn(),
       setWhiteBalancePreset: vi.fn(),
       resetWhiteBalance: vi.fn(),
       lightAdjustments: {
         exposure: 1,
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

    const mockResetZoom = vi.fn();
    vi.doMock("../use-canvas-zoom-pan", () => ({
      useCanvasZoomPan: () => ({
        zoomLevel: 1,
        offset: { x: 0, y: 0 },
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetZoom: mockResetZoom,
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
          getImageData: () => new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1),
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
