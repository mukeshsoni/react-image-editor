import { applySharpeningToRgbaBytes, createSharpeningBuffers, isNeutralSharpening } from "@/lib/sharpening";

import type { SharpeningSettings } from "@/store/cropStore";

import type { PixelProcessor } from "../processor";

let cache: {
  pixelCount: number;
  buffers: ReturnType<typeof createSharpeningBuffers>;
} | null = null;

export const sharpeningProcessor = {
  id: "sharpening",
  order: 50,
  isEnabled: (context) =>
    context.sharpening != null && !isNeutralSharpening(context.sharpening),
  apply: (buffers, context) => {
    const settings = context.sharpening;
    if (!settings) {
      buffers.out.set(buffers.in);
      return;
    }

    const width = context.width;
    const height = context.height;

    if (!width || !height) {
      buffers.out.set(buffers.in);
      return;
    }

    const pixelCount = width * height;

    if (!cache || cache.pixelCount !== pixelCount) {
      cache = {
        pixelCount,
        buffers: createSharpeningBuffers(pixelCount),
      };
    }

    applySharpeningToRgbaBytes(
      buffers.in,
      buffers.temp,
      width,
      height,
      settings as SharpeningSettings,
      cache.buffers,
    );

    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
