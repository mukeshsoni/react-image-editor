import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

test("parent rerenders preserve edits and remounting starts from the original", async ({ editor, page }) => {
  await editor.open("grid");
  const original = pixelHash((await editor.download()).pixels);
  await editor.section("Basic");
  await editor.sliderKey("contrast", "End");
  await expect.poll(async () => (await editor.edits())?.light.contrast).toBe(100);
  const edited = pixelHash((await editor.download()).pixels);
  await page.getByRole("button", { name: "Rerender host", exact: true }).click();
  expect(pixelHash((await editor.download()).pixels)).toBe(edited);
  await page.getByRole("button", { name: "Unmount editor", exact: true }).click();
  await expect(editor.root).toHaveCount(0);
  await page.getByRole("button", { name: "Mount editor", exact: true }).click();
  await expect.poll(async () => (await editor.edits())?.light.contrast).toBe(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(original);
});

test("unmount cancels pending public edit notifications", async ({ editor, page }) => {
  await editor.open();
  await editor.section("Basic");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const before = await editor.eventCount();
  await editor.sliderKey("exposure", "End");
  await page.getByRole("button", { name: "Unmount editor", exact: true }).click();
  await page.clock.runFor(1000);
  expect(await editor.eventCount()).toBe(before);
});

test("slider and history debounce boundaries deliver the latest value", async ({ editor, page }) => {
  await editor.open();
  await editor.section("Basic");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await editor.slider("exposure").focus();
  await page.keyboard.down("End");
  await page.clock.runFor(149);
  expect((await editor.edits())?.light.exposure).toBe(0);
  await page.clock.runFor(250);
  expect((await editor.edits())?.light.exposure).toBe(0);
  await page.clock.runFor(1);
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  await page.keyboard.up("End");
});
