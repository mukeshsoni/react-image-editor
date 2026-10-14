import type { Camera, CropSettings, Dimensions, ImageEditorEdits, Point, Rectangle, Viewport } from "../model/types";

export const limit = (value: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;

export function rotate(point: Point, size: Dimensions, degrees: number): Point {
  const angle = degrees * Math.PI / 180;
  const x = point.x - size.width / 2, y = point.y - size.height / 2;
  return {
    x: size.width / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: size.height / 2 + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

export function readRatio(settings: CropSettings, size: Dimensions): number {
  const text = settings.aspectRatio === "custom" ? settings.customAspectRatio : settings.aspectRatio;
  const parts = text?.split("x").map(Number) ?? [];
  const ratio = parts[0] / parts[1];
  return parts[0] > 0 && parts[1] > 0 && Number.isFinite(ratio) && ratio > 0 ? ratio : size.width / Math.max(1, size.height);
}

export function centeredCrop(size: Dimensions, settings: CropSettings): Rectangle {
  const ratio = readRatio(settings, size);
  const angle = settings.constrainCrop === false ? 0 : (settings.rotation ?? 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const height = Math.min(size.height, size.width / ratio, size.width / (ratio * c + s), size.height / (ratio * s + c));
  const width = height * ratio;
  return { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height };
}

export function containCrop(rect: Rectangle, size: Dimensions, settings: CropSettings): Rectangle {
  const angle = settings.constrainCrop === false ? 0 : settings.rotation ?? 0;
  const c = Math.abs(Math.cos(angle * Math.PI / 180)), s = Math.abs(Math.sin(angle * Math.PI / 180));
  let width = settings.aspectRatioLocked ? Math.max(Number.EPSILON, rect.width) : limit(rect.width, 1, size.width);
  let height = settings.aspectRatioLocked ? Math.max(Number.EPSILON, rect.height) : limit(rect.height, 1, size.height);
  const shrink = Math.min(1, size.width / (width * c + height * s), size.height / (width * s + height * c));
  width *= shrink; height *= shrink;
  const halfX = (width * c + height * s) / 2, halfY = (width * s + height * c) / 2;
  const center = rotate({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, size, -angle);
  const bounded = rotate({ x: limit(center.x, halfX, size.width - halfX), y: limit(center.y, halfY, size.height - halfY) }, size, angle);
  return { x: bounded.x - width / 2, y: bounded.y - height / 2, width, height };
}

export const CROP_HANDLES = ["top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"] as const;
export type CropHandle = typeof CROP_HANDLES[number];

export function resizeSelection(start: Rectangle, handle: CropHandle, delta: Point, locked: boolean): Rectangle {
  const west = handle.includes("left"), east = handle.includes("right");
  const north = handle.includes("top"), south = handle.includes("bottom");
  let width = Math.max(1, start.width + (east ? delta.x : west ? -delta.x : 0));
  let height = Math.max(1, start.height + (south ? delta.y : north ? -delta.y : 0));
  if (locked) {
    const ratio = start.width / start.height;
    if (!(east || west) || ((north || south) && Math.abs(delta.y) * ratio > Math.abs(delta.x))) width = height * ratio;
    else height = width / ratio;
  }
  return {
    x: west ? start.x + start.width - width : east ? start.x : start.x + (start.width - width) / 2,
    y: north ? start.y + start.height - height : south ? start.y : start.y + (start.height - height) / 2,
    width, height,
  };
}

export function frameDimensions(edits: ImageEditorEdits, image: Dimensions, showOriginal = false): Dimensions {
  const commit = !showOriginal && edits.crop.committed ? edits.crop.commit : undefined;
  return commit ? { width: commit.outputWidth, height: commit.outputHeight } : image;
}

export function fitView(image: Dimensions, viewport: Viewport): Camera {
  const scale = Math.max(0.001, Math.min(1,
    Math.max(1, viewport.width - 48) / Math.max(1, image.width),
    Math.max(1, viewport.height - viewport.coveredHeight - 48) / Math.max(1, image.height)));
  return { scale, origin: {
    x: Math.round((viewport.width - image.width * scale) / 2),
    y: Math.round((viewport.height - image.height * scale) / 2),
  } };
}

export function boundView(camera: Camera, image: Dimensions, viewport: Viewport): Camera {
  const scale = limit(camera.scale, 0.001, 32);
  const horizontal = viewport.width - image.width * scale, vertical = viewport.height - image.height * scale;
  return { scale, origin: {
    x: limit(camera.origin.x, Math.min(0, horizontal), Math.max(0, horizontal)),
    y: limit(camera.origin.y, Math.min(0, vertical), Math.max(0, vertical)),
  } };
}

/** Compute at a layout/fit boundary, never again for each pointer movement. */
export function trayDisplacement(camera: Camera, image: Dimensions, viewport: Viewport): number {
  if (!viewport.coveredHeight) return 0;
  return Math.min(0, viewport.height - viewport.coveredHeight - 24 - camera.origin.y - image.height * camera.scale);
}

export function visibleView(camera: Camera, displacement: number): Camera {
  return { scale: camera.scale, origin: { x: camera.origin.x, y: camera.origin.y + displacement } };
}

/** Clamp what the user sees against the usable viewport, then undo its offset. */
export function boundPresentedView(camera: Camera, displacement: number, image: Dimensions, viewport: Viewport): Camera {
  const view = visibleView(camera, displacement);
  const scale = limit(view.scale, 0.001, 32);
  const height = Math.max(1, viewport.height - viewport.coveredHeight);
  const paddingX = Math.min(24, viewport.width / 2), paddingY = Math.min(24, height / 2);
  const right = viewport.width - image.width * scale - paddingX;
  const bottom = height - image.height * scale - paddingY;
  view.origin.x = limit(view.origin.x, Math.min(paddingX, right), Math.max(paddingX, right));
  view.origin.y = limit(view.origin.y, Math.min(paddingY, bottom), Math.max(paddingY, bottom));
  return { scale, origin: { x: view.origin.x, y: view.origin.y - displacement } };
}

export function frameToCanvas(point: Point, camera: Camera): Point {
  return { x: point.x * camera.scale + camera.origin.x, y: point.y * camera.scale + camera.origin.y };
}

export function canvasToFrame(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.origin.x) / camera.scale, y: (point.y - camera.origin.y) / camera.scale };
}
