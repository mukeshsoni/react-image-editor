import { readFile } from "node:fs/promises";

import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import type { ImageEditorEdits } from "../../src/index";

import { decodeImage, imageFile } from "./images";
import type { ImageName } from "./images";

export type Section = "Basic" | "Presets" | "Color Mixer" | "Tone Curve" | "Details" | "Transform" | "Lens Corrections" | "Optics" | "Healing" | "History";

export class EditorDriver {
  readonly page: Page;
  readonly info: TestInfo;
  readonly root: Locator;
  readonly canvas: Locator;
  readonly downloadButton: Locator;
  readonly exportedFiles: Array<{ path: string; contentType: string }> = [];
  private downloads = 0;

  constructor(page: Page, info: TestInfo) {
    this.page = page;
    this.info = info;
    this.root = page.getByTestId("react-image-editor");
    this.canvas = this.root.getByLabel("Image preview", { exact: true });
    this.downloadButton = this.root.getByRole("button", { name: "Download", exact: true });
  }

  async open(image: ImageName = "grid", params: Record<string, string> = {}) {
    const query = new URLSearchParams({ image: `/__e2e_images__/${image}.png`, ...params });
    await this.page.goto(`/?${query}`);
    await this.ready();
  }

  async ready() {
    await expect(this.downloadButton).toBeEnabled();
    await expect.poll(() => this.edits()).not.toBeNull();
    await this.settle();
  }

  async edits(): Promise<ImageEditorEdits | null> {
    return JSON.parse(await this.page.getByTestId("latest-edits").textContent() ?? "null") as ImageEditorEdits | null;
  }

  async eventCount(): Promise<number> {
    return Number(await this.page.getByTestId("event-count").textContent());
  }

  async upload(image: ImageName, format: "png" | "jpeg" = "png") {
    const count = await this.eventCount();
    await this.page.getByLabel("Upload image", { exact: true }).setInputFiles({ name: `${image}.${format}`, mimeType: `image/${format}`, buffer: imageFile(image, format) });
    await expect.poll(() => this.eventCount()).toBeGreaterThan(count);
    await this.ready();
  }

  async loadUrl(url: string) {
    await this.page.getByRole("textbox", { name: "Image URL", exact: true }).fill(url);
    await this.page.getByRole("button", { name: "Load image", exact: true }).click();
  }

  async isMobile(): Promise<boolean> {
    return this.page.evaluate(() => matchMedia("(max-width: 768px)").matches);
  }

  toolButton(name: string): Locator {
    // History entries can have the same name as a tool (for example "Crop").
    return this.root.getByRole("button", { name, exact: true }).and(this.root.locator('button[data-slot="button"]'));
  }

  async section(name: Section) {
    if (await this.isMobile()) {
      const editTabs: Partial<Record<Section, string>> = {
        Basic: "Basic", "Color Mixer": "Color", "Tone Curve": "Tone", Details: "Details",
        Transform: "Geometry", "Lens Corrections": "Geometry", Optics: "Geometry",
      };
      const tab = editTabs[name];
      const bottom = this.toolButton(tab ? "Edit" : name);
      if (await bottom.getAttribute("aria-pressed") !== "true") await bottom.click();
      if (tab) {
        const button = this.toolButton(tab);
        if (await button.getAttribute("aria-pressed") !== "true") await button.click();
      }
    } else {
      if (name === "Healing") {
        const tool = this.root.getByRole("button", { name: "Healing tool", exact: true });
        if (await tool.getAttribute("aria-pressed") !== "true") await tool.click();
      }
      const summary = this.root.locator("summary").filter({ hasText: new RegExp(`^${name}\\s*▾?$`) });
      const details = summary.locator("..");
      if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await summary.click();
    }
  }

  slider(id: string): Locator { return this.root.locator(`input[type=range]#${id}, input[type=range]#mobile-${id}`); }

