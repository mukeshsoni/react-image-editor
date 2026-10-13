import { test, expect } from "../support/test";
import { pixel } from "../support/images";

test("packed component renders with its consumer's React and CSS", async ({ editor, page }, info) => {
  await editor.open("red");
  await expect(page.getByTestId("react-version")).toHaveText(info.project.name.includes("18") ? "18.2.0" : "19.0.0");
  expect(await editor.downloadButton.evaluate((button) => getComputedStyle(button).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  expect(pixel((await editor.download()).pixels, 160, 120)).toEqual([255, 0, 0, 255]);
});

test("packed editor updates props, commits edits, and exports a crop", async ({ editor }) => {
  await editor.open("red");
  await editor.upload("blue");
  expect((await editor.stats()).center).toEqual([0, 0, 255, 255]);
  await editor.section("Basic");
  await editor.sliderKey("exposure", "Home");
  await expect.poll(async () => (await editor.edits())?.light.exposure).toBe(-2);
  await editor.crop();
  await editor.aspect("1x1");
  await editor.applyCrop();
  const { pixels } = await editor.download();
  expect(pixels.width).toBe(pixels.height);
  expect(pixel(pixels, 100, 100)[2]).toBeLessThan(255);
});
