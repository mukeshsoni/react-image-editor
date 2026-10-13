import type { ImageEditorEdits } from "../../src/index";
import type { Section } from "../support/editor";
import { pixelHash, mean } from "../support/images";
import { test, expect } from "../support/test";

const cases: Array<{ section: Section; id: string; value: (edits: ImageEditorEdits) => number; initial: number }> = [
  ...(["exposure", "contrast", "highlights", "shadows", "whites", "blacks"] as const).map((key) => ({ section: "Basic" as const, id: key, value: (edits: ImageEditorEdits) => edits.light[key], initial: 0 })),
  ...(["vibrance", "saturation"] as const).map((key) => ({ section: "Basic" as const, id: key, value: (edits: ImageEditorEdits) => edits.color[key], initial: 0 })),
  { section: "Basic", id: "temp", value: (edits) => edits.whiteBalance.temperatureKelvin, initial: 6500 },
  { section: "Basic", id: "tint", value: (edits) => edits.whiteBalance.tint, initial: 0 },
  ...(["amount", "radius", "detail", "masking"] as const).map((key) => ({ section: "Details" as const, id: `sharpening-${key}`, value: (edits: ImageEditorEdits) => edits.sharpening![key], initial: { amount: 0, radius: 1, detail: 25, masking: 0 }[key] })),
  ...(["luminance", "color", "detail"] as const).map((key) => ({ section: "Details" as const, id: `denoise-${key}`, value: (edits: ImageEditorEdits) => edits.denoise![key], initial: key === "detail" ? 50 : 0 })),
  ...(["vertical", "horizontal", "aspect"] as const).map((key) => ({ section: "Transform" as const, id: `transform-${key}`, value: (edits: ImageEditorEdits) => edits.geometryOptics.perspective[key] ?? 0, initial: 0 })),
  { section: "Lens Corrections", id: "lens-distortion", value: (edits) => edits.geometryOptics.lensCorrections.distortion, initial: 0 },
  ...(["vignette", "grain", "dehaze"] as const).map((key) => ({ section: "Optics" as const, id: `optics-${key}`, value: (edits: ImageEditorEdits) => edits.geometryOptics.optics[key], initial: 0 })),
];

for (const { section, id, value, initial } of cases) {
  test(`${id}: keyboard limits, committed value, and double-click reset`, async ({ editor }) => {
    await editor.open("grid");
    const original = pixelHash((await editor.download()).pixels);
    await editor.section(section);
    const min = Number(await editor.slider(id).getAttribute("min"));
    const max = Number(await editor.slider(id).getAttribute("max"));
    await editor.sliderKey(id, "Home");
    await expect.poll(async () => value((await editor.edits())!)).toBe(min);
    await editor.sliderKey(id, "End");
    await expect.poll(async () => value((await editor.edits())!)).toBe(max);
    await editor.resetSlider(id);
    await expect.poll(async () => value((await editor.edits())!)).toBe(initial);
    expect(pixelHash((await editor.download()).pixels)).toBe(original);
  });
}

test("exposure changes exported luminance and section reset restores it", async ({ editor }) => {
  await editor.open("ramp");
  const baseline = (await editor.download()).pixels;
  await editor.section("Basic");
  await editor.sliderKey("exposure", "End");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(2);
  expect(mean((await editor.download()).pixels)).toBeGreaterThan(mean(baseline));
  await editor.root.getByTestId("tone-section").getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(0);
  expect(pixelHash((await editor.download()).pixels)).toBe(pixelHash(baseline));
});

test("white balance presets, picking, and reset", async ({ editor, page }) => {
  await editor.open("palette");
  await editor.section("Basic");
  await editor.root.getByRole("combobox", { name: "White Balance", exact: true }).click();
  await page.getByRole("option", { name: "Daylight", exact: true }).click();
  await expect.poll(async () => (await editor.edits())?.whiteBalance.preset).toBe("daylight");
  await editor.root.getByTestId("wb-eyedropper").click();
  const point = await editor.imagePoint(20, 80, 320, 240);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await editor.edits())?.whiteBalance.preset).toBe("custom");
  const balance = (await editor.edits())!.whiteBalance;
  expect(Number.isFinite(balance.temperatureKelvin)).toBe(true);
  expect(Number.isFinite(balance.tint)).toBe(true);
  await editor.root.getByTestId("wb-section").getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => (await editor.edits())?.whiteBalance.temperatureKelvin).toBe(6500);
});
