import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("keyboard zoom shortcuts and fit reset preserve output", async ({ editor, page }) => {
  await editor.open();
  const original = pixelHash((await editor.download()).pixels);
  const before = await editor.stats();
  await editor.canvas.click();
  await page.keyboard.press("Control+=");
  await editor.settle();
  expect((await editor.stats()).hash).not.toBe(before.hash);
  await page.keyboard.press("Control+0");
  await editor.settle();
  expect((await editor.stats()).hash).toBe(before.hash);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});

test("undo/redo shortcuts work from sliders and leave host text editing alone", async ({ editor, page }) => {
  await editor.open();
  await editor.section("Basic");
  await editor.sliderKey("exposure", "End");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  await editor.undo(true);
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(0);
  await editor.redo(true);
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  const input = page.getByRole("textbox", { name: "Host text field", exact: true });
  await input.fill("hello");
  await input.press("Control+z");
  expect((await editor.edits())?.light.exposure).toBe(2);
});

test("crop shortcuts rotate and reset, but do not intercept text entry", async ({ editor, page }) => {
  await editor.open();
  await editor.crop();
  await page.keyboard.press("]");
  await expect.poll(async () => (await editor.edits())?.crop.settings.rotation).toBe(1);
  await page.keyboard.press("r");
  await expect.poll(async () => (await editor.edits())?.crop.settings.rotation).toBe(0);
  const input = page.getByRole("textbox", { name: "Host text field", exact: true });
  await input.fill("r[]");
  expect((await editor.edits())?.crop.settings.rotation).toBe(0);
});
