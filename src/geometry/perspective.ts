export type PerspectiveParams = {
  vertical: number;
  horizontal: number;
  aspect?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Maps simplified vertical/horizontal keystone params (-100..100) to a 3x3
 * homography matrix.
 *
 * This is a deliberately simple model for v1, intended to be "good enough" for
 * obvious corrections. It can be replaced by a more accurate solve later.
 */
export function getKeystoneHomography(params: PerspectiveParams): number[] {
  const v = clamp(params.vertical, -100, 100) / 100;
  const h = clamp(params.horizontal, -100, 100) / 100;
  const aspect = clamp(params.aspect ?? 0, -100, 100) / 100;

  // Create a projective transform with small perspective terms.
  // We keep the center relatively stable by using symmetric offsets.
  const px = h * 0.0025;
  const py = v * 0.0025;

  // Aspect acts as a non-uniform scale (Lightroom-style).
  // Use a stronger factor so changes are visually obvious.
  const sx = clamp(1 + aspect * 0.6, 0.2, 5);
  const sy = clamp(1 / sx, 0.2, 5);

  // 3x3 row-major homography.
  return [
    sx,
    0,
    0,
    0,
    sy,
    0,
    px,
    py,
    1,
  ];
}

export function applyHomography(
  matrix: number[],
  x: number,
  y: number,
): { x: number; y: number } {
  const a = matrix[0] ?? 1;
  const b = matrix[1] ?? 0;
  const c = matrix[2] ?? 0;
  const d = matrix[3] ?? 0;
  const e = matrix[4] ?? 1;
  const f = matrix[5] ?? 0;
  const g = matrix[6] ?? 0;
  const h = matrix[7] ?? 0;
  const i = matrix[8] ?? 1;

  const denom = g * x + h * y + i;
  if (denom === 0) {
    return { x, y };
  }

  return {
    x: (a * x + b * y + c) / denom,
    y: (d * x + e * y + f) / denom,
  };
}

export function warpImageDataWithHomography(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  matrix: number[],
): void {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  function sample(srcX: number, srcY: number, channel: number): number {
    const x0 = Math.floor(srcX);
    const y0 = Math.floor(srcY);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);

    const tx = srcX - x0;
    const ty = srcY - y0;

    const i00 = (y0 * width + x0) * 4 + channel;
    const i10 = (y0 * width + x1) * 4 + channel;
    const i01 = (y1 * width + x0) * 4 + channel;
    const i11 = (y1 * width + x1) * 4 + channel;

    const a00 = input[i00];
    const a10 = input[i10];
    const a01 = input[i01];
    const a11 = input[i11];

    const b0 = a00 + (a10 - a00) * tx;
    const b1 = a01 + (a11 - a01) * tx;
    return b0 + (b1 - b0) * ty;
  }

  // Inverse-mapping: for each destination pixel, sample source.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = applyHomography(matrix, x - cx, y - cy);
      const srcX = p.x + cx;
      const srcY = p.y + cy;

      const idx = (y * width + x) * 4;
      if (srcX < 0 || srcX > width - 1 || srcY < 0 || srcY > height - 1) {
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
        output[idx + 3] = 0;
        continue;
      }

      output[idx] = sample(srcX, srcY, 0);
      output[idx + 1] = sample(srcX, srcY, 1);
      output[idx + 2] = sample(srcX, srcY, 2);
      output[idx + 3] = sample(srcX, srcY, 3);
    }
  }
}
