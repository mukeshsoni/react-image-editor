import { applyWhiteBalanceToRgbaBytes, hasNonNeutralWhiteBalance } from "@/lib/white-balance";

import type { PixelProcessor } from "../processor";

export const whiteBalanceProcessor = {
  id: "white-balance",
  order: 10,
  isEnabled: (context) =>
    context.whiteBalance != null && hasNonNeutralWhiteBalance(context.whiteBalance),
  apply: (buffers, context) => {
    if (!context.whiteBalance) {
      buffers.out.set(buffers.in);
      return;
    }

    applyWhiteBalanceToRgbaBytes(buffers.in, buffers.out, context.whiteBalance);
  },
} satisfies PixelProcessor;
