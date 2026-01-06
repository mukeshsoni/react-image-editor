import { vi } from "vitest";

if (typeof globalThis.ImageData === "undefined") {
  Object.defineProperty(globalThis, "ImageData", {
    configurable: true,
    writable: true,
    value: class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(dataOrWidth: Uint8ClampedArray | number, width?: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = width ?? 0;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
          return;
        }

        this.data = dataOrWidth;
        this.width = width ?? 0;
        this.height = height ?? 0;
      }
    },
  });
}

// Some tests expect deterministic RAF.
vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
  cb(0);
  return 1;
});
vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
