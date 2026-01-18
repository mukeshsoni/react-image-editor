import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { PanelSliderProps } from "@/editor/panels/context";

const mockSetMixerBandAdjustment = vi.fn();
const mockSetPointColor = vi.fn();
const mockResetMixerBand = vi.fn();
const mockResetMixer = vi.fn();
const mockResetPointColor = vi.fn();

vi.mock("@/store/colorStore", async () => {
  const actual = await vi.importActual<typeof import("@/store/colorStore")>("@/store/colorStore");

  return {
    ...actual,
    useColorStore: <T,>(selector: (state: unknown) => T) =>
      selector({
        colorAdjustments: {
          vibrance: 0,
          saturation: 0,
          mixerHsl: {
            red: { hue: 10, saturation: 20, luminance: 30 },
            orange: { hue: 0, saturation: 0, luminance: 0 },
            yellow: { hue: 0, saturation: 0, luminance: 0 },
            green: { hue: 0, saturation: 0, luminance: 0 },
            aqua: { hue: 0, saturation: 0, luminance: 0 },
            blue: { hue: -5, saturation: -10, luminance: -15 },
            purple: { hue: 0, saturation: 0, luminance: 0 },
            magenta: { hue: 0, saturation: 0, luminance: 0 },
          },
          pointColor: {
            hue: null,
            range: 50,
            hueShift: 0,
            saturationShift: 0,
            luminanceShift: 0,
          },
        },
        setMixerBandAdjustment: mockSetMixerBandAdjustment,
        resetMixerBand: mockResetMixerBand,
        resetMixer: mockResetMixer,
        setPointColor: mockSetPointColor,
        resetPointColor: mockResetPointColor,
      }),
  };
});

function TestSlider({ label, name, value, disabled, onValueChange }: PanelSliderProps) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}

describe("ColorMixerPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders tabs and switches between Mixer and Point Color", async () => {
    const panel = (await import("@/editor/panels/color-mixer.panel")).default;

    const setIsPickingPointColor = vi.fn();

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={(value) => `${value}`}
        setIsPickingWhiteBalance={() => {}}
        setIsPickingPointColor={setIsPickingPointColor}
      />,
    );

    expect(screen.getByTestId("color-mixer-tab-mixer")).toBeTruthy();
    expect(screen.getByTestId("color-mixer-tab-point-color")).toBeTruthy();

    // Mixer content visible by default.
    expect(screen.getByTestId("color-mixer-tab-panel-mixer")).toBeTruthy();

    fireEvent.click(screen.getByTestId("color-mixer-tab-point-color"));
    expect(screen.getByTestId("color-mixer-tab-panel-point-color")).toBeTruthy();
  });

  test("band selection changes slider values and dispatches mixer updates", async () => {
    const panel = (await import("@/editor/panels/color-mixer.panel")).default;

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={(value) => `${value}`}
        setIsPickingWhiteBalance={() => {}}
        setIsPickingPointColor={() => {}}
      />,
    );

    // Default band is red.
    expect((screen.getByLabelText("Hue") as HTMLInputElement).value).toBe("10");

    fireEvent.click(screen.getByTestId("mixer-band-blue"));
    expect((screen.getByLabelText("Hue") as HTMLInputElement).value).toBe("-5");

    fireEvent.change(screen.getByLabelText("Hue"), { target: { value: "12" } });
    expect(mockSetMixerBandAdjustment).toHaveBeenCalledWith("blue", "hue", 12);
  });

  test("point color sliders dispatch point color updates", async () => {
    const panel = (await import("@/editor/panels/color-mixer.panel")).default;

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={(value) => `${value}`}
        setIsPickingWhiteBalance={() => {}}
        setIsPickingPointColor={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("color-mixer-tab-point-color"));

    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "75" } });
    expect(mockSetPointColor).toHaveBeenCalledWith({ range: 75 });
  });

  test("eyedropper button toggles pick mode", async () => {
    const panel = (await import("@/editor/panels/color-mixer.panel")).default;

    const setIsPickingPointColor = vi.fn();

    render(
      <panel.Component
        isImageLoaded={true}
        Slider={TestSlider}
        formatSigned={() => ""}
        formatSignedInt={(value) => `${value}`}
        setIsPickingWhiteBalance={() => {}}
        setIsPickingPointColor={setIsPickingPointColor}
      />,
    );

    fireEvent.click(screen.getByTestId("color-mixer-tab-point-color"));

    fireEvent.click(screen.getByTestId("point-color-eyedropper"));
    expect(setIsPickingPointColor).toHaveBeenCalledTimes(1);
  });
});
