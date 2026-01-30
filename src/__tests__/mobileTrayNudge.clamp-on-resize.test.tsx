import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const hoisted = vi.hoisted(() => {
  const setCamera = vi.fn();
  const historyResetToBaseline = vi.fn();
  let notifyCamera: ((camera: { zoomLevel: number; offset: { x: number; y: number } }) => void) | null =
    null;

  return {
    setCamera,
    historyResetToBaseline,
    get notifyCamera() {
      return notifyCamera;
    },
    setNotifyCamera(next: typeof notifyCamera) {
      notifyCamera = next;
    },
    mockZoomLevel: 1,
    mockOffset: { x: 0, y: 0 },
  };
});

vi.mock("@/hooks/useIsMobile", () => {
  return {
    useIsMobile: () => true,
  };
});

vi.mock("@/use-canvas-zoom-pan", async () => {
  const actual = await vi.importActual<typeof import("@/use-canvas-zoom-pan")>(
    "@/use-canvas-zoom-pan",
  );

  return {
    ...actual,
    useCanvasZoomPan: (
      _canvasRef: unknown,
      _imageRef: unknown,
      config?: { onCameraChange?: (camera: unknown) => void },
    ) => {
      hoisted.setNotifyCamera((camera) => {
        config?.onCameraChange?.(camera);
      });
      return {
        zoomLevel: hoisted.mockZoomLevel,
        offset: hoisted.mockOffset,
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetZoom: vi.fn(),
        setCamera: hoisted.setCamera,
        listeners: {},
      };
    },
  };
});

vi.mock("@/store/cropStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/cropStore")>(
    "@/store/cropStore",
  );
  const { createMockZustandHook } = await import(
    "./test-helpers/mockZustandHook"
  );

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

vi.mock("@/store/editorActions", () => ({
  useResetAll: () => vi.fn(),
}));

vi.mock("@/store/whiteBalanceStore", async () => {
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

vi.mock("@/store/lightStore", async () => {
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

vi.mock("@/store/colorStore", async () => {
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

vi.mock("@/store/toneCurveStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  const { createMockToneCurve } = await import("./test-helpers/mockToneCurve");

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

vi.mock("@/store/denoiseStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    useDenoiseStore: createMockZustandHook({
      denoise: { enabled: false, amount: 0 },
      setDenoiseEnabled: vi.fn(),
      setDenoiseAmount: vi.fn(),
      resetDenoise: vi.fn(),
    }),
  };
});

vi.mock("@/store/sharpeningStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    useSharpeningStore: createMockZustandHook({
      sharpening: { enabled: false, amount: 0 },
      setSharpeningEnabled: vi.fn(),
      setSharpeningAmount: vi.fn(),
      resetSharpening: vi.fn(),
    }),
  };
});

vi.mock("@/store/healingStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/healingStore")>(
    "@/store/healingStore",
  );
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    ...actual,
    useHealingStore: createMockZustandHook({
      healingMode: "spot",
      healingBrush: { size: 20, feather: 0 },
      cloneSource: null,
      setCloneSource: vi.fn(),
      addHealingOp: vi.fn(),
      healingOps: [],
      setSpotSource: vi.fn(),
      removeHealingOp: vi.fn(),
    }),
  };
});

vi.mock("@/store/geometryOpticsStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    useGeometryOpticsStore: createMockZustandHook({
      settings: {
        isAuto: false,
        straightenDegrees: 0,
        perspective: {
          vertical: 0,
          horizontal: 0,
        },
      },
      setSetting: vi.fn(),
      resetSettings: vi.fn(),
    }),
  };
});

vi.mock("@/store/presetStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    usePresetStore: createMockZustandHook({
      preset: {
        activePresetId: "none",
        intensity: 100,
      },
      setActivePreset: vi.fn(),
      setPresetIntensity: vi.fn(),
      clearPreset: vi.fn(),
    }),
  };
});

vi.mock("@/store/historyStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/historyStore")>(
    "@/store/historyStore",
  );
  const { createMockZustandHook } = await import(
    "./test-helpers/mockZustandHook"
  );

  return {
    ...actual,
    useHistoryStore: createMockZustandHook({
      entries: [],
      index: 0,
      push: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      jumpTo: vi.fn(),
      resetToBaseline: hoisted.historyResetToBaseline,
    }),
  };
});

vi.mock("@/store/historyLabelStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");
  return {
    useHistoryLabelStore: createMockZustandHook({
      pendingHistoryLabel: null,
      setPendingHistoryLabel: vi.fn(),
      consumePendingHistoryLabel: vi.fn(() => null),
    }),
  };
});

