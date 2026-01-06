import {
  applyToneCurveToRgbaBytes,
  createToneCurveLuts,
  hasNonNeutralToneCurve,
} from "@/lib/tone-curve";

import type { PixelProcessor } from "../processor";

export const toneCurveProcessor = {
  id: "tone-curve",
  order: 30,
  isEnabled: (context) =>
    context.toneCurve != null && hasNonNeutralToneCurve(context.toneCurve),
  apply: (buffers, context) => {
    if (!context.toneCurve) {
      buffers.out.set(buffers.in);
      return;
    }

    const luts = createToneCurveLuts(context.toneCurve);
    applyToneCurveToRgbaBytes(buffers.in, buffers.temp, luts);
    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
