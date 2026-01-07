import type { CropCommit } from "@/store/cropStore";

export function buildCropCommitFromCanvasRect(params: {
  cropRect: { x: number; y: number; width: number; height: number };
  zoomLevel: number;
  offset: { x: number; y: number };
  rotationDegrees: number;
}): CropCommit {
  const { cropRect, zoomLevel, offset, rotationDegrees } = params;

  const outputWidth = Math.max(1, Math.round(cropRect.width / zoomLevel));
  const outputHeight = Math.max(1, Math.round(cropRect.height / zoomLevel));

  const bakedOffset = {
    x: (offset.x - cropRect.x) / zoomLevel,
    y: (offset.y - cropRect.y) / zoomLevel,
  };

  return {
    outputWidth,
    outputHeight,
    bakedOffset,
    rotationDegrees,
  };
}
