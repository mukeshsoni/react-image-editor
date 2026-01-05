import type {
  CurvePoint,
  ToneCurveChannel,
  ToneCurveParametricSettings,
  ToneCurveSettings,
} from "../store/cropStore";

export type ToneCurveLuts = {
  master: Uint8Array;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
};

const DEFAULT_LUT_SIZE = 256;
const MIN_POINT_DISTANCE = 1e-4;

export function hasNonNeutralToneCurve(settings: ToneCurveSettings): boolean {
  if (settings.mode === "parametric") {
    const { highlights, lights, darks, shadows } = settings.parametric.rgb;
    if (highlights !== 0 || lights !== 0 || darks !== 0 || shadows !== 0) {
      return true;
    }
  }

  return (
    !isIdentityPoints(settings.point.rgb) ||
    !isIdentityPoints(settings.point.r) ||
    !isIdentityPoints(settings.point.g) ||
    !isIdentityPoints(settings.point.b)
  );
}

export function validateToneCurvePoints(points: CurvePoint[]): CurvePoint[] {
  const sanitized = points
    .map((point) => ({
      x: clamp01(point.x),
      y: clamp01(point.y),
    }))
    .sort((a, b) => a.x - b.x);

  const withEndpoints = ensureEndpoints(sanitized);
  const deduped = enforceIncreasingX(withEndpoints);

  return deduped;
}

export function createToneCurveLuts(
  settings: ToneCurveSettings,
  size: number = DEFAULT_LUT_SIZE,
): ToneCurveLuts {
  const master =
    settings.mode === "parametric"
      ? createParametricToneCurveLut(settings.parametric.rgb, size)
      : createPointToneCurveLut(settings.point.rgb, size);

  return {
    master,
    r: createPointToneCurveLut(settings.point.r, size),
    g: createPointToneCurveLut(settings.point.g, size),
    b: createPointToneCurveLut(settings.point.b, size),
  };
}

export function applyToneCurveToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  luts: ToneCurveLuts,
): void {
  if (output.length !== input.length) {
    throw new Error("Output buffer must match input length");
  }

  const { master, r, g, b } = luts;

  for (let i = 0; i < input.length; i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    const rm = master[r0] ?? r0;
    const gm = master[g0] ?? g0;
    const bm = master[b0] ?? b0;

    output[i] = r[rm] ?? rm;
    output[i + 1] = g[gm] ?? gm;
    output[i + 2] = b[bm] ?? bm;
    output[i + 3] = a0;
  }
}

export function createPointToneCurveLut(
  points: CurvePoint[],
  size: number = DEFAULT_LUT_SIZE,
): Uint8Array {
  const validated = validateToneCurvePoints(points);
  const evaluated = evaluateMonotoneCubic(validated);

  const lut = new Uint8Array(size);
  const maxIndex = size - 1;

  for (let i = 0; i < size; i += 1) {
    const x = maxIndex === 0 ? 0 : i / maxIndex;
    const y = clamp01(evaluated(x));
    lut[i] = floatToByte(y);
  }

  return lut;
}

export function createParametricToneCurveLut(
  settings: ToneCurveParametricSettings,
  size: number = DEFAULT_LUT_SIZE,
): Uint8Array {
  const lut = new Uint8Array(size);
  const maxIndex = size - 1;

  const highlights = clamp(settings.highlights / 100, -1, 1);
  const lights = clamp(settings.lights / 100, -1, 1);
  const darks = clamp(settings.darks / 100, -1, 1);
  const shadows = clamp(settings.shadows / 100, -1, 1);

  for (let i = 0; i < size; i += 1) {
    const x = maxIndex === 0 ? 0 : i / maxIndex;

    const shadowsMask = 1 - smoothstep(0.0, 0.35, x);
    const darksMask = windowMask(0.05, 0.25, 0.45, 0.65, x);
    const lightsMask = windowMask(0.35, 0.55, 0.75, 0.95, x);
    const highlightsMask = smoothstep(0.65, 1.0, x);

    // The coefficients are intentionally conservative for v1.
    const offset =
      shadows * shadowsMask * 0.25 +
      darks * darksMask * 0.2 +
      lights * lightsMask * 0.2 +
      highlights * highlightsMask * 0.25;

    lut[i] = floatToByte(clamp01(x + offset));
  }

  return lut;
}

