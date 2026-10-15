import { pixelHash } from "../e2e/support/images";
import { test, expect } from "../e2e/support/test";

test("cancelled crop drafts never enter history", async ({ editor }) => {
  await editor.open();
  const original = pixelHash((await editor.download()).pixels);
  await editor.crop(); await editor.aspect("1x1");
  await editor.sliderKey("crop-rotation", "End");
  await expect.poll(async () => (await editor.edits())?.crop.settings.rotation).toBe(45);
  await editor.toolButton("Crop").click();
  await expect(editor.root.getByTestId("crop-region")).toHaveCount(0);
  await editor.section("History");
  await expect(editor.root.locator('[data-testid^="history-entry-"]')).toHaveCount(1);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});

test("one Undo after a rotated Apply restores the original PNG", async ({ editor }) => {
  await editor.open();
  const original = pixelHash((await editor.download()).pixels);
  await editor.crop(); await editor.sliderKey("crop-rotation", "End"); await editor.applyCrop();
  await editor.undo();
  await expect.poll(async () => (await editor.edits())?.crop.committed).toBe(false);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});

test("a constrained perspective crop has opaque interior pixels", async ({ editor }) => {
  await editor.open("red");
  await editor.section("Transform"); await editor.sliderKey("transform-horizontal", "End");
  await expect.poll(async () => (await editor.edits())?.geometryOptics.perspective.horizontal).toBe(100);
  await editor.crop(); await editor.applyCrop();
  const { pixels } = await editor.download();
  for (let y = 2; y < pixels.height - 2; y++) for (let x = 2; x < pixels.width - 2; x++) {
    expect(pixels.data[(y * pixels.width + x) * 4 + 3]).toBe(255);
  }
});

test("Reset crop persists without Apply and is undoable", async ({ editor }) => {
  await editor.open(); await editor.crop(); await editor.aspect("1x1"); await editor.applyCrop();
  await editor.crop(); await editor.root.getByRole("button", { name: "Reset crop", exact: true }).click();
  await editor.toolButton("Crop").click();
  await expect(editor.root.getByTestId("crop-region")).toHaveCount(0);
  const reset = (await editor.download()).pixels;
  expect([reset.width, reset.height]).toEqual([320, 240]);
  await editor.undo();
  const restored = (await editor.download()).pixels;
  expect([restored.width, restored.height]).toEqual([240, 240]);
});
