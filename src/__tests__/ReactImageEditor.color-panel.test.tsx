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

const mockStore = {
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
  setColorAdjustment: mockSetColorAdjustment,
  resetColorAdjustments: mockResetColorAdjustments,
  resetColorAdjustment: vi.fn(),

  toneCurve: createMockToneCurve(),
  setToneCurveMode: vi.fn(),
  setToneCurveChannel: vi.fn(),
  setToneCurvePoints: vi.fn(),
  setToneCurveParametricRgb: vi.fn(),
  resetToneCurve: vi.fn(),

  getEdits: vi.fn(),
};

vi.mock("../store/cropStore", () => ({
  useCropStore: () => mockStore,
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

    expect(mockSetColorAdjustment).toHaveBeenCalledWith("vibrance", 10);
  });

  test("reset button triggers resetColorAdjustments", async () => {
    const { ReactImageEditor } = await import("../ReactImageEditor");
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const section = await screen.findByTestId("color-section");
    const resetButton = within(section).getByRole("button", { name: "Reset" });
    fireEvent.click(resetButton);

    expect(mockResetColorAdjustments).toHaveBeenCalled();
  });
});
