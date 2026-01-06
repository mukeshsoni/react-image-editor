import { applyLightAdjustmentsToRgbaBytes } from "@/lib/light-adjustments";

import type { PixelProcessor } from "../processor";

const hasAnyLightAdjustment = (adjustments: {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
}): boolean =>
  adjustments.exposure !== 0 ||
  adjustments.contrast !== 0 ||
  adjustments.highlights !== 0 ||
  adjustments.shadows !== 0 ||
  adjustments.whites !== 0 ||
  adjustments.blacks !== 0;

export const lightProcessor = {
  id: "light",
  order: 20,
  isEnabled: (context) =>
    context.lightAdjustments != null && hasAnyLightAdjustment(context.lightAdjustments),
  apply: (buffers, context) => {
    if (!context.lightAdjustments) {
      buffers.out.set(buffers.in);
      return;
    }

    applyLightAdjustmentsToRgbaBytes(buffers.in, buffers.temp, context.lightAdjustments);
    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
