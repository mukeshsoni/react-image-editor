import { test, expect } from "../support/test";
import { pixel } from "../support/images";

test("clone uses an external sample through crop and rotation", async ({ editor, page }) => {
  await editor.open("healing");
  await editor.section("Healing");
  await editor.root.getByTestId("healing-mode").click();
  await page.getByRole("option", { name: "Clone", exact: true }).click();
  await editor.sliderKey("healing-feather", "Home");
  const source = await editor.imagePoint(300, 100, 400, 200);
  await page.keyboard.down("Alt");
  await page.mouse.click(source.x, source.y);
  await page.keyboard.up("Alt");
  await expect.poll(async () => (await editor.edits())?.healing.cloneSource?.x).toBeGreaterThan(280);
  const target = await editor.imagePoint(200, 100, 400, 200);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(1);
  expect(pixel((await editor.download()).pixels, 200, 100)).toEqual([255, 0, 0, 255]);

  await editor.crop();
  await editor.customAspect("1", "2");
  await editor.sliderKey("crop-rotation", "End");
  await editor.applyCrop();
  const commit = (await editor.edits())!.crop.commit!;
  const saved = (await editor.download()).pixels;
  // The target is the original image center, which stays fixed under rotation.
  expect(pixel(saved, 200 + commit.bakedOffset.x, 100 + commit.bakedOffset.y)).toEqual([255, 0, 0, 255]);
});

test("spot sources can be dragged and selected spots deleted", async ({ editor, page }) => {
  await editor.open("healing");
  await editor.section("Healing");
  await editor.sliderKey("healing-feather", "Home");
  const target = await editor.imagePoint(200, 100, 400, 200);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(1);
  const op = (await editor.edits())!.healing.ops[0];
  if (op.type !== "spot" || !op.source) throw new Error("Expected a spot source");
  const from = await editor.imagePoint(op.source.x, op.source.y, 400, 200);
  const to = await editor.imagePoint(300, 100, 400, 200);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await editor.edits())?.healing.ops[0].source?.x).toBeGreaterThan(280);
  expect(pixel((await editor.download()).pixels, 200, 100)).toEqual([255, 0, 0, 255]);
  await page.mouse.click(target.x, target.y);
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(0);
  expect(pixel((await editor.download()).pixels, 200, 100)).toEqual([0, 0, 255, 255]);
});

test("heal strokes can be cleared and restored through undo", async ({ editor, page }) => {
  await editor.open("healing");
  await editor.section("Healing");
  await editor.root.getByTestId("healing-mode").click();
  await page.getByRole("option", { name: "Heal", exact: true }).click();
  const point = await editor.imagePoint(200, 100, 400, 200);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 15, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(1);
  await editor.root.getByRole("button", { name: "Clear healing strokes", exact: true }).click();
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(0);
  await editor.undo();
  await expect.poll(async () => (await editor.edits())?.healing.ops.length).toBe(1);
});
