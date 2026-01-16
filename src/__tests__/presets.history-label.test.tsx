import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReactImageEditor } from "../ReactImageEditor";
import { useHistoryStore } from "../store/historyStore";

describe("Presets history label", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    useHistoryStore.setState({ entries: [], index: -1, maxEntries: 50 });

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          canvas: { width: 0, height: 0 },
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

  test("records preset name in history label", async () => {
    render(<ReactImageEditor imageSrc="data:image/png;base64,AAA=" />);

    const vibrantButton = await screen.findByRole("button", { name: "Vibrant" });

    await waitFor(() => {
      expect(vibrantButton.getAttribute("disabled")).toBeNull();
    });

    fireEvent.click(vibrantButton);

    await waitFor(
      () => {
        const entries = useHistoryStore.getState().entries;
        expect(entries.length).toBeGreaterThanOrEqual(2);
        expect(entries[entries.length - 1]?.label).toBe("Vibrant preset");
      },
      { timeout: 2000 },
    );
  });
});
