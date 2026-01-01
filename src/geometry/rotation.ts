export type RectSize = { width: number; height: number };

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function getMaxInnerAxisAlignedRectSize(
  width: number,
  height: number,
  rotationDegrees: number,
): RectSize {
  const radians = Math.abs(degreesToRadians(rotationDegrees));
  if (radians === 0) return { width, height };

  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const epsilon = 1e-6;
  const cos2 = cos * cos - sin * sin;

  // At ~45° the constraints become nearly parallel; pick the largest centered square.
  if (Math.abs(cos2) < epsilon) {
    const limit = Math.min(halfWidth, halfHeight);
    const halfSide = limit / (2 * cos);

    return { width: halfSide * 2, height: halfSide * 2 };
  }

  type Candidate = { x: number; y: number };
  const candidates: Candidate[] = [];

  // Intersection of the two active constraints.
  candidates.push({
    x: (halfWidth * cos - halfHeight * sin) / cos2,
    y: (halfHeight * cos - halfWidth * sin) / cos2,
  });

  // Optimum along each constraint boundary.
  if (sin > epsilon) {
    candidates.push({ x: halfWidth / (2 * cos), y: halfWidth / (2 * sin) });
    candidates.push({ x: halfHeight / (2 * sin), y: halfHeight / (2 * cos) });
  }

  function isFeasible({ x, y }: Candidate): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x <= 0 || y <= 0) return false;

    // For a centered axis-aligned rectangle, it’s sufficient to ensure the
    // first-quadrant corner is inside the rotated rect.
    return (
      x * cos + y * sin <= halfWidth + epsilon &&
      x * sin + y * cos <= halfHeight + epsilon
    );
  }

  let best: Candidate | null = null;
  let bestArea = -1;

  for (const candidate of candidates) {
    if (!isFeasible(candidate)) continue;

    const area = candidate.x * candidate.y;
    if (area > bestArea) {
      bestArea = area;
      best = candidate;
    }
  }

  if (!best) return { width: 0, height: 0 };

  return { width: best.x * 2, height: best.y * 2 };
}
