import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { createMockToneCurve } from "./test-helpers/mockToneCurve";

import { ReactImageEditor } from "../ReactImageEditor";

const hoisted = vi.hoisted(() => ({
  mockResetAll: vi.fn(),
  mockSetRotation: vi.fn(),
  mockResetRotation: vi.fn(),
  rotation: 30,
}));

const cropRect = { x: 20, y: 30, width: 100, height: 80 };

vi.mock("../store/cropStore", async () => {
  const actual = await vi.importActual<typeof import("../store/cropStore")>(
    "../store/cropStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    ...actual,
    useCropStore: createMockZustandHook({
      cropSettings: {
        rotation: hoisted.rotation,
        constrainCrop: true,
      },
      setRotation: hoisted.mockSetRotation,
      resetRotation: hoisted.mockResetRotation,
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
  CropOptions: ({
    onReset,
    onApply,
  }: {
    onReset: () => void;
    onApply: (rect: typeof cropRect) => void | Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={onReset}>
        Reset
      </button>
      <button type="button" onClick={() => onApply(cropRect)}>
        Apply
      </button>
    </div>
  ),
}));

const mockResetZoom = vi.fn();
vi.mock("../use-canvas-zoom-pan", () => ({
  useCanvasZoomPan: () => ({
    zoomLevel: 2,
    offset: { x: 50, y: 70 },
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: mockResetZoom,
    listeners: {},
  }),
}));

describe("ReactImageEditor apply crop + rotation mapping", () => {
  let createdCanvases: HTMLCanvasElement[];

  const drawImage = vi.fn();
  const translate = vi.fn();
  const rotate = vi.fn();
  const save = vi.fn();
  const restore = vi.fn();
  const clearRect = vi.fn();

  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.clearAllMocks();
    createdCanvases = [];

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

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Make <canvas>.getContext() return a spy-able 2d context.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage,
          translate,
          rotate,
          save,
          restore,
          clearRect,
        }) as unknown as CanvasRenderingContext2D,
    );

    // Ensure canvas ->Blob yields a Blob.
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
      cb(new Blob(["x"], { type: "image/png" }));
    });

    const originalCreateElement = document.createElement.bind(document);

    // Track created canvases (React creates the main one; apply creates an offscreen one).
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);

      if (tagName.toLowerCase() === "canvas") {
        createdCanvases.push(el as HTMLCanvasElement);
      }

      return el;
    });

    // Mock Image loading: trigger onload after src set.
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

    // Disable preview rendering so rotate assertions stay apply-specific.
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  test("bakes crop with correct offset, size, and rotation", async () => {
    const { getByText } = render(
      <ReactImageEditor imageSrc="data:image/png;base64,AAA=" />,
    );

    await waitFor(() => {
      expect(mockResetZoom).toHaveBeenCalled();
    });

    // Enable crop mode (shows CropOptions with Apply).
    fireEvent.click(getByText("Crop"));

    // Apply crop to trigger offscreen baking.
    fireEvent.click(getByText("Apply"));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const offscreenCanvas = createdCanvases.at(-1);
    expect(offscreenCanvas).toBeTruthy();

    // output size = cropRect / zoomLevel
    expect(offscreenCanvas?.width).toBe(50);
    expect(offscreenCanvas?.height).toBe(40);

    // bakedOffset = (offset - cropRect) / zoomLevel
    // offset = {50,70}, cropRect = {20,30}, zoomLevel=2
    // bakedOffset = {15,20}
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(Object),
      15,
      20,
      200,
      150,
    );

    // rotation of 30° applied during baking.
    expect(rotate).toHaveBeenCalledWith((30 * Math.PI) / 180);
  });
});
