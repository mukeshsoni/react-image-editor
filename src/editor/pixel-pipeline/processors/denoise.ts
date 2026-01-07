import { applyDenoiseToRgbaBytes, createDenoiseBuffers, isNeutralDenoise } from "@/lib/denoise";

import type { DenoiseSettings } from "@/store/cropStore";

import type { PixelProcessor } from "../processor";

let cache: {
  pixelCount: number;
  buffers: ReturnType<typeof createDenoiseBuffers>;
} | null = null;

export const denoiseProcessor = {
  id: "denoise",
  order: 45,
  isEnabled: (context) => context.denoise != null && !isNeutralDenoise(context.denoise),
  apply: (buffers, context) => {
    const settings = context.denoise;
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
        buffers: createDenoiseBuffers(pixelCount),
      };
    }

    applyDenoiseToRgbaBytes(
      buffers.in,
      buffers.temp,
      width,
      height,
      settings as DenoiseSettings,
      cache.buffers,
    );

    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
