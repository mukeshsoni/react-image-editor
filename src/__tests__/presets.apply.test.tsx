import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  mockSetLightAdjustment: vi.fn(),
  mockSetColorAdjustment: vi.fn(),
  mockSetWhiteBalance: vi.fn(),
  mockClearPreset: vi.fn(),
}));

const mockSetLightAdjustment = hoisted.mockSetLightAdjustment;
const mockSetColorAdjustment = hoisted.mockSetColorAdjustment;
const mockSetWhiteBalance = hoisted.mockSetWhiteBalance;
const mockClearPreset = hoisted.mockClearPreset;

import panel from "../editor/panels/presets.panel";

vi.mock("../store/lightStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useLightStore: createMockZustandHook({
      lightAdjustments: {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
      },
      setLightAdjustment: hoisted.mockSetLightAdjustment,
    }),
  };
});

vi.mock("../store/colorStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useColorStore: createMockZustandHook({
      colorAdjustments: {
        vibrance: 0,
        saturation: 0,
      },
      setColorAdjustment: hoisted.mockSetColorAdjustment,
    }),
  };
});

vi.mock("../store/whiteBalanceStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    useWhiteBalanceStore: createMockZustandHook({
      whiteBalance: {
        temperatureKelvin: 6500,
        tint: 0,
        preset: "custom",
      },
      setWhiteBalance: hoisted.mockSetWhiteBalance,
    }),
  };
});

vi.mock("../store/presetStore", async () => {
  const { createMockZustandHook } = await import("./test-helpers/mockZustandHook");

  return {
    usePresetStore: createMockZustandHook({
      preset: {
        activePresetId: "none",
        intensity: 100,
      },
      setPresetIntensity: vi.fn(),
      clearPreset: hoisted.mockClearPreset,
    }),
  };
});

afterEach(() => {
  cleanup();
});

describe("Presets panel", () => {
  test("clicking a preset writes values into stores", () => {
    render(
      <panel.Component
        isImageLoaded
        Slider={() => null}
        formatSigned={() => ""}
        formatSignedInt={() => ""}
        setIsPickingWhiteBalance={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vibrant" }));

    expect(mockSetLightAdjustment).toHaveBeenCalledWith("contrast", 10);
    expect(mockSetColorAdjustment).toHaveBeenCalledWith("vibrance", 30);
    expect(mockSetColorAdjustment).toHaveBeenCalledWith("saturation", 15);

    expect(mockSetWhiteBalance).not.toHaveBeenCalled();
    expect(mockClearPreset).toHaveBeenCalled();
  });
});
