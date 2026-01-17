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

const mockSetColorAdjustment = vi.fn();
const mockResetColorAdjustments = vi.fn();
const mockSetMixerBandAdjustment = vi.fn();
const mockResetMixerBand = vi.fn();
const mockResetMixer = vi.fn();
const mockSetPointColor = vi.fn();
const mockResetPointColor = vi.fn();

const mockStore = {
  resetAll: vi.fn(),
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
  resetCropRect: vi.fn(),
  resetCropSettings: vi.fn(),
  setRotation: vi.fn(),
  resetRotation: vi.fn(),
  setConstrainCrop: vi.fn(),

  whiteBalance: {
    temperatureKelvin: 6500,
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
  setColorAdjustment: mockSetColorAdjustment,
  resetColorAdjustments: mockResetColorAdjustments,
  resetColorAdjustment: vi.fn(),
  setMixerBandAdjustment: mockSetMixerBandAdjustment,
  resetMixerBand: mockResetMixerBand,
  resetMixer: mockResetMixer,
  setPointColor: mockSetPointColor,
  resetPointColor: mockResetPointColor,

  toneCurve: createMockToneCurve(),
  setToneCurveMode: vi.fn(),
  setToneCurveChannel: vi.fn(),
  setToneCurvePoints: vi.fn(),
  setToneCurveParametricRgb: vi.fn(),
  resetToneCurve: vi.fn(),

  getEdits: vi.fn(),
};

vi.mock("../store/cropStore", async () => {
  const actual = await vi.importActual<typeof import("../store/cropStore")>(
    "../store/cropStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    ...actual,
    useCropStore: createMockZustandHook(mockStore),
  };
});

vi.mock("../store/editorActions", () => ({
  useResetAll: () => mockStore.resetAll,
}));

vi.mock("../store/whiteBalanceStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useWhiteBalanceStore: createMockZustandHook({
      whiteBalance: mockStore.whiteBalance,
      setWhiteBalance: mockStore.setWhiteBalance,
      setWhiteBalancePreset: mockStore.setWhiteBalancePreset,
      resetWhiteBalance: mockStore.resetWhiteBalance,
    }),
  };
});

vi.mock("../store/lightStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useLightStore: createMockZustandHook({
      lightAdjustments: mockStore.lightAdjustments,
      setLightAdjustment: mockStore.setLightAdjustment,
      resetLightAdjustments: mockStore.resetLightAdjustments,
      resetLightAdjustment: mockStore.resetLightAdjustment,
    }),
  };
});

vi.mock("../store/colorStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useColorStore: createMockZustandHook({
      colorAdjustments: mockStore.colorAdjustments,
      setColorAdjustment: mockStore.setColorAdjustment,
      resetColorAdjustments: mockStore.resetColorAdjustments,
      resetColorAdjustment: mockStore.resetColorAdjustment,
      setMixerBandAdjustment: mockStore.setMixerBandAdjustment,
      resetMixerBand: mockStore.resetMixerBand,
      resetMixer: mockStore.resetMixer,
      setPointColor: mockStore.setPointColor,
      resetPointColor: mockStore.resetPointColor,
    }),
  };
});

vi.mock("../store/toneCurveStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useToneCurveStore: createMockZustandHook({
      toneCurve: mockStore.toneCurve,
      setToneCurveMode: mockStore.setToneCurveMode,
      setToneCurveChannel: mockStore.setToneCurveChannel,
      setToneCurvePoints: mockStore.setToneCurvePoints,
      setToneCurveParametricRgb: mockStore.setToneCurveParametricRgb,
      resetToneCurve: mockStore.resetToneCurve,
    }),
  };
});

vi.mock("../Cropper", () => ({
  Cropper: () => null,
  CropOptions: () => null,
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

describe("ReactImageEditor Color panel", () => {
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

  test("renders vibrance and saturation controls", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    await waitFor(() => {
      expect(screen.getByTestId("color-section")).toBeTruthy();
    });

    const section = screen.getByTestId("color-section");


    expect(within(section).getByLabelText("Vibrance")).toBeTruthy();
    expect(within(section).getByLabelText("Saturation")).toBeTruthy();
  });

  test("changing vibrance slider updates store", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const slider = await screen.findByLabelText("Vibrance");
    fireEvent.change(slider, { target: { value: "10" } });
    fireEvent.pointerUp(slider);

    expect(mockSetColorAdjustment).toHaveBeenCalledWith("vibrance", 10);
  });

  test("reset button triggers resetColorAdjustments", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const section = await screen.findByTestId("color-section");
    const resetButton = within(section).getByRole("button", { name: "Reset" });
    fireEvent.click(resetButton);

    // Default tab is Basic.
    expect(mockResetColorAdjustments).toHaveBeenCalled();
  });
});
