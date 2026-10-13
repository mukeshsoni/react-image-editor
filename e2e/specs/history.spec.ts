import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("undo/redo restores pixels and a new branch discards redo", async ({ editor }) => {
  await editor.open("ramp");
  const original = pixelHash((await editor.download()).pixels);
  await editor.section("Basic");
  await editor.sliderKey("exposure", "End");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  const edited = pixelHash((await editor.download()).pixels);
  expect(edited).not.toBe(original);
  await editor.undo();
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
  await editor.redo();
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  expect(pixelHash((await editor.download()).pixels)).toBe(edited);
  await editor.undo();
  await editor.sliderKey("contrast", "Home");
  await expect.poll(async () => (await editor.edits())?.light.contrast).toBe(-100);
  await expect(editor.root.getByRole("button", { name: "Redo (⇧⌘Z)", exact: true })).toBeDisabled();
});

test("history time travel restores the original after mixed edits", async ({ editor }) => {
  await editor.open();
  const original = pixelHash((await editor.download()).pixels);
  await editor.section("Basic");
  await editor.sliderKey("saturation", "Home");
  await expect.poll(async () => (await editor.edits())?.color.saturation).toBe(-100);
  await editor.crop();
  await editor.aspect("1x1");
  await editor.applyCrop();
  await editor.baseline();
  await expect.poll(async () => (await editor.edits())?.crop.committed).toBe(false);
  expect((await editor.edits())?.color.saturation).toBe(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});

test("@stress preserves Reset after more than 50 committed edits", async ({ editor }) => {
  test.slow();
  await editor.open("ramp");
  const original = pixelHash((await editor.download()).pixels);
  await editor.section("Basic");
  for (let i = 0; i < 55; i++) {
    await editor.sliderKey("contrast", i % 2 ? "Home" : "End");
    await expect.poll(async () => (await editor.edits())?.light.contrast).toBe(i % 2 ? -100 : 100);
  }
  await editor.section("History");
  await expect(editor.root.locator('[data-testid^="history-entry-"]')).toHaveCount(50);
  await expect(editor.root.getByTestId("history-entry-0")).toHaveText("Original");
  await editor.root.getByTestId("history-entry-0").click();
  await expect.poll(async () => (await editor.edits())?.light.contrast).toBe(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});
