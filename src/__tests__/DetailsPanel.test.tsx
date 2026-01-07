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
        denoise={{ luminance: 0, color: 0, detail: 50 }}
        setDenoise={() => {}}
        resetDenoise={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");
    expect(within(section).getByText("Sharpening")).toBeTruthy();

    expect(within(section).getByLabelText("Amount")).toBeTruthy();
    expect(within(section).getByLabelText("Radius")).toBeTruthy();
    expect(within(section).getByLabelText("Detail", { selector: "#sharpening-detail" })).toBeTruthy();
    expect(within(section).getByLabelText("Masking")).toBeTruthy();

    expect(within(section).getAllByRole("button", { name: "Reset" })).toHaveLength(2);

    expect(within(section).getByText("Noise Reduction")).toBeTruthy();
    expect(within(section).getByLabelText("Luminance")).toBeTruthy();
    expect(within(section).getByLabelText("Color")).toBeTruthy();
    expect(within(section).getByLabelText("Detail", { selector: "#denoise-detail" })).toBeTruthy();
  });

  test("disables controls when image is not loaded", () => {
    render(
      <DetailsPanel
        isImageLoaded={false}
        sharpening={{ amount: 0, radius: 1, detail: 25, masking: 0 }}
        setSharpening={() => {}}
        resetSharpening={() => {}}
        denoise={{ luminance: 0, color: 0, detail: 50 }}
        setDenoise={() => {}}
        resetDenoise={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    expect((within(section).getByLabelText("Amount") as HTMLInputElement).disabled).toBe(true);
    for (const button of within(section).getAllByRole("button", { name: "Reset" })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  test("slider changes call setSharpening and setDenoise", () => {
    const setSharpening = vi.fn();
    const setDenoise = vi.fn();

    render(
      <DetailsPanel
        isImageLoaded={true}
        sharpening={{ amount: 0, radius: 1, detail: 25, masking: 0 }}
        setSharpening={setSharpening}
        resetSharpening={() => {}}
        denoise={{ luminance: 0, color: 0, detail: 50 }}
        setDenoise={setDenoise}
        resetDenoise={() => {}}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    fireEvent.change(within(section).getByLabelText("Amount"), { target: { value: "10" } });
    expect(setSharpening).toHaveBeenCalledWith({ amount: 10 });

    fireEvent.change(within(section).getByLabelText("Radius"), { target: { value: "2.3" } });
    expect(setSharpening).toHaveBeenCalledWith({ radius: 2.3 });

    fireEvent.change(within(section).getByLabelText("Detail", { selector: "#sharpening-detail" }), {
      target: { value: "50" },
    });
    expect(setSharpening).toHaveBeenCalledWith({ detail: 50 });

    fireEvent.change(within(section).getByLabelText("Masking"), { target: { value: "80" } });
    expect(setSharpening).toHaveBeenCalledWith({ masking: 80 });

    fireEvent.change(within(section).getByLabelText("Luminance"), { target: { value: "15" } });
    expect(setDenoise).toHaveBeenCalledWith({ luminance: 15 });

    fireEvent.change(within(section).getByLabelText("Color"), { target: { value: "35" } });
    expect(setDenoise).toHaveBeenCalledWith({ color: 35 });

    fireEvent.change(within(section).getByLabelText("Detail", { selector: "#denoise-detail" }), {
      target: { value: "90" },
    });
    expect(setDenoise).toHaveBeenCalledWith({ detail: 90 });
  });

  test("reset buttons call correct reset actions", () => {
    const resetSharpening = vi.fn();
    const resetDenoise = vi.fn();

    render(
      <DetailsPanel
        isImageLoaded={true}
        sharpening={{ amount: 10, radius: 1, detail: 25, masking: 0 }}
        setSharpening={() => {}}
        resetSharpening={resetSharpening}
        denoise={{ luminance: 10, color: 20, detail: 50 }}
        setDenoise={() => {}}
        resetDenoise={resetDenoise}
        Slider={TestSlider}
      />,
    );

    const section = screen.getByTestId("details-section");

    const buttons = within(section).getAllByRole("button", { name: "Reset" });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0] as HTMLButtonElement);
    expect(resetSharpening).toHaveBeenCalled();

    fireEvent.click(buttons[1] as HTMLButtonElement);
    expect(resetDenoise).toHaveBeenCalled();
  });
});
