import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("wheel limits stay positive and camera changes do not alter export", async ({ editor, page }) => {
  await editor.open();
  const baseline = pixelHash((await editor.download()).pixels);
  const point = await editor.imagePoint(160, 120, 320, 240);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 100);
  await editor.settle();
  const small = await editor.stats();
  expect(small.bounds.width).toBeGreaterThan(0);
  expect(small.bounds.width).toBeLessThan(320);
  await page.mouse.wheel(0, -10000);
  await editor.settle();
  expect((await editor.stats()).bounds.width).toBeGreaterThan(small.bounds.width);
  expect(pixelHash((await editor.download()).pixels)).toBe(baseline);
});
