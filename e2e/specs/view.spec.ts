import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("double click toggles fit and zoom", async ({ editor }) => {
  await editor.open();
  const before = await editor.stats();
  await editor.canvas.dblclick();
  await editor.settle();
  expect((await editor.stats()).hash).not.toBe(before.hash);
  await editor.canvas.dblclick();
  await editor.settle();
  expect((await editor.stats()).hash).toBe(before.hash);
});

test("a committed crop remains responsive to zoom and panning", async ({ editor, page }) => {
  await editor.open();
  await editor.crop();
  await editor.aspect("1x1");
  await editor.applyCrop();
  const saved = pixelHash((await editor.download()).pixels);
  const before = await editor.stats();
  await editor.canvas.dblclick();
  await editor.settle();
  expect((await editor.stats()).hash).not.toBe(before.hash);
  const box = await editor.canvas.boundingBox();
  if (!box) throw new Error("No preview");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 30, { steps: 8 });
  await page.mouse.up();
  await editor.settle();
  expect(pixelHash((await editor.download()).pixels)).toBe(saved);
});
