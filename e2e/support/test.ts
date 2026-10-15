import { expect, test as base } from "@playwright/test";

import { EditorDriver } from "./editor";

export const test = base.extend<{ editor: EditorDriver }>({
  editor: async ({ page }, provideEditor, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const editor = new EditorDriver(page, info);
    await provideEditor(editor);
    if (info.status !== info.expectedStatus) {
      for (const [index, file] of editor.exportedFiles.entries()) {
        await info.attach(`download-${index + 1}`, file);
      }
      await info.attach("browser-errors", { body: JSON.stringify(errors), contentType: "application/json" });
      if (await page.getByTestId("edit-events").count()) {
        await info.attach("edit-events", { body: await page.getByTestId("edit-events").textContent() ?? "[]", contentType: "application/json" });
      }
      if (await editor.canvas.count()) {
        const data = await editor.canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
        await info.attach("preview-pixels", { body: Buffer.from(data.split(",")[1], "base64"), contentType: "image/png" });
      }
    }
    expect(errors, "Unexpected browser errors").toEqual([]);
  },
});

export { expect };
import { Buffer } from "node:buffer";
