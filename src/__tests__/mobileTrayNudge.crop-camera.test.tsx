import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ReactImageEditor } from "@/ReactImageEditor";
import { useCropStore } from "@/store/cropStore";

import { installPixelCanvas } from "./test-helpers/pixelCanvas";

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }));

function imageBounds(canvas: HTMLCanvasElement) {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let maxX = -1;
  let minY = canvas.height;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!data[(y * canvas.width + x) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
    }
  }
  return { width: maxX - minX + 1, top: minY };
}

describe("mobile tray crop camera", () => {
  let trayHeight: number;
  let observers: Map<Element, () => void>;

  function resizeTray(height: number) {
    trayHeight = height;
    act(() => observers.get(document.querySelector(".mobile-tray-panel")!)?.());
  }

  beforeEach(() => {
    trayHeight = 60;
    observers = new Map();
    const { createImage } = installPixelCanvas();
    vi.stubGlobal("Image", function () {
      const image = createImage(1200, 800, (ctx) => {
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, 1200, 800);
      });
      Object.defineProperty(image, "src", {
        set() { queueMicrotask(() => image.onload?.(new Event("load"))); },
      });
      return image;
    });
    vi.stubGlobal("ResizeObserver", class {
      private callback: () => void;
      constructor(callback: () => void) { this.callback = callback; }
      observe(element: Element) { observers.set(element, this.callback); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("mobile-tray-panel") ? trayHeight : 726;
    });
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(async () => {
    cleanup();
    // Drain the store's debounced notifications before the next editor mounts.
    await new Promise((resolve) => setTimeout(resolve, 300));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("keeps the fitted crop zoom when closing a nudged tray", async () => {
    const { getByRole, getByLabelText } = render(<ReactImageEditor imageSrc="image.png" />);
    await waitFor(() => expect(getByRole("button", { name: "Download" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(getByRole("button", { name: "Crop" }));
    resizeTray(280);
    const bounds = useCropStore.getState().cropBounds;
    const zoom = (bounds.maxX - bounds.minX) / 1200;
    act(() => useCropStore.getState().setCropRect({
      x: bounds.minX + 375 * zoom,
      y: bounds.minY + 50 * zoom,
      width: 450 * zoom,
      height: 700 * zoom,
    }));
    fireEvent.click(getByRole("button", { name: "Apply" }));
    await act(async () => {});
    resizeTray(100);
    const canvas = getByLabelText("Image preview") as HTMLCanvasElement;
    expect(imageBounds(canvas)).toEqual({ width: 390, top: 20 });

    fireEvent.click(getByRole("button", { name: "Crop" }));
    resizeTray(60);
    expect(imageBounds(canvas).width).toBe(390);
  });

  test("still restores the camera when the image framing has not changed", async () => {
    const { getByRole, getByLabelText } = render(<ReactImageEditor imageSrc="image.png" />);
    await waitFor(() => expect(getByRole("button", { name: "Download" }).hasAttribute("disabled")).toBe(false));
    const canvas = getByLabelText("Image preview") as HTMLCanvasElement;
    const initial = imageBounds(canvas);
    fireEvent.click(getByRole("button", { name: "Presets" }));
    resizeTray(280);
    expect(imageBounds(canvas).top).toBeLessThan(initial.top);

    fireEvent.click(getByRole("button", { name: "Presets" }));
    resizeTray(60);
    expect(imageBounds(canvas)).toEqual(initial);
  });
});
