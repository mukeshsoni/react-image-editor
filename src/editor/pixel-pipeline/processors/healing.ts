import type { Point } from "@/store/cropStore";
import type { HealingOp } from "@/store/healingStore";

import type { PixelProcessor } from "../processor";

export type HealingCanvasOp = {
  id: string;
  type: "spot" | "stroke";
  mode: "spot" | "heal" | "clone";
  center?: Point;
  points?: Point[];
  radiusPx: number;
  feather: number;
  opacity: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyCircularClone(params: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  center: Point;
  radiusPx: number;
  feather: number;
  opacity: number;
  sourceOffset: Point;
}): void {
  const { pixels, width, height, center, radiusPx, feather, opacity, sourceOffset } = params;

  if (radiusPx <= 0 || opacity <= 0) {
    return;
  }

  const maxX = width - 1;
  const maxY = height - 1;

  const r = radiusPx;
  const rSq = r * r;

  const hardRadius = r * (1 - Math.max(0, Math.min(100, feather)) / 100);
  const softRange = Math.max(1e-6, r - hardRadius);

  const minX = Math.max(0, Math.floor(center.x - r));
  const minY = Math.max(0, Math.floor(center.y - r));
  const maxBX = Math.min(maxX, Math.ceil(center.x + r));
  const maxBY = Math.min(maxY, Math.ceil(center.y + r));

  for (let y = minY; y <= maxBY; y++) {
    for (let x = minX; x <= maxBX; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > rSq) continue;

      const dist = Math.sqrt(distSq);

      let mask = 1;
      if (dist > hardRadius) {
        mask = 1 - (dist - hardRadius) / softRange;
      }
      const alpha = Math.max(0, Math.min(1, opacity / 255));
      mask = Math.max(0, Math.min(1, mask)) * alpha;
      if (mask <= 0) continue;

      const sx = Math.max(0, Math.min(maxX, Math.round(x + sourceOffset.x)));
      const sy = Math.max(0, Math.min(maxY, Math.round(y + sourceOffset.y)));

      const dstIndex = (y * width + x) * 4;
      const srcIndex = (sy * width + sx) * 4;

      const dr = pixels[dstIndex];
      const dg = pixels[dstIndex + 1];
      const db = pixels[dstIndex + 2];
      const da = pixels[dstIndex + 3];

      const sr = pixels[srcIndex];
      const sg = pixels[srcIndex + 1];
      const sb = pixels[srcIndex + 2];
      const sa = pixels[srcIndex + 3];

      pixels[dstIndex] = clampByte(dr * (1 - mask) + sr * mask);
      pixels[dstIndex + 1] = clampByte(dg * (1 - mask) + sg * mask);
      pixels[dstIndex + 2] = clampByte(db * (1 - mask) + sb * mask);
      pixels[dstIndex + 3] = clampByte(da * (1 - mask) + sa * mask);
    }
  }
}

export function projectHealingOpsToCanvas(params: {
  ops: HealingOp[];
  imageSize: { width: number; height: number };
  draw: {
    zoomLevel: number;
    offset: Point;
    rotationDegrees: number;
  };
}): HealingCanvasOp[] {
  const { ops, imageSize, draw } = params;
  if (ops.length === 0) return [];

  const imageCenter = {
    x: draw.offset.x + (imageSize.width * draw.zoomLevel) / 2,
    y: draw.offset.y + (imageSize.height * draw.zoomLevel) / 2,
  };

  const radians = (draw.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const rotate = (p: Point): Point => {
    const dx = p.x - imageCenter.x;
    const dy = p.y - imageCenter.y;

    return {
      x: dx * cos - dy * sin + imageCenter.x,
      y: dx * sin + dy * cos + imageCenter.y,
    };
  };

  const imageToCanvas = (p: Point): Point => {
    const unrotated = {
      x: draw.offset.x + p.x * draw.zoomLevel,
      y: draw.offset.y + p.y * draw.zoomLevel,
    };

    return rotate(unrotated);
  };

  return ops.map((op) => {
    if (op.type === "spot") {
      return {
        id: op.id,
        type: "spot",
        mode: op.mode,
        center: imageToCanvas(op.center),
        radiusPx: op.radius * draw.zoomLevel,
        feather: op.feather,
        opacity: op.opacity,
      };
    }

    return {
      id: op.id,
      type: "stroke",
      mode: op.mode,
      points: op.points.map(imageToCanvas),
      radiusPx: op.radius * draw.zoomLevel,
      feather: op.feather,
      opacity: op.opacity,
    };
  });
}

export const healingProcessor = {
  id: "healing",
  order: 1,
  isEnabled: (context) => (context.healingOps?.length ?? 0) > 0,
  apply: (buffers, context) => {
    const width = context.width;
    const height = context.height;
    const ops = context.healingOps;

    if (!width || !height || !ops || ops.length === 0) {
      buffers.out.set(buffers.in);
      return;
    }

    buffers.out.set(buffers.in);
    const pixels = buffers.out;

    for (const op of ops) {
      const radiusPx = op.radiusPx;
      const feather = op.feather;
      const opacity = op.opacity;

      const sourceOffset: Point = {
        x: Math.max(8, radiusPx * 2),
        y: 0,
      };

      if (op.type === "spot" && op.center) {
        applyCircularClone({
          pixels,
          width,
          height,
          center: op.center,
          radiusPx,
          feather,
          opacity,
          sourceOffset,
        });
        continue;
      }

      if (op.type === "stroke" && op.points && op.points.length > 0) {
        for (const point of op.points) {
          applyCircularClone({
            pixels,
            width,
            height,
            center: point,
            radiusPx,
            feather,
            opacity,
            sourceOffset,
          });
        }
      }
    }
  },
} satisfies PixelProcessor;
