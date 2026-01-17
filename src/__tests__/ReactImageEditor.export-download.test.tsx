import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/select", () => {
  return {
    Select: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
      <select
        data-testid="export-format"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
      </select>
    ),
    SelectContent: () => null,
    SelectItem: () => null,
    SelectTrigger: () => null,
    SelectValue: () => null,
  };
});

import { createMockToneCurve } from "./test-helpers/mockToneCurve";

import { ReactImageEditor } from "../ReactImageEditor";

const hoisted = vi.hoisted(() => ({
  mockResetAll: vi.fn(),
  mockSetRotation: vi.fn(),
  mockResetRotation: vi.fn(),
}));

vi.mock("../store/cropStore", async () => {
  const actual = await vi.importActual<typeof import("../store/cropStore")>(
    "../store/cropStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    ...actual,
    useCropStore: createMockZustandHook({
      cropRect: { x: 0, y: 0, width: 0, height: 0 },
      cropBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      cropCommitted: false,
      cropCommit: null,
      cropSettings: {
        aspectRatio: "original",
        aspectRatioLocked: false,
        rotation: 0,
        constrainCrop: true,
      },
      clearCommittedCrop: vi.fn(),
      commitCrop: vi.fn(),
      initializeCropRect: vi.fn(),
      moveCropRect: vi.fn(),
      resizeCropRect: vi.fn(),
      setCropRect: vi.fn(),
      updateCropRect: vi.fn(),
      setCropSettings: vi.fn(),
      updateCropSettings: vi.fn(),
      handleCropSettingsChange: vi.fn(),
      resetAll: vi.fn(),
      resetCropRect: vi.fn(),
      resetCropSettings: vi.fn(),
      setRotation: hoisted.mockSetRotation,
      resetRotation: hoisted.mockResetRotation,
      setConstrainCrop: vi.fn(),
    }),
  };
});

vi.mock("../store/editorActions", () => ({
  useResetAll: () => hoisted.mockResetAll,
}));

vi.mock("../store/whiteBalanceStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useWhiteBalanceStore: createMockZustandHook({
      whiteBalance: {
        temperatureKelvin: 6500,
        tint: 0,
        preset: "custom",
      },
      setWhiteBalance: vi.fn(),
      setWhiteBalancePreset: vi.fn(),
      resetWhiteBalance: vi.fn(),
    }),
  };
});

vi.mock("../store/lightStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useLightStore: createMockZustandHook({
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
    }),
  };
});

vi.mock("../store/colorStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useColorStore: createMockZustandHook({
      colorAdjustments: {
        vibrance: 0,
        saturation: 0,
        mixerHsl: {
          red: { hue: 0, saturation: 0, luminance: 0 },
          orange: { hue: 0, saturation: 0, luminance: 0 },
          yellow: { hue: 0, saturation: 0, luminance: 0 },
          green: { hue: 0, saturation: 0, luminance: 0 },
          aqua: { hue: 0, saturation: 0, luminance: 0 },
          blue: { hue: 0, saturation: 0, luminance: 0 },
          purple: { hue: 0, saturation: 0, luminance: 0 },
          magenta: { hue: 0, saturation: 0, luminance: 0 },
        },
        pointColor: {
          hue: null,
          range: 50,
          hueShift: 0,
          saturationShift: 0,
          luminanceShift: 0,
        },
      },
      setColorAdjustment: vi.fn(),
      resetColorAdjustments: vi.fn(),
      resetColorAdjustment: vi.fn(),
    }),
  };
});

vi.mock("../store/toneCurveStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useToneCurveStore: createMockZustandHook({
      toneCurve: createMockToneCurve(),
      setToneCurveMode: vi.fn(),
      setToneCurveChannel: vi.fn(),
      setToneCurvePoints: vi.fn(),
      setToneCurveParametricRgb: vi.fn(),
      resetToneCurve: vi.fn(),
    }),
  };
});

vi.mock("../Cropper", () => ({
  Cropper: () => null,
  CropOptions: () => null,
}));

vi.mock("../editor/panels/details.panel", () => ({
  default: {
    id: "details",
    order: 40,
    title: "Details",
    groupId: "advanced",
    Component: () => null,
  },
}));

