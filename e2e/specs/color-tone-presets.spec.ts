import { pixel, pixelHash, mean } from "../support/images";
import { test, expect } from "../support/test";

for (const band of ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const) {
  test(`edits and resets the ${band} mixer band independently`, async ({ editor }) => {
    await editor.open("palette");
    await editor.section("Color Mixer");
    await editor.root.getByTestId(`mixer-band-${band}`).click();
    for (const channel of ["hue", "saturation", "luminance"] as const) {
      await editor.sliderKey(`mixer-${band}-${channel}`, "End");
      await expect.poll(async () => (await editor.edits())?.color.mixerHsl[band][channel]).toBe(100);
    }
    const other = band === "red" ? "blue" : "red";
    expect((await editor.edits())?.color.mixerHsl[other]).toEqual({ hue: 0, saturation: 0, luminance: 0 });
    await editor.root.getByRole("button", { name: "Reset band", exact: true }).click();
    await expect.poll(async () => (await editor.edits())?.color.mixerHsl[band]).toEqual({ hue: 0, saturation: 0, luminance: 0 });
  });
}

test("point color picking, cancellation, shifts, and range", async ({ editor, page }) => {
  await editor.open("palette");
  const baseline = (await editor.download()).pixels;
  await editor.section("Color Mixer");
  await editor.root.getByRole("tab", { name: "Point Color", exact: true }).click();
  await editor.root.getByTestId("point-color-eyedropper").click();
  await page.keyboard.press("Escape");
  const point = await editor.imagePoint(20, 100, 320, 240);
  await page.mouse.click(point.x, point.y);
  expect((await editor.edits())?.color.pointColor.hue).toBeNull();
  await editor.root.getByTestId("point-color-eyedropper").click();
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await editor.edits())?.color.pointColor.hue).not.toBeNull();
  expect((await editor.edits())!.color.pointColor.hue!).toBeLessThan(0.1);
  await editor.sliderKey("point-color-range", "End");
  await editor.sliderKey("point-color-saturation", "Home");
  await expect.poll(async () => (await editor.edits())?.color.pointColor.saturationShift).toBe(-100);
  expect((await editor.edits())?.color.pointColor.range).toBe(100);
  const edited = (await editor.download()).pixels;
  const i = (100 * edited.width + 20) * 4;
  // Point color uses a soft saturation-weighted mask; require a substantial
  // reduction in the selected red, while an unselected blue stays unchanged.
  expect(Math.abs(edited.data[i] - edited.data[i + 1])).toBeLessThan(Math.abs(baseline.data[i] - baseline.data[i + 1]) / 2);
  expect(pixel(edited, 250, 100)).toEqual(pixel(baseline, 250, 100));
});

for (const name of ["Auto Enhance", "Vibrant", "Warm", "Cool", "Matte", "B&W", "B&W High Contrast", "Vintage Film"]) {
  test(`applies the ${name} preset into manual controls and history`, async ({ editor }) => {
    await editor.open("grid");
    const baseline = pixelHash((await editor.download()).pixels);
    await editor.section("Presets");
    await editor.root.getByTestId("presets-section").getByRole("button", { name, exact: true }).click();
    await editor.section("History");
    await expect(editor.root.locator('[data-testid^="history-entry-"]').filter({ hasText: `${name} preset` })).toHaveCount(1);
    expect(pixelHash((await editor.download()).pixels)).not.toBe(baseline);
    await editor.baseline();
    expect(pixelHash((await editor.download()).pixels)).toBe(baseline);
  });
}

test("tone curve point insertion, movement, deletion, and region controls", async ({ editor, page }) => {
  await editor.open("ramp");
  const baseline = (await editor.download()).pixels;
  await editor.section("Tone Curve");
  const curve = editor.root.getByLabel("Tone curve editor", { exact: true });
  await curve.scrollIntoViewIfNeeded();
  const box = await curve.boundingBox();
  if (!box) throw new Error("Missing tone curve");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  await expect.poll(async () => (await editor.edits())?.toneCurve.point.rgb.length).toBe(3);
  expect(mean((await editor.download()).pixels)).toBeGreaterThan(mean(baseline));
  await curve.focus();
  await curve.press("Delete");
  await expect.poll(async () => (await editor.edits())?.toneCurve.point.rgb.length).toBe(2);
  expect(pixelHash((await editor.download()).pixels)).toBe(pixelHash(baseline));
  await editor.root.getByRole("button", { name: "Tone Curve mode: Parametric", exact: true }).click();
  await editor.sliderKey("tone-curve-lights", "End");
  await expect.poll(async () => (await editor.edits())?.toneCurve.parametric.rgb.lights).toBe(100);
});