vi.mock("@/store", async () => {
  const actual = await vi.importActual<typeof import("@/store")>("@/store");
  return {
    ...actual,
    subscribeToEdits: () => () => {},
    applyEditsSnapshot: vi.fn(),
  };
});

vi.mock("@/editor/panels", () => ({
  getPanelRegistry: () => [],
}));

vi.mock("@/editor/CropTool", () => ({
  CropToolButtons: () => null,
  CropToolOptions: () => null,
  CropToolOverlay: () => null,
}));

vi.mock("@/editor/ExportTool", () => ({
  ExportTool: () => null,
}));

vi.mock("@/editor/HealingTool", () => ({
  HealingToolButtons: () => null,
  HealingToolPanel: () => null,
}));

vi.mock("@/editor/GeometryOpticsPanel", () => ({
  GeometryOpticsPanel: () => null,
}));

vi.mock("@/editor/layouts/DesktopEditorLayout", () => ({
  DesktopEditorLayout: ({
    canvasPanel,
  }: {
    canvasPanel: import("react").ReactNode;
  }) => <div>{canvasPanel}</div>,
}));

vi.mock("@/editor/layouts/MobileEditorLayout", () => ({
  MobileEditorLayout: ({
    canvasPanel,
    trayPanel,
  }: {
    canvasPanel: import("react").ReactNode;
    trayPanel: import("react").ReactNode;
  }) => (
    <div>
      {canvasPanel}
      {trayPanel}
    </div>
  ),
}));

import { ReactImageEditor } from "@/ReactImageEditor";

describe("mobile tray nudge", () => {
  const OriginalImage = globalThis.Image;
  const OriginalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });

    const createdObservers: Array<{ trigger: () => void }> = [];
    class MockResizeObserver {
      private cb: (entries: unknown[], observer: unknown) => void;
      constructor(cb: (entries: unknown[], observer: unknown) => void) {
        this.cb = cb;
        createdObservers.push({
          trigger: () => this.cb([], this as unknown as ResizeObserver),
        });
      }
      observe() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    // Mock Image load with known dimensions.
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: class MockImage {
        width = 1000;
        height = 800;
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

    // Ensure the observed elements have stable client sizes.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 400;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        // Make tray have some height; viewport height doesn't really matter for X clamp.
        const testId = (this as HTMLElement).getAttribute?.("data-testid");
        if (testId === "mobile-tray-scroll") return 200;
        return 300;
      },
    });

    // Expose to test via global.
    (globalThis as unknown as { __testObservers?: Array<{ trigger: () => void }> }).__testObservers =
      createdObservers;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: OriginalImage,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: OriginalResizeObserver,
    });
  });

  test("clamps camera on viewport resize even when tray content is closed", async () => {
    render(<ReactImageEditor imageSrc="https://example.com/image.jpg" />);

    // Wait for image onload handler to run.
    await waitFor(() => {
      expect(hoisted.historyResetToBaseline).toHaveBeenCalled();
    });
    // resetZoom queues a microtask to end initialization; give it a turn.
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    // Simulate the user being out-of-bounds at the moment the viewport changes.
    expect(hoisted.notifyCamera).toBeTypeOf("function");
    hoisted.notifyCamera?.({ zoomLevel: 1, offset: { x: -900, y: -900 } });

    // Trigger the viewport ResizeObserver callback.
    const observers = (globalThis as unknown as { __testObservers: Array<{ trigger: () => void }> })
      .__testObservers;
    expect(observers.length).toBeGreaterThan(0);
    observers[0].trigger();

    // For zoom=1, viewportWidth=400, imageWidth=1000 -> minX = 400-1000 = -600.
    // Initial mocked offset.x = -900 should clamp to -600.
    expect(hoisted.setCamera).toHaveBeenCalledWith(1, expect.objectContaining({ x: -600 }));
  });

  test("does not recreate ResizeObservers when camera state changes", async () => {
    const { rerender } = render(
      <ReactImageEditor imageSrc="https://example.com/image.jpg" />,
    );

    await waitFor(() => {
      expect(hoisted.historyResetToBaseline).toHaveBeenCalled();
    });

    const observers = (globalThis as unknown as { __testObservers: Array<{ trigger: () => void }> })
      .__testObservers;
    expect(observers).toHaveLength(2);

    // Simulate a camera change causing a re-render (previously this would
    // recreate observers because applyMobileTrayNudge depended on offset/zoomLevel).
    hoisted.mockZoomLevel = 2;
    hoisted.mockOffset = { x: 10, y: 20 };
    rerender(<ReactImageEditor imageSrc="https://example.com/image.jpg" />);

    const observersAfter = (
      globalThis as unknown as { __testObservers: Array<{ trigger: () => void }> }
    ).__testObservers;
    expect(observersAfter).toHaveLength(2);
  });
});
