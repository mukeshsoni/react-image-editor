import type { ReactNode } from "react";

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ReactImageEditor } from "@/ReactImageEditor";
import { useHistoryStore } from "@/store/historyStore";
import { useLightStore } from "@/store/lightStore";

import { installPixelCanvas, pixelAt } from "./test-helpers/pixelCanvas";

// jsdom has no panel layout; keep the real editor, stores, and pixel renderer.
vi.mock("@/editor/layouts/DesktopEditorLayout", () => ({
  DesktopEditorLayout: ({ canvasPanel, controlsPanel }: {
    canvasPanel: ReactNode;
    controlsPanel: ReactNode;
  }) => <div>{canvasPanel}{controlsPanel}</div>,
}));

describe("image loading lifecycle", () => {
  let images: HTMLImageElement[];
  let loadSynchronously: boolean;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    images = [];
    loadSynchronously = false;
    const { createImage } = installPixelCanvas();
    vi.stubGlobal("Image", function () {
      const color = images.length === 0 ? "red" : "blue";
      const image = createImage(80, 60, (ctx) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 80, 60);
      });
      Object.defineProperty(image, "src", {
        configurable: true,
        set() {
          if (loadSynchronously) image.onload?.(new Event("load"));
        },
      });
      images.push(image);
      return image;
    });
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("ignores an older load after a new image has been edited", async () => {
    const { rerender, getByLabelText } = render(<ReactImageEditor imageSrc="first.png" />);
    const first = images[0];
    const staleLoad = first.onload!;
    rerender(<ReactImageEditor imageSrc="second.png" />);
    expect(first.onload).toBeNull();

    await act(async () => { images[1].onload?.(new Event("load")); });
    act(() => useLightStore.getState().setLightAdjustment("exposure", 0.5));
    act(() => vi.advanceTimersByTime(300));
    const history = useHistoryStore.getState().entries;
    expect(history.length).toBeGreaterThan(1);

    // Also guard callbacks that were already queued before cleanup detached them.
    await act(async () => { staleLoad.call(first, new Event("load")); });
    expect(useLightStore.getState().lightAdjustments.exposure).toBe(0.5);
    expect(useHistoryStore.getState().entries).toBe(history);
    const canvas = getByLabelText("Image preview") as HTMLCanvasElement;
    expect(pixelAt(canvas, canvas.width / 2, canvas.height / 2)).toEqual([0, 0, 255, 255]);
  });

  test("ignores a load delivered after unmount", async () => {
    const { unmount } = render(<ReactImageEditor imageSrc="first.png" />);
    const first = images[0];
    const staleLoad = first.onload!;
    unmount();
    expect(first.onload).toBeNull();
    useLightStore.getState().setLightAdjustment("exposure", 0.75);

    await act(async () => { staleLoad.call(first, new Event("load")); });
    expect(useLightStore.getState().lightAdjustments.exposure).toBe(0.75);
  });

  test("registers its load handler before starting the image request", async () => {
    loadSynchronously = true;
    const { getByRole } = render(<ReactImageEditor imageSrc="cached.png" />);
    await act(async () => {});
    expect(getByRole("button", { name: "Download" }).hasAttribute("disabled")).toBe(false);
  });
});
