import { createRef } from "react";
import type { RefObject } from "react";

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { EditorCanvas } from "@/editor/EditorCanvas";
import { ExportTool } from "@/editor/ExportTool";
import * as pipeline from "@/editor/renderPipeline";
import * as download from "@/export-download";
import { useCropStore } from "@/store/cropStore";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";

import { installPixelCanvas, pixelAt } from "./test-helpers/pixelCanvas";

function PreviewAndExport({ image, canvasRef, offset, zoomLevel }: {
  image: HTMLImageElement;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  offset: { x: number; y: number };
  zoomLevel: number;
}) {
  return <>
    <EditorCanvas
      canvasRef={canvasRef}
      imageRef={{ current: image }}
      offset={offset}
      zoomLevel={zoomLevel}
      rotation={0}
      listeners={{}}
      isPickingWhiteBalance={false}
      onPickWhiteBalance={() => {}}
      isPickingPointColor={false}
      onPickPointColor={() => {}}
    />
    <ExportTool
      imageRef={{ current: image }}
      isImageLoaded
      cropMode={false}
      rotation={0}
      exportFormat="png"
      setExportFormat={() => {}}
      jpegQuality={92}
      setJpegQuality={() => {}}
      isDownloading={false}
      setIsDownloading={() => {}}
      exportError={null}
      setExportError={() => {}}
    />
  </>;
}

describe("preview/export parity", () => {
  let createImage: ReturnType<typeof installPixelCanvas>["createImage"];
  let exported: HTMLCanvasElement;

  beforeEach(() => {
    ({ createImage } = installPixelCanvas());
    useCropStore.getState().clearCommittedCrop();
    useCropStore.getState().resetCropSettings();
    useGeometryOpticsStore.getState().resetGeometryOptics();
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(download, "canvasToBlob").mockImplementation(async (canvas) => {
      exported = canvas;
      return new Blob(["export"]);
    });
    vi.spyOn(download, "triggerDownload").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test.each([
    ["vignette", false], ["vignette", true],
    ["distortion", false], ["distortion", true],
    ["perspective", false], ["perspective", true],
    ["grain", false], ["grain", true],
  ] as const)("matches %s pixels with margins and panning (rotated crop=%s)", async (effect, cropped) => {
    const settings = useGeometryOpticsStore.getState();
    if (effect === "vignette") settings.setOptics({ vignette: 100 });
    if (effect === "grain") settings.setOptics({ grain: 70 });
    if (effect === "distortion") settings.setLensCorrections({ distortion: 60 });
    if (effect === "perspective") settings.setPerspective({ vertical: 35, horizontal: -20, aspect: 10 });
    if (cropped) {
      useCropStore.getState().commitCrop({
        outputWidth: 32,
        outputHeight: 24,
        bakedOffset: { x: -16, y: -12 },
        rotationDegrees: 30,
      });
    }
    const image = createImage(64, 48, (ctx) => {
      const data = ctx.createImageData(64, 48);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 64; x++) {
          data.data.set([80 + x * 2, 80 + y * 3, 180, 255], (y * 64 + x) * 4);
        }
      }
      ctx.putImageData(data, 0, 0);
    });
    const canvasRef = createRef<HTMLCanvasElement>();
    const { getByRole, rerender } = render(
      <PreviewAndExport image={image} canvasRef={canvasRef} offset={{ x: 80, y: 40 }} zoomLevel={1} />,
    );
    fireEvent.click(getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download.triggerDownload).toHaveBeenCalledTimes(1));
    const expected = exported.getContext("2d")!.getImageData(0, 0, exported.width, exported.height).data;
    const preview = canvasRef.current!;
    expect(preview.getContext("2d")!.getImageData(80, 40, exported.width, exported.height).data).toEqual(expected);

    rerender(<PreviewAndExport image={image} canvasRef={canvasRef} offset={{ x: 10, y: 15 }} zoomLevel={1} />);
    expect(preview.getContext("2d")!.getImageData(10, 15, exported.width, exported.height).data).toEqual(expected);

    // Resize the viewport and redraw at a new camera; image-space effects stay put.
    preview.width = 420;
    preview.height = 220;
    rerender(<PreviewAndExport image={image} canvasRef={canvasRef} offset={{ x: 100, y: 80 }} zoomLevel={1} />);
    expect(preview.getContext("2d")!.getImageData(100, 80, exported.width, exported.height).data).toEqual(expected);
  });

  test("caches image-space filters across zoom and updates them when edits change", async () => {
    const image = createImage(40, 40, (ctx) => {
      ctx.fillStyle = "rgb(200,200,200)";
      ctx.fillRect(0, 0, 40, 40);
    });
    useGeometryOpticsStore.getState().setOptics({ vignette: 100 });
    const processImage = vi.spyOn(pipeline, "createProcessedImageCanvas");
    const canvasRef = createRef<HTMLCanvasElement>();
    const { rerender, getByRole } = render(
      <PreviewAndExport image={image} canvasRef={canvasRef} offset={{ x: 80, y: 40 }} zoomLevel={1} />,
    );
    expect(pixelAt(canvasRef.current!, 80, 40)).toEqual([0, 0, 0, 255]);
    expect(processImage).toHaveBeenCalledTimes(1);

    fireEvent.click(getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download.triggerDownload).toHaveBeenCalledTimes(1));
    expect(pixelAt(exported, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(processImage).toHaveBeenCalledTimes(2);

    rerender(<PreviewAndExport image={image} canvasRef={canvasRef} offset={{ x: 10, y: 20 }} zoomLevel={2} />);
    expect(processImage).toHaveBeenCalledTimes(2);
    const expected = document.createElement("canvas");
    expected.width = 300;
    expected.height = 150;
    expected.getContext("2d")!.drawImage(exported, 10, 20, 80, 80);
    expect(canvasRef.current!.getContext("2d")!.getImageData(0, 0, 300, 150).data)
      .toEqual(expected.getContext("2d")!.getImageData(0, 0, 300, 150).data);

    act(() => useGeometryOpticsStore.getState().setOptics({ vignette: 0 }));
    expect(processImage).toHaveBeenCalledTimes(3);
    expect(pixelAt(canvasRef.current!, 30, 40)).toEqual([200, 200, 200, 255]);
  });
});
