import {
  applyColorAdjustmentsToRgbaBytes,
  hasNonNeutralColorAdjustments,
} from "@/lib/color-adjustments";

import type { PixelProcessor } from "../processor";

export const colorProcessor = {
  id: "color",
  order: 40,
  isEnabled: (context) =>
    context.colorAdjustments != null &&
    hasNonNeutralColorAdjustments(context.colorAdjustments),
  apply: (buffers, context) => {
    if (!context.colorAdjustments) {
      buffers.out.set(buffers.in);
      return;
    }

    applyColorAdjustmentsToRgbaBytes(buffers.in, buffers.temp, context.colorAdjustments);
    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
