import type { ImageEditorEdits } from "./edits";
import type { EditorSerializableState } from "./historyStore";

function areJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function areEditsEqual(a: ImageEditorEdits, b: ImageEditorEdits): boolean {
  return areJsonEqual(a, b);
}

export function createEditorSerializableState(params: {
  edits: ImageEditorEdits;
  zoomLevel: number;
  offset: { x: number; y: number };
}): EditorSerializableState {
  return {
    edits: params.edits,
    camera: {
      zoomLevel: params.zoomLevel,
      offset: {
        x: params.offset.x,
        y: params.offset.y,
      },
    },
  };
}

export function getHistoryLabelForEditsChange(
  previous: ImageEditorEdits | null,
  next: ImageEditorEdits,
): string {
  if (!previous) {
    return "Edit";
  }

  if (!areJsonEqual(previous.crop.settings, next.crop.settings)) {
    if (previous.crop.settings.rotation !== next.crop.settings.rotation) {
      return "Rotate";
    }

    return "Crop";
  }

  if (!areJsonEqual(previous.crop.rect, next.crop.rect)) {
    return "Crop";
  }

  if (!areJsonEqual(previous.whiteBalance, next.whiteBalance)) {
    return "White Balance";
  }

  if (!areJsonEqual(previous.light, next.light)) {
    return "Tone";
  }

  if (!areJsonEqual(previous.color, next.color)) {
    return "Color";
  }

  if (!areJsonEqual(previous.toneCurve, next.toneCurve)) {
    return "Tone Curve";
  }

  if (!areJsonEqual(previous.sharpening, next.sharpening)) {
    return "Sharpening";
  }

  if (!areJsonEqual(previous.denoise, next.denoise)) {
    return "Denoise";
  }

  return "Edit";
}
