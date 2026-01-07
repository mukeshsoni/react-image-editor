import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { PanelSliderProps } from "@/editor/panels/context";
import { DetailsPanel } from "@/editor/DetailsPanel";

function TestSlider({
  label,
  name,
  value,
  min,
  max,
  step,
  disabled,
  onValueChange,
}: PanelSliderProps) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onValueChange(Number((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}

describe("DetailsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders sharpening controls and reset", () => {
    render(
      <DetailsPanel
        isImageLoaded={true}
        sharpening={{ amount: 0, radius: 1, detail: 25, masking: 0 }}
        setSharpening={() => {}}
        resetSharpening={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");
    expect(within(section).getByText("Sharpening")).toBeTruthy();

    expect(within(section).getByLabelText("Amount")).toBeTruthy();
    expect(within(section).getByLabelText("Radius")).toBeTruthy();
    expect(within(section).getByLabelText("Detail")).toBeTruthy();
    expect(within(section).getByLabelText("Masking")).toBeTruthy();

    expect(within(section).getByRole("button", { name: "Reset" })).toBeTruthy();
  });

  test("disables controls when image is not loaded", () => {
    render(
      <DetailsPanel
        isImageLoaded={false}
        sharpening={{ amount: 0, radius: 1, detail: 25, masking: 0 }}
        setSharpening={() => {}}
        resetSharpening={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    expect((within(section).getByLabelText("Amount") as HTMLInputElement).disabled).toBe(true);
    expect((within(section).getByRole("button", { name: "Reset" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("slider changes call setSharpening", () => {
    const setSharpening = vi.fn();

    render(
      <DetailsPanel
        isImageLoaded={true}
        sharpening={{ amount: 0, radius: 1, detail: 25, masking: 0 }}
        setSharpening={setSharpening}
        resetSharpening={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    fireEvent.change(within(section).getByLabelText("Amount"), { target: { value: "10" } });
    expect(setSharpening).toHaveBeenCalledWith({ amount: 10 });

    fireEvent.change(within(section).getByLabelText("Radius"), { target: { value: "2.3" } });
    expect(setSharpening).toHaveBeenCalledWith({ radius: 2.3 });

    fireEvent.change(within(section).getByLabelText("Detail"), { target: { value: "50" } });
    expect(setSharpening).toHaveBeenCalledWith({ detail: 50 });

    fireEvent.change(within(section).getByLabelText("Masking"), { target: { value: "80" } });
    expect(setSharpening).toHaveBeenCalledWith({ masking: 80 });
  });

  test("reset button calls resetSharpening", () => {
    const resetSharpening = vi.fn();

    render(
      <DetailsPanel
        isImageLoaded={true}
        sharpening={{ amount: 10, radius: 1, detail: 25, masking: 0 }}
        setSharpening={() => {}}
        resetSharpening={resetSharpening}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    fireEvent.click(within(section).getByRole("button", { name: "Reset" }));
    expect(resetSharpening).toHaveBeenCalled();
  });
});
