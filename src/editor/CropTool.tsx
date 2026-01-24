import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { CropOptions, Cropper } from "@/Cropper";
import { buildCropCommitFromCanvasRect } from "@/editor/cropCommitted";
import { useCropStore } from "@/store/cropStore";
import type { Bounds, CropRect } from "@/store/cropStore";

type CropToolButtonsProps = {
  cropMode: boolean;
  setCropMode: (next: boolean) => void;
  hasAppliedCrop: boolean;
  onResetCrop: () => void;
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
};

export function CropToolButtons({
  cropMode,
  setCropMode,
  hasAppliedCrop,
  onResetCrop,
  size,
  className,
}: CropToolButtonsProps) {
  return (
    <>
      <Button
        type="button"
        variant={cropMode ? "default" : "outline"}
        size={size}
        className={className}
        onClick={() => setCropMode(!cropMode)}
      >
        Crop
      </Button>

      {hasAppliedCrop ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          className={className}
          onClick={onResetCrop}
        >
          Reset Crop
        </Button>
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
  zoomLevel: number;
  offset: { x: number; y: number };
  rotation: number;
  resetAll: (bounds: Bounds) => void;
  onCropCommitted: () => void;
};

export function CropToolOptions({
  cropMode,
  imageRef,
  zoomLevel,
  offset,
  rotation,
  resetAll,
  onCropCommitted,
}: CropToolOptionsProps) {
  const commitCrop = useCropStore((state) => state.commitCrop);
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

  function handleCropApplication(cropRect: CropRect) {
    if (!imageRef.current) return;
    if (!Number.isFinite(zoomLevel) || zoomLevel <= 0) return;

    commitCrop(
      buildCropCommitFromCanvasRect({
        cropRect,
        zoomLevel,
        offset,
        rotationDegrees: rotation,
      }),
    );

    onCropCommitted();
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
