import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { PanelSliderProps } from "@/editor/panels/context";
import type { useDenoiseStore } from "@/store/denoiseStore";
import type { useSharpeningStore } from "@/store/sharpeningStore";

type SharpeningState = ReturnType<typeof useSharpeningStore.getState>;
type DenoiseState = ReturnType<typeof useDenoiseStore.getState>;

const mockSetSharpening = vi.fn();
const mockResetSharpening = vi.fn();

const mockSetDenoise = vi.fn();
const mockResetDenoise = vi.fn();

vi.mock("@/store/sharpeningStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/sharpeningStore")>("@/store/sharpeningStore");

  return {
    ...actual,
    useSharpeningStore: <T,>(selector: (state: SharpeningState) => T) =>
      selector({
        sharpening: { amount: 0, radius: 1, detail: 25, masking: 0 },
        setSharpening: mockSetSharpening,
        resetSharpening: mockResetSharpening,
      } satisfies SharpeningState),
  };
});

vi.mock("@/store/denoiseStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/denoiseStore")>("@/store/denoiseStore");

  return {
    ...actual,
    useDenoiseStore: <T,>(selector: (state: DenoiseState) => T) =>
      selector({
        denoise: { luminance: 0, color: 0, detail: 50 },
        setDenoise: mockSetDenoise,
        resetDenoise: mockResetDenoise,
      } satisfies DenoiseState),
  };
});

function TestSlider({ label, name, value, min, max, step, disabled, onValueChange }: PanelSliderProps) {
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

describe("details.panel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders Details accordion content", async () => {
    const panel = (await import("@/editor/panels/details.panel")).default;

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={() => ""}
        setIsPickingWhiteBalance={() => {}}
      />,
    );

    const accordion = screen.getByTestId("details-accordion");
    expect(within(accordion).getByText("Details")).toBeTruthy();

    // Content should include our Noise Reduction heading.
    expect(within(accordion).getByText("Noise Reduction")).toBeTruthy();
  });

  test("slider changes call store actions", async () => {
    const panel = (await import("@/editor/panels/details.panel")).default;

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={() => ""}
        setIsPickingWhiteBalance={() => {}}
      />,
    );

    const accordion = screen.getByTestId("details-accordion");

    const luminance = within(accordion).getByLabelText("Luminance");
    fireEvent.change(luminance, { target: { value: "10" } });
    fireEvent.pointerUp(luminance);
    expect(mockSetDenoise).toHaveBeenCalledWith({ luminance: 10 });

    const amount = within(accordion).getByLabelText("Amount");
    fireEvent.change(amount, { target: { value: "5" } });
    fireEvent.pointerUp(amount);
    expect(mockSetSharpening).toHaveBeenCalledWith({ amount: 5 });
  });

  test("reset buttons call correct actions", async () => {
    const panel = (await import("@/editor/panels/details.panel")).default;

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={() => ""}
        setIsPickingWhiteBalance={() => {}}
      />,
    );

    const accordion = screen.getByTestId("details-accordion");
    const buttons = within(accordion).getAllByRole("button", { name: "Reset" });

    fireEvent.click(buttons[0] as HTMLButtonElement);
    expect(mockResetSharpening).toHaveBeenCalled();

    fireEvent.click(buttons[1] as HTMLButtonElement);
    expect(mockResetDenoise).toHaveBeenCalled();
  });
});
