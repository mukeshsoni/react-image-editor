export type AutoStraightenResult = {
  degrees: number;
  confidence: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(degrees: number): number {
  let angle = degrees;
  while (angle <= -180) angle += 360;
  while (angle > 180) angle -= 360;
  return angle;
}

/**
 * Estimates the horizon tilt by accumulating gradient orientations.
 *
 * `grays` is a row-major 8-bit luminance buffer of size `width * height`.
 *
 * Convention: Positive degrees means clockwise rotation to *correct* the image.
 */
export function estimateStraightenDegreesFromLuminance(
  grays: Uint8Array,
  width: number,
  height: number,
): AutoStraightenResult {
  if (width < 8 || height < 8) {
    return { degrees: 0, confidence: 0 };
  }

  // Accumulate line angles near-horizontal in a weighted histogram.
  // We use gradient orientation (perpendicular to edges) and convert to edge direction.
  const BIN_COUNT = 181; // -90..90 inclusive
  const histogram = new Float64Array(BIN_COUNT);

  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));

  for (let y = 1; y < height - 1; y += step) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += step) {
      const idx = row + x;

      // Sobel-ish gradient (cheap approximation).
      const gx =
        grays[idx + 1] -
        grays[idx - 1] +
        0.5 * (grays[idx + width + 1] - grays[idx + width - 1]) +
        0.5 * (grays[idx - width + 1] - grays[idx - width - 1]);

      const gy =
        grays[idx + width] -
        grays[idx - width] +
        0.5 * (grays[idx + width + 1] - grays[idx - width + 1]) +
        0.5 * (grays[idx + width - 1] - grays[idx - width - 1]);

      const magnitude = Math.hypot(gx, gy);
      if (magnitude < 40) continue; // ignore weak gradients

      // Gradient angle: [-180..180]. Edge direction is gradient - 90deg.
      const gradientDeg = (Math.atan2(gy, gx) * 180) / Math.PI;
      let edgeDeg = normalizeDegrees(gradientDeg - 90);

      // Map to [-90..90] (undirected line).
      if (edgeDeg < -90) edgeDeg += 180;
      if (edgeDeg > 90) edgeDeg -= 180;

      // Keep near-horizontal contributions. (±30°)
      if (Math.abs(edgeDeg) > 30) continue;

      const bin = Math.round(edgeDeg) + 90;
      histogram[bin] += magnitude;
    }
  }

  let bestBin = 90;
  let bestWeight = 0;
  let totalWeight = 0;
  for (let i = 0; i < BIN_COUNT; i += 1) {
    const w = histogram[i];
    totalWeight += w;
    if (w > bestWeight) {
      bestWeight = w;
      bestBin = i;
    }
  }

  if (totalWeight <= 0) {
    return { degrees: 0, confidence: 0 };
  }

  // Weighted mean around peak for stability.
  let sum = 0;
  let sumW = 0;
  for (let offset = -2; offset <= 2; offset += 1) {
    const i = clamp(bestBin + offset, 0, BIN_COUNT - 1);
    const w = histogram[i];
    sum += (i - 90) * w;
    sumW += w;
  }

  const estimatedEdgeDeg = sumW > 0 ? sum / sumW : bestBin - 90;
  const confidence = clamp(bestWeight / totalWeight, 0, 1);

  // If edges slope up to the right (positive), we need to rotate counter-clockwise (negative).
  // So correction is the negative of the measured edge angle.
  return {
    degrees: clamp(-estimatedEdgeDeg, -45, 45),
    confidence,
  };
}

export function extractLuminance(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < out.length; p += 1, i += 4) {
    // Simple Rec.709 luma approximation.
    out[p] = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) | 0;
  }
  return out;
}

export function downscaleLuminanceNearest(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  maxSize: number,
): { grays: Uint8Array; width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(srcWidth, srcHeight));
  const width = Math.max(8, Math.floor(srcWidth * scale));
  const height = Math.max(8, Math.floor(srcHeight * scale));

  const grays = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(srcHeight - 1, Math.floor((y / height) * srcHeight));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(srcWidth - 1, Math.floor((x / width) * srcWidth));
      grays[y * width + x] = src[srcY * srcWidth + srcX];
    }
  }

  return { grays, width, height };
}
