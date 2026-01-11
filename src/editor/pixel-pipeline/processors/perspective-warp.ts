import { getKeystoneHomography, warpImageDataWithHomography } from "@/geometry/perspective";

import type { PixelProcessor } from "../processor";

export const perspectiveWarpProcessor = {
  id: "perspective-warp",
  order: 5,
  isEnabled: (context) => {
    const p = context.geometryOptics?.perspective;
    if (!p) return false;
    return p.vertical !== 0 || p.horizontal !== 0 || (p.aspect ?? 0) !== 0;
  },
  apply: (buffers, context) => {
    const width = context.width;
    const height = context.height;
    const perspective = context.geometryOptics?.perspective;

    if (!width || !height || !perspective) {
      buffers.out.set(buffers.in);
      return;
    }

    const matrix = getKeystoneHomography({
      vertical: perspective.vertical,
      horizontal: perspective.horizontal,
      aspect: perspective.aspect,
    });

    warpImageDataWithHomography(buffers.in, buffers.temp, width, height, matrix);
    buffers.out.set(buffers.temp);
  },
} satisfies PixelProcessor;
