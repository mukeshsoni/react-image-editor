import { test, expect } from "../e2e/support/test";

test("vertical panning moves a zoomed portrait while a tray is open", async ({ editor }) => {
  await editor.open("portrait");
  await editor.canvas.dblclick(); await editor.settle();
  await editor.section("Basic"); await editor.settle();
  const before = (await editor.stats()).hash;
  await editor.drag(editor.canvas, 0, 40);
  await editor.settle();
  expect((await editor.stats()).hash).not.toBe(before);
});

test("closing an editing tray restores the zoomed portrait view", async ({ editor }) => {
  await editor.open("portrait"); await editor.canvas.dblclick(); await editor.settle();
  await editor.drag(editor.canvas, 0, 20); await editor.settle();
  const before = (await editor.stats()).hash;
  for (let i = 0; i < 3; i++) {
    await editor.section("Basic"); await editor.settle();
    await editor.toolButton("Edit").click(); await editor.settle();
    expect((await editor.stats()).hash).toBe(before);
  }
});

for (const tool of ["Crop", "Healing"] as const) {
  test(`replacing a photo clears the mobile ${tool} selection`, async ({ editor }) => {
    await editor.open();
    if (tool === "Crop") await editor.crop(); else await editor.section("Healing");
    await editor.upload("blue");
    await expect(editor.toolButton(tool)).toHaveAttribute("aria-pressed", "false");
    await editor.toolButton(tool).click();
    if (tool === "Crop") await expect(editor.root.getByTestId("crop-region")).toBeVisible();
    else await expect(editor.toolButton(tool)).toHaveAttribute("aria-pressed", "true");
  });
}

test("a short viewport keeps real crop handles inside the visible canvas", async ({ editor, page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await editor.open("landscape"); await editor.crop();
  const canvas = await editor.canvas.boundingBox();
  if (!canvas) throw new Error("Missing canvas");
  for (const name of ["top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"]) {
    const box = await editor.root.getByTestId(`crop-handle-${name}`).boundingBox();
    if (!box) throw new Error(`Missing ${name}`);
    expect(box.y + box.height / 2).toBeGreaterThanOrEqual(canvas.y);
    expect(box.y + box.height / 2).toBeLessThanOrEqual(canvas.y + canvas.height);
  }
  const before = (await editor.edits())!.crop.rect;
  await editor.drag(editor.root.getByTestId("crop-handle-bottom-right"), -8, -8);
  await expect.poll(async () => (await editor.edits())!.crop.rect.width).toBeLessThan(before.width);
});
