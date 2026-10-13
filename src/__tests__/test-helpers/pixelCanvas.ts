import { createCanvas, ImageData as NativeImageData } from "@napi-rs/canvas";
import { vi } from "vitest";

// Give jsdom canvases real pixel buffers so rendering tests can assert pixels,
// rather than only checking calls to drawImage.
export function installPixelCanvas() {
  const surfaces = new WeakMap<object, ReturnType<typeof createCanvas>>();
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

  function surfaceFor(source: HTMLCanvasElement | HTMLImageElement) {
    let surface = surfaces.get(source);
    if (source instanceof HTMLCanvasElement) {
      if (!surface) {
        surface = createCanvas(source.width, source.height);
        surfaces.set(source, surface);
      }
      if (surface.width !== source.width) surface.width = source.width;
      if (surface.height !== source.height) surface.height = source.height;
    }
    if (!surface) throw new Error("Register test images with createImage");
    return surface;
  }

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
    type: string,
  ) {
    if (type !== "2d") return null;
    const existing = contexts.get(this);
    if (existing) return existing;

    const context = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, property) => {
        const native = surfaceFor(this).getContext("2d");
        if (property === "canvas") return this;
        if (property === "drawImage") {
          return (source: HTMLCanvasElement | HTMLImageElement, ...args: number[]) => {
            Reflect.apply(native.drawImage, native, [surfaceFor(source), ...args]);
          };
        }
        if (property === "putImageData") {
          return (data: ImageData, x: number, y: number) => {
            native.putImageData(new NativeImageData(data.data, data.width, data.height), x, y);
          };
        }
        const value: unknown = Reflect.get(native, property);
        return typeof value === "function" ? value.bind(native) : value;
      },
      set: (_target, property, value: unknown) => {
        return Reflect.set(surfaceFor(this).getContext("2d"), property, value);
      },
    });
    contexts.set(this, context);
    return context;
  });

  return {
    createImage(
      width: number,
      height: number,
      paint: (ctx: CanvasRenderingContext2D) => void,
    ): HTMLImageElement {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      paint(canvas.getContext("2d")!);
      const image = document.createElement("img");
      image.width = width;
      image.height = height;
      surfaces.set(image, surfaceFor(canvas));
      return image;
    },
  };
}

export function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext("2d")!.getImageData(x, y, 1, 1).data);
}