export function getToneCurveChannelColor(channel: ToneCurveChannel): string {
  switch (channel) {
    case "r":
      return "#ef4444";
    case "g":
      return "#22c55e";
    case "b":
      return "#3b82f6";
    default:
      return "#111827";
  }
}

function isIdentityPoints(points: CurvePoint[]): boolean {
  if (points.length !== 2) return false;

  const [p0, p1] = points;
  if (!p0 || !p1) return false;

  return (
    Math.abs(p0.x - 0) < 1e-6 &&
    Math.abs(p0.y - 0) < 1e-6 &&
    Math.abs(p1.x - 1) < 1e-6 &&
    Math.abs(p1.y - 1) < 1e-6
  );
}

function ensureEndpoints(points: CurvePoint[]): CurvePoint[] {
  const output = points.filter((point) => point.x > 0 && point.x < 1);

  output.unshift({ x: 0, y: 0 });
  output.push({ x: 1, y: 1 });

  return output;
}

function enforceIncreasingX(points: CurvePoint[]): CurvePoint[] {
  const output: CurvePoint[] = [];
  let prevX = -Infinity;

  for (const point of points) {
    const x = Math.max(point.x, prevX + MIN_POINT_DISTANCE);
    const clampedX = clamp(x, 0, 1);

    output.push({ x: clampedX, y: clamp01(point.y) });
    prevX = clampedX;
  }

  // Ensure endpoints remain exact.
  if (output.length > 0) {
    output[0] = { x: 0, y: 0 };
  }
  if (output.length >= 2) {
    output[output.length - 1] = { x: 1, y: 1 };
  }

  return output;
}

function evaluateMonotoneCubic(points: CurvePoint[]): (x: number) => number {
  const n = points.length;

  if (n < 2) {
    return (x) => clamp01(x);
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  const h: number[] = [];
  const delta: number[] = [];

  for (let i = 0; i < n - 1; i += 1) {
    const dx = xs[i + 1]! - xs[i]!;
    h[i] = Math.max(dx, MIN_POINT_DISTANCE);
    delta[i] = (ys[i + 1]! - ys[i]!) / h[i]!;
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = delta[0] ?? 0;
  m[n - 1] = delta[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i += 1) {
    const d0 = delta[i - 1] ?? 0;
    const d1 = delta[i] ?? 0;

    if (d0 === 0 || d1 === 0 || d0 * d1 < 0) {
      m[i] = 0;
      continue;
    }

    const h0 = h[i - 1] ?? 1;
    const h1 = h[i] ?? 1;

    // Weighted harmonic mean.
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
  }

  // Fritsch-Carlson slope limiting.
  for (let i = 0; i < n - 1; i += 1) {
    const d = delta[i] ?? 0;
    if (d === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }

    const a = (m[i] ?? 0) / d;
    const b = (m[i + 1] ?? 0) / d;
    const norm = a * a + b * b;

    if (norm > 9) {
      const t = 3 / Math.sqrt(norm);
      m[i] = t * a * d;
      m[i + 1] = t * b * d;
    }
  }

  return (x0: number) => {
    const x = clamp01(x0);

    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;

    let idx = 0;
    for (let i = 0; i < n - 1; i += 1) {
      if (x >= xs[i]! && x <= xs[i + 1]!) {
        idx = i;
        break;
      }
    }

    const x1 = xs[idx]!;
    const x2 = xs[idx + 1]!;
    const y1 = ys[idx]!;
    const y2 = ys[idx + 1]!;

    const hSeg = Math.max(x2 - x1, MIN_POINT_DISTANCE);
    const t = (x - x1) / hSeg;

    const m1 = m[idx] ?? 0;
    const m2 = m[idx + 1] ?? 0;

    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return (
      h00 * y1 + h10 * hSeg * m1 + h01 * y2 + h11 * hSeg * m2
    );
  };
}

function windowMask(a0: number, a1: number, b0: number, b1: number, x: number): number {
  return smoothstep(a0, a1, x) * (1 - smoothstep(b0, b1, x));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;

  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function floatToByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
