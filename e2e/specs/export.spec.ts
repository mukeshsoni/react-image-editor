import { test, expect } from "../support/test";
import { pixel, pixelHash, variation } from "../support/images";

test("PNG preserves alpha and JPEG flattens transparent pixels to white", async ({ editor }) => {
  await editor.open("alpha");
  const png = await editor.download();
  expect(Array.from(png.bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.filename).toBe("edited-image.png");
  expect(pixel(png.pixels, 0, 0)[3]).toBe(0);
  expect(pixel(png.pixels, 200, 120)[3]).toBeGreaterThan(100);
  expect(pixel(png.pixels, 200, 120)[3]).toBeLessThan(160);
  const jpeg = await editor.download("jpeg");
  expect(Array.from(jpeg.bytes.subarray(0, 2))).toEqual([255, 216]);
  expect(jpeg.filename).toBe("edited-image.jpg");
  expect(pixel(jpeg.pixels, 0, 0)).toEqual([255, 255, 255, 255]);
});

test("JPEG quality changes the actual downloaded encoding", async ({ editor }) => {
  await editor.open("noise");
  const high = await editor.download("jpeg");
  await editor.sliderKey("jpeg-quality", "Home");
  const low = await editor.download("jpeg");
  expect(low.bytes.length).toBeLessThan(high.bytes.length);
  expect([low.pixels.width, low.pixels.height]).toEqual([320, 240]);
});

for (const cropped of [false, true]) {
  test(`denoise changes exported pixels (cropped=${cropped})`, async ({ editor }) => {
    await editor.open("noise");
    if (cropped) { await editor.crop(); await editor.aspect("1x1"); await editor.applyCrop(); }
    const before = (await editor.download()).pixels;
    await editor.section("Details");
    await editor.sliderKey("denoise-luminance", "End");
    await editor.sliderKey("denoise-detail", "Home");
    await expect.poll(async () => (await editor.edits())?.denoise?.luminance).toBe(100);
    const after = (await editor.download()).pixels;
    expect(pixelHash(after)).not.toBe(pixelHash(before));
    expect(variation(after)).toBeLessThan(variation(before));
  });
}

test("vignette preview matches export despite viewport margins", async ({ editor }) => {
  await editor.open("red");
  await editor.section("Optics");
  await editor.sliderKey("optics-vignette", "End");
  await expect.poll(async () => (await editor.edits())?.geometryOptics.optics.vignette).toBe(100);
  await editor.settle();
  const stats = await editor.stats();
  const preview = await editor.canvas.evaluate((element, bounds) => {
    const c = element as HTMLCanvasElement;
    return Array.from(c.getContext("2d")!.getImageData(bounds.x + 3, bounds.y + 3, 1, 1).data);
  }, stats.bounds);
  const saved = (await editor.download()).pixels;
  const expected = pixel(saved, 3, 3);
  expect(Math.abs(preview[0] - expected[0])).toBeLessThan(5);
  expect(preview[0]).toBeLessThan(25);
});

test("recovers from a failed canvas encoding", async ({ editor, page }) => {
  await editor.open();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await editor.downloadButton.click();
  await expect(editor.root.getByText("Failed to export image", { exact: true })).toBeVisible();
  await expect(editor.downloadButton).toBeEnabled();
  expect((await editor.download()).pixels.width).toBe(320);
});
