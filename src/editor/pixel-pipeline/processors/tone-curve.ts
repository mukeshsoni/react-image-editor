import {
  applyToneCurveToRgbaBytes,
  createToneCurveLuts,
  hasNonNeutralToneCurve,
} from "@/lib/tone-curve";

import type { ToneCurveLuts } from "@/lib/tone-curve";

import type { PixelProcessor } from "../processor";

type ToneCurveCache = {
  key: string;
  luts: ToneCurveLuts;
};

let cache: ToneCurveCache | null = null;

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

    const key = JSON.stringify(context.toneCurve);

    if (!cache || cache.key !== key) {
      cache = {
        key,
        luts: createToneCurveLuts(context.toneCurve),
      };
    }

    applyToneCurveToRgbaBytes(buffers.in, buffers.temp, cache.luts);
    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
