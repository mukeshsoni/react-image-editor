/* eslint-disable react-refresh/only-export-components */
import { useMemo } from "react";

import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import { BUILT_IN_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { usePresetStore } from "@/store/presetStore";

import type { PresetId } from "@/store/edits";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function PresetsPanelFromContext({ isImageLoaded }: PanelContext) {
  const preset = usePresetStore((state) => state.preset);
  const setActivePreset = usePresetStore((state) => state.setActivePreset);
  const setPresetIntensity = usePresetStore((state) => state.setPresetIntensity);
  const clearPreset = usePresetStore((state) => state.clearPreset);

  const activePreset = useMemo(() => {
    return BUILT_IN_PRESETS.find((item) => item.id === preset.activePresetId) ?? BUILT_IN_PRESETS[0];
  }, [preset.activePresetId]);

  return (
    <div className="mt-4 border-t pt-3" data-testid="presets-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Presets</div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {BUILT_IN_PRESETS.map((item) => {
          const isSelected = item.id === preset.activePresetId;

          return (
            <button
              key={item.id}
              type="button"
              disabled={!isImageLoaded}
              onClick={() => setActivePreset(item.id as PresetId)}
              aria-pressed={isSelected}
              className={cn(
                "h-8 rounded-md border bg-white px-2 text-xs text-gray-700 disabled:opacity-70",
                isSelected ? "border-gray-900" : "border-gray-200",
              )}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      {preset.activePresetId !== "none" ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="text-xs text-gray-700" htmlFor="preset-intensity">
            Intensity
          </label>

          <div className="flex flex-1 items-center gap-2">
            <DebouncedRange
              id="preset-intensity"
              label="Preset intensity"
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
            onClick={() => {
              clearPreset();
            }}
          >
            Clear
          </Button>
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-600">None selected</div>
      )}

      {activePreset?.id !== "none" ? (
        <div className="mt-1 text-xs text-gray-500">Selected: {activePreset.name}</div>
      ) : null}
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
