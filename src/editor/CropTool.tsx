import type { RefObject } from "react";

import { canvasToBlob, drawImageWithRotation } from "@/export-download";
import { CropOptions, Cropper } from "@/Cropper";
import type { Bounds, CropRect } from "@/store/cropStore";

type CropToolButtonsProps = {
  cropMode: boolean;
  setCropMode: (next: boolean) => void;
  hasAppliedCrop: boolean;
  onResetCrop: () => void;
};

export function CropToolButtons({
  cropMode,
  setCropMode,
  hasAppliedCrop,
  onResetCrop,
}: CropToolButtonsProps) {
  return (
    <>
      <button
        type="button"
        className={
          cropMode
            ? "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-gray-900 text-white h-9 px-3"
            : "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3"
        }
        onClick={() => setCropMode(!cropMode)}
      >
        Crop
      </button>

      {hasAppliedCrop ? (
        <button
          type="button"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3"
          onClick={onResetCrop}
        >
          Reset Crop
        </button>
      ) : null}
    </>
  );
}

type CropToolOverlayProps = {
  cropMode: boolean;
  imageRef: RefObject<HTMLImageElement | null>;
  cropBounds: Bounds;
};

export function CropToolOverlay({ cropMode, imageRef, cropBounds }: CropToolOverlayProps) {
  if (!cropMode || !imageRef.current) {
    return null;
  }

  return <Cropper cropBounds={cropBounds} />;
}

type CropToolOptionsProps = {
  cropMode: boolean;
  imageRef: RefObject<HTMLImageElement | null>;
  bakedImageUrlRef: RefObject<string | null>;
  zoomLevel: number;
  offset: { x: number; y: number };
  rotation: number;
  resetAll: (bounds: Bounds) => void;
  onCroppedImageReady: (image: HTMLImageElement) => void;
};

export function CropToolOptions({
  cropMode,
  imageRef,
  bakedImageUrlRef,
  zoomLevel,
  offset,
  rotation,
  resetAll,
  onCroppedImageReady,
}: CropToolOptionsProps) {
  function handleCropReset() {
    if (!imageRef.current) {
      return;
    }

    resetAll({
      minX: offset.x,
      minY: offset.y,
      maxX: offset.x + imageRef.current.width * zoomLevel,
      maxY: offset.y + imageRef.current.height * zoomLevel,
    });
  }

  async function handleCropApplication(cropRect: CropRect) {
    if (!imageRef.current) return;
    if (!Number.isFinite(zoomLevel) || zoomLevel <= 0) return;

    const outputWidth = Math.max(1, Math.round(cropRect.width / zoomLevel));
    const outputHeight = Math.max(1, Math.round(cropRect.height / zoomLevel));

    const offscreen = document.createElement("canvas");
    offscreen.width = outputWidth;
    offscreen.height = outputHeight;

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.save();

    // Convert canvas-space offset/cropRect into image-pixel space, so we render at zoom=1.
    const bakedOffset = {
      x: (offset.x - cropRect.x) / zoomLevel,
      y: (offset.y - cropRect.y) / zoomLevel,
    };

    drawImageWithRotation(ctx, imageRef.current, 1, bakedOffset, rotation);

    ctx.restore();

    const blob = await canvasToBlob(offscreen, "image/png");
    if (!blob) return;

    if (bakedImageUrlRef.current) {
      URL.revokeObjectURL(bakedImageUrlRef.current);
    }

    const url = URL.createObjectURL(blob);

    const bakedImage = new Image();
    bakedImage.crossOrigin = "anonymous";
    bakedImage.src = url;

    bakedImage.onload = () => {
      onCroppedImageReady(bakedImage);
    };

    bakedImage.onerror = () => {
      URL.revokeObjectURL(url);
    };
  }

  if (!cropMode) {
    return null;
  }

  return (
    <div className="m-2">
      <CropOptions onReset={handleCropReset} onApply={handleCropApplication} />
    </div>
  );
}
