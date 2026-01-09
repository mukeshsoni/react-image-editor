import type { CropCommit } from "@/store/cropStore";

export function createOffscreenCropCanvas(params: {
  image: HTMLImageElement;
  commit: CropCommit;
  background: "transparent" | "white";
}): HTMLCanvasElement | null {
  const { image, commit, background } = params;

  const offscreen = document.createElement("canvas");
  offscreen.width = commit.outputWidth;
  offscreen.height = commit.outputHeight;

  const ctx = offscreen.getContext("2d");
  if (!ctx) {
    return null;
  }

  if (background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  } else {
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  }

  ctx.save();
  // `drawImageWithRotation` expects a zoomed draw; we bake crop at zoom=1.
  // Rotation is applied around the output canvas via the baked offset.
  // The baked offset is in image pixel space.
  drawImageWithRotation(ctx, image, 1, commit.bakedOffset, commit.rotationDegrees);
  ctx.restore();

  return offscreen;
}

import { drawImageWithRotation } from "@/export-download";
