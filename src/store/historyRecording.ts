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

function formatSignedInteger(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatSignedTenths(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;

  // Avoid noisy history entries like "+0.0".
  if (rounded === 0) return "0";

  const fixed = Math.abs(rounded).toFixed(1);
  return rounded > 0 ? `+${fixed}` : `-${fixed}`;
}

type HistoryDisplay = {
  label: string;
  delta?: string;
};

export function getHistoryDisplayForEditsChange(
  previous: ImageEditorEdits | null,
  next: ImageEditorEdits,
): HistoryDisplay {
  if (!previous) {
    return { label: "Edit" };
  }

  if (!areJsonEqual(previous.crop.settings, next.crop.settings)) {
    const previousRotation = previous.crop.settings.rotation ?? 0;
    const nextRotation = next.crop.settings.rotation ?? 0;
    if (previousRotation !== nextRotation) {
      return {
        label: "Rotate",
        delta: formatSignedInteger(nextRotation - previousRotation),
      };
    }

    return { label: "Crop" };
  }

  if (!areJsonEqual(previous.crop.rect, next.crop.rect)) {
    return { label: "Crop" };
  }

  if (!areJsonEqual(previous.whiteBalance, next.whiteBalance)) {
    if (previous.whiteBalance.temperatureKelvin !== next.whiteBalance.temperatureKelvin) {
      return {
        label: "Temperature",
        delta: formatSignedInteger(
          next.whiteBalance.temperatureKelvin - previous.whiteBalance.temperatureKelvin,
        ),
      };
    }

    if (previous.whiteBalance.tint !== next.whiteBalance.tint) {
      return {
        label: "Tint",
        delta: formatSignedInteger(next.whiteBalance.tint - previous.whiteBalance.tint),
      };
    }

    return { label: "White Balance" };
  }

  if (!areJsonEqual(previous.light, next.light)) {
    if (previous.light.exposure !== next.light.exposure) {
      return {
        label: "Exposure",
        delta: formatSignedTenths(next.light.exposure - previous.light.exposure),
      };
    }

    if (previous.light.contrast !== next.light.contrast) {
      return {
        label: "Contrast",
        delta: formatSignedInteger(next.light.contrast - previous.light.contrast),
      };
    }

    if (previous.light.highlights !== next.light.highlights) {
      return {
        label: "Highlights",
        delta: formatSignedInteger(next.light.highlights - previous.light.highlights),
      };
    }

    if (previous.light.shadows !== next.light.shadows) {
      return {
        label: "Shadows",
        delta: formatSignedInteger(next.light.shadows - previous.light.shadows),
      };
    }

    if (previous.light.whites !== next.light.whites) {
      return {
        label: "Whites",
        delta: formatSignedInteger(next.light.whites - previous.light.whites),
      };
    }

    if (previous.light.blacks !== next.light.blacks) {
      return {
        label: "Blacks",
        delta: formatSignedInteger(next.light.blacks - previous.light.blacks),
      };
    }

    return { label: "Tone" };
  }

  if (!areJsonEqual(previous.color, next.color)) {
    if (previous.color.vibrance !== next.color.vibrance) {
      return {
        label: "Vibrance",
        delta: formatSignedInteger(next.color.vibrance - previous.color.vibrance),
      };
    }

    if (previous.color.saturation !== next.color.saturation) {
      return {
        label: "Saturation",
        delta: formatSignedInteger(
          next.color.saturation - previous.color.saturation,
        ),
      };
    }

    return { label: "Color" };
  }

  if (!areJsonEqual(previous.toneCurve, next.toneCurve)) {
    return { label: "Tone Curve" };
  }

  if (!areJsonEqual(previous.sharpening, next.sharpening)) {
    return { label: "Sharpening" };
  }

  if (!areJsonEqual(previous.denoise, next.denoise)) {
    return { label: "Denoise" };
  }

  return { label: "Edit" };
}

export function getHistoryLabelForEditsChange(
  previous: ImageEditorEdits | null,
  next: ImageEditorEdits,
): string {
  return getHistoryDisplayForEditsChange(previous, next).label;
}
