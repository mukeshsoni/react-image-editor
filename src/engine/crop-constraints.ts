import type { CropSettings, Dimensions, GeometrySettings, Point, Rectangle } from "../model/types";
import { rotate } from "./geometry";
import { needsWarp, sourceCoordinate } from "./optics";

/** Further constrain an image-space crop after ordinary ratio/rotation containment. */
export function constrainWarpedCrop(rect: Rectangle, image: Dimensions, settings: CropSettings, geometry: GeometrySettings): Rectangle {
  if (settings.constrainCrop === false || !needsWarp(geometry)) return rect;
  if (image.width <= 1 || image.height <= 1 || rect.width <= 0 || rect.height <= 0) return rect;

  const rotation = settings.rotation ?? 0;
  const cx = (image.width - 1) / 2, cy = (image.height - 1) / 2;
  const rx = Math.max(1, cx), ry = Math.max(1, cy);
  const aspect = Math.exp((geometry.perspective.aspect ?? 0) / 180);
  const distortion = geometry.lensCorrections.distortion / 500;
  const perspective = { ...geometry, lensCorrections: { ...geometry.lensCorrections, distortion: 0 } };
  // Reserve room for rotated canvas interpolation and rounded export dimensions.
  let padding = Math.min(2, (Math.min(image.width, image.height) - 1) / 8);

  function fits(candidate: Rectangle): boolean {
    let maxX = 0, maxY = 0;
    for (const x of [candidate.x - padding, candidate.x + candidate.width + padding]) {
      for (const y of [candidate.y - padding, candidate.y + candidate.height + padding]) {
        const corrected = rotate({ x, y }, image, -rotation);
        if (!(corrected.x >= 0 && corrected.x <= image.width - 1 && corrected.y >= 0 && corrected.y <= image.height - 1)) return false;
        const nx = (corrected.x - cx) / rx / aspect, ny = (corrected.y - cy) / ry * aspect;
        // A projective horizon inside the rectangle invalidates its interior, even
        // when individual warped corners happen to land back inside the source.
        if (!(1 + nx * geometry.perspective.horizontal / 250 + ny * geometry.perspective.vertical / 250 > 0)) return false;
        const source = sourceCoordinate(corrected, image, perspective);
        maxX = Math.max(maxX, Math.abs((source.x - cx) / rx));
        maxY = Math.max(maxY, Math.abs((source.y - cy) / ry));
      }
    }
    // Perspective maps the entire boundary/interior into a convex quadrilateral.
    // Bound the nonlinear lens term over that whole region: checking only the
    // final warped corners misses extrema between them (especially barrel warp).
    const radial = Math.max(1, Math.abs(1 + distortion * (maxX * maxX + maxY * maxY)));
    return maxX * radial * rx <= cx && maxY * radial * ry <= cy;
  }

  function scaled(center: Point, scale: number): Rectangle {
    const width = rect.width * scale, height = rect.height * scale;
    return { x: center.x - width / 2, y: center.y - height / 2, width, height };
  }

  const safeCenter = rotate({ x: cx, y: cy }, image, rotation);
  // Very small images can have less than two pixels of interpolation margin.
  while (!fits(scaled(safeCenter, 0)) && padding > Number.EPSILON) padding /= 2;
  if (fits(rect)) return rect;
  let center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (!fits(scaled(center, 0))) center = safeCenter;
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 40; iteration++) {
    const scale = (low + high) / 2;
    if (fits(scaled(center, scale))) low = scale;
    else high = scale;
  }
  return scaled(center, Math.max(Number.EPSILON, low));
}
