import { test, expect } from "../support/test";

const handles = [
  ["top-left", 20, 20], ["top", 0, 20], ["top-right", -20, 20],
  ["left", 20, 0], ["right", -20, 0],
  ["bottom-left", 20, -20], ["bottom", 0, -20], ["bottom-right", -20, -20],
] as const;

for (const [handle, dx, dy] of handles) {
  test(`resizes the ${handle} crop handle and exports the selected size`, async ({ editor }) => {
    await editor.open();
    await editor.crop();
    const before = (await editor.edits())!.crop.rect;
    await editor.drag(editor.root.getByTestId(`crop-handle-${handle}`), dx, dy);
    await expect.poll(async () => (await editor.edits())?.crop.rect).not.toEqual(before);
    const after = (await editor.edits())!.crop.rect;
    expect(after.width).toBeGreaterThan(0);
    expect(after.height).toBeGreaterThan(0);
    expect(after.x).toBeGreaterThanOrEqual(before.x);
    expect(after.y).toBeGreaterThanOrEqual(before.y);
    expect(after.width * after.height).toBeLessThan(before.width * before.height);
    await editor.applyCrop();
    const { pixels } = await editor.download();
    expect(pixels.width).toBe(Math.round(after.width));
    expect(pixels.height).toBe(Math.round(after.height));
  });
}

for (const [label, ratio] of [["1x1", 1], ["4x5/8x10", 4 / 5], ["8.5x11", 8.5 / 11], ["5x7", 5 / 7], ["2x3/4x6", 2 / 3], ["4x3", 4 / 3], ["16x9", 16 / 9], ["16x10", 16 / 10]] as const) {
  test(`applies the ${label} aspect ratio`, async ({ editor }) => {
    await editor.open();
    await editor.crop();
    await editor.aspect(label);
    await editor.applyCrop();
    const { pixels } = await editor.download();
    expect(pixels.width / pixels.height).toBeCloseTo(ratio, 2);
  });
}

test("validates custom ratios, cancels the dialog, and locks resizing", async ({ editor, page }) => {
  await editor.open();
  await editor.crop();
  await editor.aspect("Custom");
  const dialog = page.getByRole("dialog", { name: "Custom Aspect Ratio" });
  await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  await dialog.getByLabel("Width", { exact: true }).fill("0");
  await dialog.getByLabel("Height", { exact: true }).fill("4");
  await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await editor.customAspect("3", "4");
  await editor.root.getByRole("button", { name: "Lock aspect ratio", exact: true }).click();
  await editor.drag(editor.root.getByTestId("crop-handle-bottom-right"), -25, -15);
  await editor.applyCrop();
  const { pixels } = await editor.download();
  expect(pixels.width / pixels.height).toBeCloseTo(0.75, 2);
});

test("moves a crop within the image and supports re-cropping", async ({ editor }) => {
  await editor.open();
  await editor.crop();
  await editor.aspect("1x1");
  await editor.settle();
  const before = (await editor.edits())!.crop.rect;
  await editor.drag(editor.root.getByTestId("crop-region"), 100, 0);
  await expect.poll(async () => (await editor.edits())?.crop.rect.x).toBeGreaterThan(before.x);
  const moved = (await editor.edits())!.crop.rect;
  expect(moved.width).toBe(before.width);
  await editor.applyCrop();
  await editor.crop();
  await editor.aspect("16x9");
  await editor.applyCrop();
  const { pixels } = await editor.download();
  expect(pixels.width / pixels.height).toBeCloseTo(16 / 9, 2);
});

test("constrained rotation produces an opaque crop and is undoable", async ({ editor }) => {
  await editor.open();
  await editor.crop();
  await editor.sliderKey("crop-rotation", "End");
  await expect.poll(async () => (await editor.edits())?.crop.settings.rotation).toBe(45);
  await editor.applyCrop();
  const { pixels } = await editor.download();
  expect(pixels.width).toBeGreaterThan(1);
  for (let y = 2; y < pixels.height - 2; y++) {
    for (let x = 2; x < pixels.width - 2; x++) expect(pixels.data[(y * pixels.width + x) * 4 + 3]).toBe(255);
  }
  // Applying a crop may also record a fit-camera entry.
  for (let i = 0; i < 3 && (await editor.edits())?.crop.committed; i++) await editor.undo();
  await expect.poll(async () => (await editor.edits())?.crop.committed).toBe(false);
});
