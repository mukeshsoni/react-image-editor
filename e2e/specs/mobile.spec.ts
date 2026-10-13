import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("closing the tray preserves the fitted zoom of a newly applied portrait crop", async ({ editor }) => {
  await editor.open("landscape");
  await editor.crop();
  await editor.customAspect("3", "4");
  await editor.applyCrop();
  const before = await editor.stats();
  await editor.root.getByRole("button", { name: "Crop", exact: true }).click();
  await editor.settle();
  const after = await editor.stats();
  expect(after.bounds.width).toBe(before.bounds.width);
  expect(after.bounds.height).toBe(before.bounds.height);
  expect((await editor.download()).pixels.width / (await editor.edits())!.crop.commit!.outputHeight).toBeCloseTo(0.75, 2);
});

test("tray switching resets scroll and repeated open/close does not drift", async ({ editor }) => {
  await editor.open();
  const initial = (await editor.stats()).bounds;
  for (let i = 0; i < 4; i++) {
    await editor.section("Basic");
    await editor.settle();
    await editor.root.getByRole("button", { name: "Basic", exact: true }).click();
    await editor.settle();
    expect((await editor.stats()).bounds).toEqual(initial);
  }
  await editor.section("Basic");
  await editor.slider("saturation").scrollIntoViewIfNeeded();
  const scroll = editor.root.getByTestId("mobile-tray-scroll");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await editor.section("Details");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
});

test("portrait/landscape resizing keeps the image visible and export stable", async ({ editor, page }) => {
  await editor.open("portrait");
  const baseline = pixelHash((await editor.download()).pixels);
  await editor.section("Details");
  await page.setViewportSize({ width: 700, height: 500 });
  await editor.settle();
  expect((await editor.stats()).bounds.width).toBeGreaterThan(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(baseline);
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.settle();
  expect(pixelHash((await editor.download()).pixels)).toBe(baseline);
});
