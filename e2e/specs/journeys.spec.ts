import process from "node:process";

import { test, expect } from "../support/test";
import { pixelHash } from "../support/images";

const seeds = (process.env.E2E_SEEDS ?? "42,731,1337").split(",").map(Number);
const commands = ["exposure", "contrast", "crop", "zoom", "reset"] as const;

for (const initialSeed of seeds) {
  test(`@stress seeded editor journey ${initialSeed}`, async ({ editor }, info) => {
    test.slow();
    let seed = initialSeed;
    const actions = Array.from({ length: 10 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return commands[seed % commands.length];
    });
    await info.attach("seed-and-actions", { body: JSON.stringify({ seed: initialSeed, actions }), contentType: "application/json" });
    await editor.open();
    const original = pixelHash((await editor.download()).pixels);
    for (const action of actions) {
      if (action === "reset") {
        await editor.baseline();
        expect(pixelHash((await editor.download()).pixels)).toBe(original);
      } else if (action === "crop") {
        await editor.crop(); await editor.aspect("1x1"); await editor.applyCrop();
        const image = (await editor.download()).pixels;
        expect(image.width).toBe(image.height);
      } else if (action === "zoom") {
        const before = pixelHash((await editor.download()).pixels);
        await editor.canvas.dblclick(); await editor.settle();
        expect(pixelHash((await editor.download()).pixels)).toBe(before);
      } else {
        await editor.section("Basic");
        await editor.sliderKey(action, "End");
        await expect.poll(async () => (await editor.edits())?.light[action]).toBe(action === "exposure" ? 2 : 100);
        const checkpoint = pixelHash((await editor.download()).pixels);
        await editor.undo(); await editor.redo();
        expect(pixelHash((await editor.download()).pixels)).toBe(checkpoint);
      }
      const stats = await editor.stats();
      expect(stats.bounds.width).toBeGreaterThan(0);
      expect(stats.bounds.height).toBeGreaterThan(0);
    }
    await editor.baseline();
    expect(pixelHash((await editor.download()).pixels)).toBe(original);
  });
}
