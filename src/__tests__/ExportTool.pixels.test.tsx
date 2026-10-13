import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ExportTool } from "@/editor/ExportTool";
import * as download from "@/export-download";
import { useCropStore } from "@/store/cropStore";
import { useDenoiseStore } from "@/store/denoiseStore";

import { installPixelCanvas } from "./test-helpers/pixelCanvas";

function horizontalVariation(image: ImageData): number {
  let total = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      total += Math.abs(image.data[i] - image.data[i - 4]);
    }
  }
  return total;
}

function renderExport(image: HTMLImageElement, format: download.ExportFormat = "png") {
  return render(
    <ExportTool
      imageRef={{ current: image }}
      isImageLoaded
      cropMode={false}
      rotation={0}
      exportFormat={format}
      setExportFormat={() => {}}
      jpegQuality={92}
      setJpegQuality={() => {}}
      isDownloading={false}
      setIsDownloading={() => {}}
      exportError={null}
      setExportError={() => {}}
    />,
  );
}

describe("export pixels", () => {
  let createImage: ReturnType<typeof installPixelCanvas>["createImage"];
  let exports: ImageData[];

  beforeEach(() => {
    ({ createImage } = installPixelCanvas());
    exports = [];
    useCropStore.getState().clearCommittedCrop();
    useCropStore.getState().resetCropSettings();
    useDenoiseStore.getState().resetDenoise();
    vi.spyOn(download, "canvasToBlob").mockImplementation(async (canvas) => {
      exports.push(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height));
      return new Blob(["export"]);
    });
    vi.spyOn(download, "triggerDownload").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test.each([
    ["png", false],
    ["jpeg", false],
    ["png", true],
    ["jpeg", true],
  ] as const)("includes denoise in %s exports (cropped=%s)", async (format, cropped) => {
    const image = createImage(32, 32, (ctx) => {
      const data = ctx.createImageData(32, 32);
      for (let i = 0; i < data.data.length; i += 4) {
        const value = ((i / 4 * 1664525 + 1013904223) >>> 0) % 90 + 80;
        data.data.set([value, value, value, 255], i);
      }
      ctx.putImageData(data, 0, 0);
    });
    if (cropped) {
      useCropStore.getState().commitCrop({
        outputWidth: 20,
        outputHeight: 20,
        bakedOffset: { x: -6, y: -6 },
        rotationDegrees: 0,
      });
    }
    const { getByRole } = renderExport(image, format);
    fireEvent.click(getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download.triggerDownload).toHaveBeenCalledTimes(1));

    act(() => useDenoiseStore.getState().setDenoise({ luminance: 100, color: 100, detail: 0 }));
    fireEvent.click(getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download.triggerDownload).toHaveBeenCalledTimes(2));

    expect(exports[1].width).toBe(cropped ? 20 : 32);
    expect(exports[1].data).not.toEqual(exports[0].data);
    expect(horizontalVariation(exports[1])).toBeLessThan(horizontalVariation(exports[0]));
  });
});
