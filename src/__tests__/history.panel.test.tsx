import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { HistoryEntry } from "@/store";

import { ReactImageEditor } from "../ReactImageEditor";

const hoisted = vi.hoisted(() => ({
  historyJumpTo: vi.fn(),
}));

vi.mock("../store/historyStore", () => {
  const entries: HistoryEntry[] = [
    {
      id: "original",
      label: "Original",
      timestamp: 0,
      state: {
        edits: {
          version: 1,
          crop: {
            rect: { x: 0, y: 0, width: 0, height: 0 },
            settings: { aspectRatio: "original", aspectRatioLocked: false },
          },
          whiteBalance: {
            temperatureKelvin: 6500,
            tint: 0,
            preset: "custom",
          },
          light: {
            exposure: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
          },
          color: {
            vibrance: 0,
            saturation: 0,
          },
          toneCurve: {
            mode: "point",
            activeChannel: "rgb",
            point: {
              rgb: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              r: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              g: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              b: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
            parametric: {
              rgb: {
                highlights: 0,
                lights: 0,
                darks: 0,
                shadows: 0,
              },
            },
          },
          sharpening: {
            amount: 0,
            radius: 1,
            detail: 25,
            masking: 0,
          },
          denoise: {
            luminance: 0,
            color: 0,
            detail: 50,
          },
        },
        camera: {
          zoomLevel: 1,
          offset: { x: 0, y: 0 },
        },
      },
    },
    {
      id: "tone",
      label: "Exposure",
      delta: "+0.2",
      timestamp: 1,
      state: {
        edits: {
          version: 1,
          crop: {
            rect: { x: 0, y: 0, width: 0, height: 0 },
            settings: { aspectRatio: "original", aspectRatioLocked: false },
          },
          whiteBalance: {
            temperatureKelvin: 6500,
            tint: 0,
            preset: "custom",
          },
          light: {
            exposure: 0.2,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
          },
          color: {
            vibrance: 0,
            saturation: 0,
          },
          toneCurve: {
            mode: "point",
            activeChannel: "rgb",
            point: {
              rgb: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              r: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              g: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              b: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
            parametric: {
              rgb: {
                highlights: 0,
                lights: 0,
                darks: 0,
                shadows: 0,
              },
            },
          },
          sharpening: {
            amount: 0,
            radius: 1,
            detail: 25,
            masking: 0,
          },
          denoise: {
            luminance: 0,
            color: 0,
            detail: 50,
          },
        },
        camera: {
          zoomLevel: 1,
          offset: { x: 0, y: 0 },
        },
      },
    },
  ];

  return {
    useHistoryStore: ((selector?: (state: unknown) => unknown) => {
      const state = {
        entries,
        index: 1,
        jumpTo: hoisted.historyJumpTo,
        push: vi.fn(),
        resetToBaseline: vi.fn(),
      };

      if (selector) {
        return selector(state);
      }

      return state;
    }) as unknown,
  };
});

vi.mock("../store/editorActions", () => ({
  useResetAll: () => vi.fn(),
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
      setRotation: vi.fn(),
      resetRotation: vi.fn(),
      setConstrainCrop: vi.fn(),
    }),
  };
});

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
      toneCurve: {
        mode: "point",
        activeChannel: "rgb",
        point: {
          rgb: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          r: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          g: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          b: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        parametric: {
          rgb: {
            highlights: 0,
            lights: 0,
            darks: 0,
            shadows: 0,
          },
        },
      },
      setToneCurveMode: vi.fn(),
      setToneCurveChannel: vi.fn(),
      setToneCurvePoints: vi.fn(),
      setToneCurveParametricRgb: vi.fn(),
      resetToneCurve: vi.fn(),
    }),
  };
});

vi.mock("../store/sharpeningStore", async () => {
  const actual = await vi.importActual<typeof import("../store/sharpeningStore")>(
    "../store/sharpeningStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    ...actual,
    useSharpeningStore: createMockZustandHook({
      sharpening: {
        amount: 0,
        radius: 1,
        detail: 25,
        masking: 0,
      },
      setSharpening: vi.fn(),
      resetSharpening: vi.fn(),
    }),
  };
});

vi.mock("../store/denoiseStore", async () => {
  const actual = await vi.importActual<typeof import("../store/denoiseStore")>(
    "../store/denoiseStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    ...actual,
    useDenoiseStore: createMockZustandHook({
      denoise: {
        luminance: 0,
        color: 0,
        detail: 50,
      },
      setDenoise: vi.fn(),
      resetDenoise: vi.fn(),
    }),
  };
});

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
      resetZoom: vi.fn(),
      listeners: {},
    }),
  };
});

describe("History panel", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          canvas: { width: 0, height: 0 },
          clearRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          drawImage: vi.fn(),
          getImageData: () => new ImageData(1, 1),
          putImageData: vi.fn(),
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

  test("renders history entries and jumps on click", async () => {
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const accordion = screen.getByTestId("history-accordion");
    expect(within(accordion).getByText("History")).toBeTruthy();

    const list = screen.getByTestId("history-list");
    expect(within(list).getByText("Original")).toBeTruthy();
    expect(within(list).getByText("Exposure")).toBeTruthy();
    expect(within(list).getByText("+0.2")).toBeTruthy();

    fireEvent.click(screen.getByTestId("history-entry-0"));
    expect(hoisted.historyJumpTo).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByTestId("history-entry-1"));
    expect(hoisted.historyJumpTo).toHaveBeenCalledWith(1);
  });
});
