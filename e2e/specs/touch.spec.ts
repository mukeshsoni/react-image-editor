import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("native two-finger pinch zooms the editor without changing its export", async ({ editor, page }) => {
  await editor.open();
  const original = pixelHash((await editor.download()).pixels);
  const before = await editor.stats();
  const point = await editor.imagePoint(160, 120, 320, 240);
  const session = await page.context().newCDPSession(page);
  const touches = (radius: number) => [{ id: 1, x: point.x - radius, y: point.y }, { id: 2, x: point.x + radius, y: point.y }];
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches(25) });
  for (const radius of [30, 40, 50, 60]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touches(radius) });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
  await editor.settle();
  const pinched = await editor.stats();
  expect(pinched.hash).not.toBe(before.hash);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await editor.settle();
  expect((await editor.stats()).hash).toBe(pinched.hash);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
  await session.detach();
});

test("native single-finger double tap toggles zoom and fit", async ({ editor, page }) => {
  await editor.open();
  const before = await editor.stats();
  const point = await editor.imagePoint(160, 120, 320, 240);
  await page.touchscreen.tap(point.x, point.y);
  await page.touchscreen.tap(point.x, point.y);
  await editor.settle();
  expect((await editor.stats()).hash).not.toBe(before.hash);
  await page.touchscreen.tap(point.x, point.y);
  await page.touchscreen.tap(point.x, point.y);
  await editor.settle();
  expect((await editor.stats()).hash).toBe(before.hash);
});
