import type { LightAdjustments } from "../store/cropStore";

/**
 * Light adjustment pipeline for RGBA pixels.
 *
 * Internal representation:
 * - Convert channel bytes (0–255) to floats (0–1) for math/curves.
 * - Convert back to bytes with clamp.
 *
 * This module is intentionally pure (no DOM/canvas usage) so it can be reused
 * for preview rendering and export.
 */

export function applyLightAdjustmentsToImageData(
  imageData: ImageData,
  adjustments: LightAdjustments,
): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  applyLightAdjustmentsToRgbaBytes(data, output, adjustments);

  return new ImageData(output, width, height);
}

export function applyLightAdjustmentsToRgbaBytes(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  adjustments: LightAdjustments,
): void {
  if (output.length !== input.length) {
    throw new Error("Output buffer must match input length");
  }

  const exposureFactor = Math.pow(2, adjustments.exposure);
  const contrastSlope = contrastToSlope(adjustments.contrast);

  const highlightsAmount = adjustments.highlights / 100;
  const shadowsAmount = adjustments.shadows / 100;
  const whitesAmount = adjustments.whites / 100;
  const blacksAmount = adjustments.blacks / 100;

  for (let i = 0; i < input.length; i += 4) {
    const r0 = input[i] ?? 0;
    const g0 = input[i + 1] ?? 0;
    const b0 = input[i + 2] ?? 0;
    const a0 = input[i + 3] ?? 0;

    // Convert to 0..1 floats
    let r = (r0 / 255) * exposureFactor;
    let g = (g0 / 255) * exposureFactor;
    let b = (b0 / 255) * exposureFactor;

    // Contrast around 0.5 pivot.
    r = applyContrast(r, contrastSlope);
    g = applyContrast(g, contrastSlope);
    b = applyContrast(b, contrastSlope);

    // Luma-based masking for tonal controls.
    const luma = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);

    // Highlights: affect upper midtones -> whites.
    const highlightsMask = smoothstep(0.55, 1.0, luma);
    // Shadows: affect blacks -> lower midtones.
    const shadowsMask = 1 - smoothstep(0.0, 0.45, luma);

    // Whites/Blacks: narrower endpoint masks.
    const whitesMask = smoothstep(0.75, 1.0, luma);
    const blacksMask = 1 - smoothstep(0.0, 0.25, luma);

    // Apply adjustments as additive exposure-like offsets in luma space.
    // This is a simple, fast approximation; can be replaced with curves later.
    const tonalOffset =
      highlightsAmount * highlightsMask * 0.35 +
      shadowsAmount * shadowsMask * 0.35 +
      whitesAmount * whitesMask * 0.5 +
      blacksAmount * blacksMask * 0.5;

    r = clamp01(r + tonalOffset);
    g = clamp01(g + tonalOffset);
    b = clamp01(b + tonalOffset);

    output[i] = floatToByte(r);
    output[i + 1] = floatToByte(g);
    output[i + 2] = floatToByte(b);
    output[i + 3] = a0; // preserve alpha
  }
}

function contrastToSlope(contrast: number): number {
  // contrast: [-100..100] where 0 means identity.
  // Map to slope: [0..2].
  return Math.max(0, Math.min(2, 1 + contrast / 100));
}

function applyContrast(value: number, slope: number): number {
  return clamp01((value - 0.5) * slope + 0.5);
}

function floatToByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;

  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
