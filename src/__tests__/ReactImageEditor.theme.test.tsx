import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { ReactImageEditor } from "@/ReactImageEditor";

beforeAll(() => {
  // jsdom doesn't implement canvas; editor components call getContext().
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: vi.fn(() => null),
  });
});

afterEach(() => {
  cleanup();
});

describe("ReactImageEditor theming", () => {
  test("applies local dark class when themeScope=local and themeMode=dark", () => {
    const { getByTestId } = render(
      <ReactImageEditor imageSrc="https://example.com/image.jpg" themeMode="dark" themeScope="local" />,
    );

    expect(getByTestId("react-image-editor").className).toContain("dark");
  });

  test("does not apply local dark class when themeMode=light", () => {
    const { getByTestId } = render(
      <ReactImageEditor imageSrc="https://example.com/image.jpg" themeMode="light" themeScope="local" />,
    );

    expect(getByTestId("react-image-editor").className).not.toContain("dark");
  });

  test("follows themeMode prop changes on the mounted editor", () => {
    const { getByTestId, rerender } = render(
      <ReactImageEditor imageSrc="image.png" themeMode="light" />,
    );
    rerender(<ReactImageEditor imageSrc="image.png" themeMode="dark" />);
    expect(getByTestId("react-image-editor").className).toContain("dark");
    rerender(<ReactImageEditor imageSrc="image.png" themeMode="light" />);
    expect(getByTestId("react-image-editor").className).not.toContain("dark");
  });
});
