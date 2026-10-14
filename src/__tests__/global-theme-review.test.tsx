import { StrictMode } from "react";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { useGlobalTheme } from "../hooks/use-global-theme";

function Owner({ dark = true }: { dark?: boolean }) {
  useGlobalTheme(dark ? "dark" : "light", true);
  return null;
}

afterEach(() => { cleanup(); document.documentElement.classList.remove("dark"); });

describe("review: global theme ownership", () => {
  for (const reverse of [false, true]) {
    test(`restores the host after two editors unmount (reverse=${reverse})`, () => {
      const first = render(<Owner />), second = render(<Owner />);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      (reverse ? second : first).unmount();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      (reverse ? first : second).unmount();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  }

  test("preserves a dark host through Strict Mode, updates, and mixed owners", () => {
    document.documentElement.classList.add("dark");
    const first = render(<StrictMode><Owner dark={false} /></StrictMode>);
    const second = render(<Owner />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    second.unmount(); expect(document.documentElement.classList.contains("dark")).toBe(false);
    first.rerender(<StrictMode><Owner /></StrictMode>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    first.unmount(); expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