const mockResetZoom = vi.fn();
vi.mock("../use-canvas-zoom-pan", async () => {
  const actual = await vi.importActual<typeof import("../use-canvas-zoom-pan")>(
    "../use-canvas-zoom-pan",
  );

  return {
    ...actual,
    useCanvasZoomPan: () => ({
      zoomLevel: 1,
      offset: { x: 0, y: 0 },
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: mockResetZoom,
      setCamera: vi.fn(),
      listeners: {},
    }),
  };
});

describe("ReactImageEditor export/download", () => {
  const originalImage = globalThis.Image;

  const drawImage = vi.fn();
  const translate = vi.fn();
  const rotate = vi.fn();
  const save = vi.fn();
  const restore = vi.fn();
  const clearRect = vi.fn();
  const fillRect = vi.fn();
  const getImageData = vi.fn(
    () => new ImageData(new Uint8ClampedArray(800 * 600 * 4), 800, 600),
  );
  const putImageData = vi.fn();

  let toBlobSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

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

    if (!("hasPointerCapture" in Element.prototype)) {
      Object.defineProperty(Element.prototype, "hasPointerCapture", {
        configurable: true,
        writable: true,
        value: () => false,
      });
    }
    if (!("setPointerCapture" in Element.prototype)) {
      Object.defineProperty(Element.prototype, "setPointerCapture", {
        configurable: true,
        writable: true,
        value: () => {},
      });
    }
    if (!("releasePointerCapture" in Element.prototype)) {
      Object.defineProperty(Element.prototype, "releasePointerCapture", {
        configurable: true,
        writable: true,
        value: () => {},
      });
    }

    if (!("createObjectURL" in URL)) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: () => "",
      });
    }
    if (!("revokeObjectURL" in URL)) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: () => {},
      });
    }

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

     vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
       () =>
         ({
           drawImage,
           translate,
           rotate,
           save,
           restore,
           clearRect,
           fillRect,
           getImageData,
           putImageData,
           fillStyle: "",
         }) as unknown as CanvasRenderingContext2D,
     );


    toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb, type, quality) => {
        void quality;
        cb(new Blob(["x"], { type: type ?? "image/png" }));
      });

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

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  test("downloads PNG by default", async () => {
    const { getByRole } = render(
      <ReactImageEditor imageSrc="data:image/png;base64,AAA=" />,
    );

    await waitFor(() => {
      expect(mockResetZoom).toHaveBeenCalled();
    });

    fireEvent.click(getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(toBlobSpy).toHaveBeenCalled();
    });

    const [callback, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
    expect(typeof callback).toBe("function");
    expect(mimeType).toBe("image/png");
    expect(quality).toBeUndefined();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();
  });

  test("downloads JPEG with selected quality", async () => {
    const { getByRole, getByTestId } = render(
      <ReactImageEditor imageSrc="data:image/png;base64,AAA=" />,
    );

    await waitFor(() => {
      expect(mockResetZoom).toHaveBeenCalled();
    });

    // Radix Select can be flaky in jsdom; force state via change.
    const formatTrigger = getByTestId("export-format");
    fireEvent.change(formatTrigger, { target: { value: "jpeg" } });

    // Slider should now render.
    const qualitySlider = await waitFor(() => getByTestId("jpeg-quality"));
    fireEvent.change(qualitySlider, { target: { value: "80" } });
    fireEvent.pointerUp(qualitySlider);

    fireEvent.click(getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(toBlobSpy).toHaveBeenCalled();
    });

    const [callback, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
    expect(typeof callback).toBe("function");
    expect(mimeType).toBe("image/jpeg");
    expect(quality).toBeCloseTo(0.8);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();
  });

  test("disables download in crop mode", async () => {
    const { getByRole, getByText } = render(
      <ReactImageEditor imageSrc="data:image/png;base64,AAA=" />,
    );

    await waitFor(() => {
      expect(mockResetZoom).toHaveBeenCalled();
    });

    fireEvent.click(getByRole("button", { name: "Crop" }));

    expect(getByText("Apply crop to download")).toBeTruthy();

    const downloadButton = getByRole("button", { name: "Download" });
    expect(downloadButton.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(downloadButton);
    expect(toBlobSpy).not.toHaveBeenCalled();
  });
});
