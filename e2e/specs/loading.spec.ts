import { test, expect } from "../support/test";
import { imageFile, imageSizes, pixel } from "../support/images";
import type { ImageName } from "../support/images";

test("same-size replacement updates preview and download", async ({ editor }) => {
  await editor.open("red");
  expect((await editor.stats()).center).toEqual([255, 0, 0, 255]);
  await editor.upload("blue");
  expect((await editor.stats()).center).toEqual([0, 0, 255, 255]);
  expect(pixel((await editor.download()).pixels, 160, 120)).toEqual([0, 0, 255, 255]);
});

for (const name of ["portrait", "odd", "tiny"] as ImageName[]) {
  test(`loads and exports ${name} at its natural dimensions`, async ({ editor }) => {
    await editor.open(name);
    const { pixels } = await editor.download();
    expect([pixels.width, pixels.height]).toEqual(imageSizes[name]);
  });
}

test("uploads a JPEG and resets previous photo edits", async ({ editor }) => {
  await editor.open("ramp");
  await editor.section("Basic");
  await editor.sliderKey("exposure", "End");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  await editor.upload("grid", "jpeg");
  expect((await editor.edits())?.light.exposure).toBe(0);
  expect((await editor.edits())?.healing.ops).toHaveLength(0);
  expect((await editor.download()).pixels.width).toBe(320);
});

test("late image A cannot replace image B or clear B's edits", async ({ editor, page }) => {
  await editor.open("grid");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/delayed-a.png", async (route) => {
    await gate;
    await route.fulfill({ contentType: "image/png", body: imageFile("red") });
  });
  await editor.loadUrl("/__e2e_images__/delayed-a.png");
  await expect(editor.downloadButton).toBeDisabled();
  await editor.loadUrl("/__e2e_images__/blue.png");
  await editor.ready();
  await editor.section("Basic");
  await editor.sliderKey("exposure", "End");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  release();
  await editor.settle();
  expect((await editor.stats()).center).toEqual([0, 0, 255, 255]);
  expect((await editor.edits())?.light.exposure).toBe(2);
});

test("recovers after an image request fails", async ({ editor, page }) => {
  await editor.open("grid");
  const response = page.waitForResponse((value) => value.url().endsWith("missing.png"));
  await editor.loadUrl("/__e2e_images__/missing.png");
  expect((await response).status()).toBe(404);
  await expect(editor.downloadButton).toBeDisabled();
  await editor.upload("blue");
  expect((await editor.stats()).center).toEqual([0, 0, 255, 255]);
});

test("loads a data URL and a CORS-enabled cross-origin image", async ({ editor, page }) => {
  await editor.open();
  await editor.loadUrl(`data:image/png;base64,${imageFile("red").toString("base64")}`);
  await editor.ready();
  expect((await editor.stats()).center).toEqual([255, 0, 0, 255]);
  const crossOrigin = new URL("/__e2e_images__/blue.png", page.url());
  crossOrigin.hostname = "localhost";
  await editor.loadUrl(crossOrigin.href);
  await editor.ready();
  expect(pixel((await editor.download()).pixels, 160, 120)).toEqual([0, 0, 255, 255]);
});

test("a blocked cross-origin load disables export and a valid image recovers", async ({ editor, page }) => {
  await editor.open();
  const crossOrigin = new URL("/__e2e_images__/red.png?no-cors", page.url());
  crossOrigin.hostname = "localhost";
  const failed = page.waitForEvent("requestfailed", (request) => request.url() === crossOrigin.href);
  await editor.loadUrl(crossOrigin.href);
  await failed;
  await expect(editor.downloadButton).toBeDisabled();
  await editor.upload("blue");
  expect((await editor.stats()).center).toEqual([0, 0, 255, 255]);
});

test("@stress exports a large image at full resolution", async ({ editor }) => {
  await editor.open("large");
  const { pixels } = await editor.download();
  expect([pixels.width, pixels.height]).toEqual([2400, 1600]);
});
