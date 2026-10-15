import type { ImageEditorEdits, Point } from "../model/types";
import { adjustColor } from "./color";
import { reduceNoise, sharpen } from "./detail";
import { rotate } from "./geometry";
import { correctedCoordinate, geometryPass, opticalEffects, sourceCoordinate } from "./optics";
import { cloneRaster, sampleNeighborhood } from "./pixels";
import type { Raster, Triplet } from "./pixels";
import { repair } from "./repair";
import { toneAndBalance } from "./tone";

/** The point-color mask uses the hue at this stage, before any color adjustments. */
function pointColorInput(source: Raster, edits: ImageEditorEdits): Raster {
  let image = cloneRaster(source);
  repair(image, edits.healing.ops);
  image = geometryPass(image, edits.geometryOptics);
  toneAndBalance(image, edits);
  return image;
}

export function processPixels(source: Raster, edits: ImageEditorEdits): Raster {
  const image = pointColorInput(source, edits);
  adjustColor(image, edits.color);
  reduceNoise(image, edits.denoise);
  sharpen(image, edits.sharpening);
  opticalEffects(image, edits.geometryOptics.optics);
  return image;
}

function frameTransform(edits: ImageEditorEdits, cropEditing: boolean) {
  const commit = !cropEditing && edits.crop.committed ? edits.crop.commit : undefined;
  const rotation = cropEditing ? edits.crop.settings.rotation ?? 0 : commit?.rotationDegrees ?? 0;
  return { commit, rotation };
}

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable");
  return { canvas, context };
}

export class PhotoRenderer {
  readonly original: Raster;
  private filtered: { key: string; canvas: HTMLCanvasElement } | null = null;
  private framed: { key: string; canvas: HTMLCanvasElement } | null = null;

  constructor(image: HTMLImageElement) {
    const { canvas, context } = surface(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    this.original = { width: pixels.width, height: pixels.height, pixels: pixels.data };
  }

  private image(edits: ImageEditorEdits): HTMLCanvasElement {
    const key = JSON.stringify([edits.whiteBalance, edits.light, edits.color, edits.toneCurve.point,
      edits.toneCurve.mode, edits.toneCurve.parametric, edits.sharpening, edits.denoise, edits.geometryOptics, edits.healing.ops]);
    if (this.filtered?.key === key) return this.filtered.canvas;
    const result = processPixels(this.original, edits);
    const { canvas, context } = surface(result.width, result.height);
    const pixels = context.createImageData(result.width, result.height);
    pixels.data.set(result.pixels); context.putImageData(pixels, 0, 0);
    this.filtered = { key, canvas }; this.framed = null;
    return canvas;
  }

  frame(edits: ImageEditorEdits, cropEditing = false): HTMLCanvasElement {
    const image = this.image(edits);
    const { commit, rotation } = frameTransform(edits, cropEditing);
    if (!commit && !rotation) return image;
    const key = JSON.stringify([commit, rotation]);
    if (this.framed?.key === key) return this.framed.canvas;
    const { canvas, context } = surface(commit?.outputWidth ?? image.width, commit?.outputHeight ?? image.height);
    context.translate((commit?.bakedOffset.x ?? 0) + image.width / 2, (commit?.bakedOffset.y ?? 0) + image.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.drawImage(image, -image.width / 2, -image.height / 2);
    this.framed = { key, canvas };
    return canvas;
  }

  private correctedPoint(framePoint: Point, edits: ImageEditorEdits, cropEditing: boolean): Point {
    const { commit, rotation } = frameTransform(edits, cropEditing);
    return rotate({ x: framePoint.x - (commit?.bakedOffset.x ?? 0), y: framePoint.y - (commit?.bakedOffset.y ?? 0) },
      this.original, -rotation);
  }

  sourcePoint(framePoint: Point, edits: ImageEditorEdits, cropEditing: boolean): Point | null {
    const corrected = this.correctedPoint(framePoint, edits, cropEditing);
    const point = sourceCoordinate(corrected, this.original, edits.geometryOptics);
    return point.x >= 0 && point.y >= 0 && point.x < this.original.width && point.y < this.original.height ? point : null;
  }

  framePoint(sourcePoint: Point, edits: ImageEditorEdits, cropEditing: boolean): Point {
    const { commit, rotation } = frameTransform(edits, cropEditing);
    const corrected = correctedCoordinate(sourcePoint, this.original, edits.geometryOptics);
    const rotated = rotate(corrected, this.original, rotation);
    return { x: rotated.x + (commit?.bakedOffset.x ?? 0), y: rotated.y + (commit?.bakedOffset.y ?? 0) };
  }

  samplePointColor(framePoint: Point, edits: ImageEditorEdits, cropEditing: boolean): Triplet | null {
    const { commit } = frameTransform(edits, cropEditing);
    const width = commit?.outputWidth ?? this.original.width, height = commit?.outputHeight ?? this.original.height;
    if (!(framePoint.x >= 0 && framePoint.y >= 0 && framePoint.x < width && framePoint.y < height)) return null;
    const corrected = this.correctedPoint(framePoint, edits, cropEditing);
    if (!(corrected.x >= 0 && corrected.y >= 0 && corrected.x < this.original.width && corrected.y < this.original.height)) return null;
    const image = pointColorInput(this.original, edits);
    const index = (Math.floor(corrected.y) * image.width + Math.floor(corrected.x)) * 4;
    if (!image.pixels[index + 3]) return null;
    return sampleNeighborhood(image, corrected);
  }

  encode(edits: ImageEditorEdits, format: "png" | "jpeg", quality: number): Promise<Blob> {
    let output = this.frame(edits);
    if (format === "jpeg") {
      const { canvas, context } = surface(output.width, output.height);
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(output, 0, 0);
      output = canvas;
    }
    return new Promise((resolve, reject) => output.toBlob((blob) => {
      if (blob) resolve(blob); else reject(new Error("Failed to export image"));
    }, `image/${format}`, quality / 100));
  }
}
