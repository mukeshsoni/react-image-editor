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

import { ReactImageEditor } from "../ReactImageEditor";

const mockResetAll = vi.fn();
const mockSetRotation = vi.fn();
const mockResetRotation = vi.fn();

vi.mock("../store/cropStore", () => ({
  useCropStore: () => ({
    resetAll: mockResetAll,
    cropSettings: {
      rotation: 0,
      constrainCrop: true,
    },
    setRotation: mockSetRotation,
    resetRotation: mockResetRotation,
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

describe("ReactImageEditor export/download", () => {
  const originalImage = globalThis.Image;

  const drawImage = vi.fn();
  const translate = vi.fn();
  const rotate = vi.fn();
  const save = vi.fn();
  const restore = vi.fn();
  const clearRect = vi.fn();
  const fillRect = vi.fn();

  let toBlobSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

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
