import { describe, expect, test } from "vitest";

import { getPanelRegistry } from "@/editor/panels";

describe("panel registry", () => {
  test("returns panels in stable order", () => {
    const panels = getPanelRegistry();

    expect(panels.map((panel) => panel.id)).toEqual([
      "white-balance",
      "light",
      "color",
      "tone-curve",
    ]);
  });

  test("includes group ids for layout", () => {
    const panels = getPanelRegistry();

    expect(panels.find((panel) => panel.id === "white-balance")?.groupId).toBe(
      "basic",
    );
    expect(panels.find((panel) => panel.id === "tone-curve")?.groupId).toBe(
      "advanced",
    );
  });
});
