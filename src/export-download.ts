import { applyPixelPipelineToCanvas } from "@/editor/renderPipeline";
import { getMaxInnerAxisAlignedRectSize } from "@/geometry/rotation";
import { useCropStore } from "@/store/cropStore";

import type {
  ColorAdjustments,
  LightAdjustments,
  SharpeningSettings,
  ToneCurveSettings,
  WhiteBalanceSettings,
} from "./store/cropStore";

export type ExportFormat = "png" | "jpeg";

type ExportBackground = "transparent" | "white";

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

type DrawableImage = HTMLImageElement | HTMLCanvasElement;

export function drawImageWithRotation(
  ctx: CanvasRenderingContext2D,
  image: DrawableImage,
  zoomLevel: number,
  offset: { x: number; y: number },
  rotationDegrees: number,
) {
  const imageWidth = image.width;
  const imageHeight = image.height;

  const radians = degreesToRadians(rotationDegrees);
  if (radians !== 0) {
    const renderedWidth = imageWidth * zoomLevel;
    const renderedHeight = imageHeight * zoomLevel;

    const centerX = offset.x + renderedWidth / 2;
    const centerY = offset.y + renderedHeight / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(radians);
    ctx.translate(-centerX, -centerY);
  }

  ctx.drawImage(
    image,
    offset.x,
    offset.y,
    imageWidth * zoomLevel,
    imageHeight * zoomLevel,
  );
}

function getRotatedBoundingBoxSize(
  width: number,
  height: number,
  rotationDegrees: number,
) {
  if (rotationDegrees === 0) {
    return { width, height };
  }

  const radians = degreesToRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: Math.max(1, Math.ceil(width * cos + height * sin)),
    height: Math.max(1, Math.ceil(width * sin + height * cos)),
  };
}

export function renderCommittedImageToOffscreenCanvas(
  image: DrawableImage,
  rotationDegrees: number,
  background: ExportBackground,
  whiteBalance?: WhiteBalanceSettings,
  lightAdjustments?: LightAdjustments,
  toneCurve?: ToneCurveSettings,
  colorAdjustments?: ColorAdjustments,
  sharpening?: SharpeningSettings,
): HTMLCanvasElement | null {
  // NOTE: Crop is handled by the caller (see ExportTool) so that export can bake
  // crop first and then run the same adjustment pipeline on the cropped pixels.

  const outputSize = getRotatedBoundingBoxSize(
    image.width,
    image.height,
    rotationDegrees,
  );

  const offscreen = document.createElement("canvas");
  offscreen.width = outputSize.width;
  offscreen.height = outputSize.height;

  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  if (background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  } else {
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  }

  const centeredOffset = {
    x: (offscreen.width - image.width) / 2,
    y: (offscreen.height - image.height) / 2,
  };

  const constrainCrop = useCropStore.getState().cropSettings.constrainCrop ?? true;
  if (constrainCrop && rotationDegrees !== 0) {
    const maxRect = getMaxInnerAxisAlignedRectSize(offscreen.width, offscreen.height, rotationDegrees);
    const width = Math.max(1, Math.floor(maxRect.width));
    const height = Math.max(1, Math.floor(maxRect.height));

    offscreen.width = width;
    offscreen.height = height;

    const constrainedCtx = offscreen.getContext("2d");
    if (!constrainedCtx) return null;

    if (background === "white") {
      constrainedCtx.fillStyle = "#ffffff";
      constrainedCtx.fillRect(0, 0, width, height);
    } else {
      constrainedCtx.clearRect(0, 0, width, height);
    }

    const constrainedOffset = {
      x: (width - image.width) / 2,
      y: (height - image.height) / 2,
    };

    constrainedCtx.save();
    drawImageWithRotation(constrainedCtx, image, 1, constrainedOffset, rotationDegrees);
    constrainedCtx.restore();
  } else {
    ctx.save();
    drawImageWithRotation(ctx, image, 1, centeredOffset, rotationDegrees);
    ctx.restore();
  }

  applyPixelPipelineToCanvas(offscreen, {
    whiteBalance,
    lightAdjustments,
    toneCurve,
    colorAdjustments,
    sharpening,
  });

  return offscreen;
}
