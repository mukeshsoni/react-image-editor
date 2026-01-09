import { applyColorAdjustmentsToRgbaBytes, hasNonNeutralColorAdjustments } from "./lib/color-adjustments";
import { applySharpeningToRgbaBytes, createSharpeningBuffers, isNeutralSharpening } from "./lib/sharpening";
import { applyLightAdjustmentsToRgbaBytes } from "./lib/light-adjustments";
import {
  applyToneCurveToRgbaBytes,
  createToneCurveLuts,
  hasNonNeutralToneCurve,
} from "./lib/tone-curve";
import { applyWhiteBalanceToRgbaBytes, hasNonNeutralWhiteBalance } from "./lib/white-balance";

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

  ctx.save();
  drawImageWithRotation(ctx, image, 1, centeredOffset, rotationDegrees);
  ctx.restore();

  const shouldApplyWhiteBalance =
    whiteBalance != null && hasNonNeutralWhiteBalance(whiteBalance);

  const shouldApplyLight =
    lightAdjustments != null &&
    (lightAdjustments.exposure !== 0 ||
      lightAdjustments.contrast !== 0 ||
      lightAdjustments.highlights !== 0 ||
      lightAdjustments.shadows !== 0 ||
      lightAdjustments.whites !== 0 ||
      lightAdjustments.blacks !== 0);

  const shouldApplyToneCurve = toneCurve != null && hasNonNeutralToneCurve(toneCurve);

  const shouldApplyColor =
    colorAdjustments != null && hasNonNeutralColorAdjustments(colorAdjustments);

  const shouldApplySharpening =
    sharpening != null && !isNeutralSharpening(sharpening);

  if (
    shouldApplyWhiteBalance ||
    shouldApplyLight ||
    shouldApplyToneCurve ||
    shouldApplyColor ||
    shouldApplySharpening
  ) {
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

    const out = new Uint8ClampedArray(imageData.data.length);

    if (shouldApplyWhiteBalance && whiteBalance) {
      applyWhiteBalanceToRgbaBytes(imageData.data, out, whiteBalance);
    } else {
      out.set(imageData.data);
    }

    if (shouldApplyLight && lightAdjustments) {
      const lightOut = new Uint8ClampedArray(out.length);
      applyLightAdjustmentsToRgbaBytes(out, lightOut, lightAdjustments);
      out.set(lightOut);
    }

    if (shouldApplyToneCurve && toneCurve) {
      const luts = createToneCurveLuts(toneCurve);
      const toneOut = new Uint8ClampedArray(out.length);
      applyToneCurveToRgbaBytes(out, toneOut, luts);
      out.set(toneOut);
    }

    if (shouldApplyColor && colorAdjustments) {
      const colorOut = new Uint8ClampedArray(out.length);
      applyColorAdjustmentsToRgbaBytes(out, colorOut, colorAdjustments);
      out.set(colorOut);
    }

    if (shouldApplySharpening && sharpening) {
      const buffers = createSharpeningBuffers(offscreen.width * offscreen.height);
      const sharpened = new Uint8ClampedArray(out.length);

      applySharpeningToRgbaBytes(
        out,
        sharpened,
        offscreen.width,
        offscreen.height,
        sharpening,
        buffers,
      );

      out.set(sharpened);
    }

    ctx.putImageData(new ImageData(out, offscreen.width, offscreen.height), 0, 0);
  }

  return offscreen;
}