  async sliderKey(id: string, key: "Home" | "End" | "ArrowLeft" | "ArrowRight") {
    const slider = this.slider(id);
    await slider.focus();
    await slider.press(key);
    return Number(await slider.inputValue());
  }

  async resetSlider(id: string) {
    await this.slider(id).dblclick();
  }

  async crop() {
    if (!await this.root.getByTestId("crop-region").isVisible()) {
      const button = this.toolButton("Crop");
      // An applied crop can leave the mobile tab open with its controls closed.
      if (await this.isMobile() && await button.getAttribute("aria-pressed") === "true") await button.click();
      await button.click();
    }
    await expect(this.root.getByTestId("crop-region")).toBeVisible();
    await this.settle();
  }

  async aspect(value: string) {
    await this.root.getByRole("combobox", { name: "Aspect ratio", exact: true }).click();
    await this.page.getByRole("option", { name: value, exact: true }).click();
  }

  async customAspect(width: string, height: string) {
    await this.aspect("Custom");
    const dialog = this.page.getByRole("dialog", { name: "Custom Aspect Ratio" });
    await dialog.getByLabel("Width", { exact: true }).fill(width);
    await dialog.getByLabel("Height", { exact: true }).fill(height);
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  }

  async applyCrop() {
    await this.root.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(this.root.getByTestId("crop-region")).toHaveCount(0);
    await expect.poll(async () => (await this.edits())?.crop.committed).toBe(true);
    await this.settle();
  }

  async drag(locator: Locator, dx: number, dy: number) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error("Drag target is not visible");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 8 });
    await this.page.mouse.up();
  }

  async undo(keyboard = false) {
    if (keyboard) await this.page.keyboard.press("Control+z");
    else await this.root.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
    await this.settle();
  }

  async redo(keyboard = false) {
    if (keyboard) await this.page.keyboard.press("Control+Shift+z");
    else await this.root.getByRole("button", { name: "Redo (⇧⌘Z)", exact: true }).click();
    await this.settle();
  }

  async baseline() {
    await this.section("History");
    await this.root.getByTestId("history-entry-0").click();
    await this.settle();
  }

  async stats() {
    return this.canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] < 128) continue;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      const center = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
      return { hash, width: canvas.width, height: canvas.height, center: Array.from(data.slice(center, center + 4)), bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
    });
  }

  async settle() {
    let last: number | undefined;
    let stable = 0;
    await expect.poll(async () => {
      const { hash } = await this.stats();
      stable = hash === last ? stable + 1 : 0;
      last = hash;
      return stable;
    }, { intervals: [80, 80, 80, 80], timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  }

  async imagePoint(x: number, y: number, width: number, height: number) {
    await this.settle();
    const stats = await this.stats();
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error("Preview is not visible");
    return {
      x: box.x + (stats.bounds.x + x / width * stats.bounds.width) * box.width / stats.width,
      y: box.y + (stats.bounds.y + y / height * stats.bounds.height) * box.height / stats.height,
    };
  }

  async download(format: "png" | "jpeg" = "png") {
    const label = format === "jpeg" ? "JPEG" : "PNG";
    const trigger = this.root.getByRole("combobox").filter({ hasText: /^(PNG|JPEG)$/ });
    if ((await trigger.textContent())?.trim() !== label) {
      await trigger.click();
      await this.page.getByRole("option", { name: label, exact: true }).click();
    }
    await this.settle();
    const event = this.page.waitForEvent("download");
    await this.downloadButton.click();
    const download = await event;
    const path = this.info.outputPath(`${++this.downloads}-${download.suggestedFilename()}`);
    await download.saveAs(path);
    expect(await download.failure()).toBeNull();
    this.exportedFiles.push({ path, contentType: `image/${format}` });
    const bytes = await readFile(path);
    return { bytes, pixels: await decodeImage(bytes), path, filename: download.suggestedFilename() };
  }
}
