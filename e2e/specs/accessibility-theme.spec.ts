import AxeBuilder from "@axe-core/playwright";

import { test, expect } from "../support/test";

test("editor controls have accessible labels and valid ARIA", async ({ editor, page }) => {
  await editor.open();
  await editor.section("Basic");
  const results = await new AxeBuilder({ page }).include('[data-testid="react-image-editor"]')
    .withRules(["aria-input-field-name", "button-name", "label", "aria-required-attr", "aria-allowed-attr", "aria-valid-attr-value"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("custom ratio dialog traps focus and closes with Escape", async ({ editor, page }) => {
  await editor.open();
  await editor.crop();
  await editor.aspect("Custom");
  const dialog = page.getByRole("dialog", { name: "Custom Aspect Ratio" });
  await expect(dialog.getByLabel("Width", { exact: true })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("local theme follows prop changes without recoloring the host", async ({ editor, page }) => {
  await editor.open("grid", { theme: "light" });
  await expect(editor.root).not.toHaveClass(/\bdark\b/);
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
  await expect(editor.root).toHaveClass(/\bdark\b/);
  expect(await page.locator(".test-toolbar").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("light");
  await expect(editor.root).not.toHaveClass(/\bdark\b/);
});

test("system theme follows operating-system preference changes", async ({ editor, page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await editor.open("grid", { theme: "system" });
  await expect(editor.root).not.toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(editor.root).toHaveClass(/\bdark\b/);
});
