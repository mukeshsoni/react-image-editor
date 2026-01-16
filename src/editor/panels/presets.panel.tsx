/* eslint-disable react-refresh/only-export-components */

import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import { BUILT_IN_PRESETS, getEffectiveAdjustments } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { useColorStore } from "@/store/colorStore";
import { useLightStore } from "@/store/lightStore";
import { useHistoryLabelStore } from "@/store/historyLabelStore";
import { usePresetStore } from "@/store/presetStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

import type { PresetId } from "@/store/edits";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function PresetsPanelFromContext({ isImageLoaded }: PanelContext) {
  const preset = usePresetStore((state) => state.preset);
  const setPresetIntensity = usePresetStore((state) => state.setPresetIntensity);
  const clearPreset = usePresetStore((state) => state.clearPreset);

  const setPendingHistoryLabel = useHistoryLabelStore(
    (state) => state.setPendingHistoryLabel,
  );

  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const setWhiteBalance = useWhiteBalanceStore((state) => state.setWhiteBalance);

  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const setLightAdjustment = useLightStore((state) => state.setLightAdjustment);

  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const setColorAdjustment = useColorStore((state) => state.setColorAdjustment);


  const applyPreset = (presetId: PresetId) => {
    if (presetId === "none") {
      clearPreset();
      return;
    }

    const presetName =
      BUILT_IN_PRESETS.find((item) => item.id === presetId)?.name ?? "Preset";
    setPendingHistoryLabel(`${presetName} preset`);

    const effective = getEffectiveAdjustments({
      manual: {
        whiteBalance,
        light: lightAdjustments,
        color: colorAdjustments,
      },
      preset: {
        activePresetId: presetId,
        intensity: preset.intensity,
      },
    });

    if (
      whiteBalance.temperatureKelvin !== effective.whiteBalance.temperatureKelvin ||
      whiteBalance.tint !== effective.whiteBalance.tint ||
      whiteBalance.preset !== effective.whiteBalance.preset
    ) {
      setWhiteBalance(effective.whiteBalance);
    }

    for (const [key, value] of Object.entries(effective.light)) {
      const typedKey = key as keyof typeof effective.light;
      if (lightAdjustments[typedKey] !== value) {
        setLightAdjustment(typedKey, value);
      }
    }

    for (const [key, value] of Object.entries(effective.color)) {
      const typedKey = key as keyof typeof effective.color;
      if (colorAdjustments[typedKey] !== value) {
        setColorAdjustment(typedKey, value);
      }
    }

    // Presets are baked into manual sliders (Lightroom-style).
    clearPreset();
  };

  return (
    <div className="mt-4 border-t pt-3" data-testid="presets-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Presets</div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="text-xs text-gray-700" htmlFor="preset-intensity">
          Strength
        </label>

        <div className="flex flex-1 items-center gap-2">
          <DebouncedRange
            id="preset-intensity"
            label="Preset strength"
            value={preset.intensity}
            defaultValue={100}
            min={0}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            onValueChange={setPresetIntensity}
            data-testid="preset-intensity"
          />
          <span className="w-[40px] text-right text-xs tabular-nums text-gray-700">
            {preset.intensity}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={!isImageLoaded}
          onClick={() => setPresetIntensity(100)}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {BUILT_IN_PRESETS.map((item) => {
          return (
            <button
              key={item.id}
              type="button"
              disabled={!isImageLoaded}
              onClick={() => applyPreset(item.id as PresetId)}
              className={cn(
                "h-8 rounded-md border bg-white px-2 text-xs text-gray-700 disabled:opacity-70",
                "border-gray-200 hover:border-gray-900",
              )}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-gray-600">Click a preset to apply it.</div>
    </div>
  );
}

const panel = {
  id: "presets",
  order: 5,
  title: "Presets",
  groupId: "basic",
  Component: PresetsPanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
