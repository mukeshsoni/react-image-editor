import type { ReactNode } from "react";

import type { WhiteBalanceSettings } from "@/store/cropStore";

type Props = {
  isImageLoaded: boolean;
  whiteBalance: WhiteBalanceSettings;
  resetWhiteBalance: () => void;
  setIsPickingWhiteBalance: (updater: (current: boolean) => boolean) => void;
  onPresetChange: (preset: string) => void;
  onTempChange: (value: number) => void;
  onTintChange: (value: number) => void;
  presets: ReadonlyArray<{ value: string; label: string }>;
  formatSignedInt: (value: number) => string;
  Slider: (props: {
    label: string;
    name: string;
    value: number;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
    disabled: boolean;
    format: (value: number) => string;
    onValueChange: (value: number) => void;
  }) => ReactNode;
};

export function WhiteBalancePanel({
  isImageLoaded,
  whiteBalance,
  resetWhiteBalance,
  setIsPickingWhiteBalance,
  onPresetChange,
  onTempChange,
  onTintChange,
  presets,
  formatSignedInt,
  Slider,
}: Props) {
  return (
    <div className="mt-4 border-t pt-3" data-testid="wb-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">White Balance</div>

        <button
          type="button"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 px-2 text-xs disabled:opacity-70"
          onClick={() => resetWhiteBalance()}
          disabled={!isImageLoaded}
        >
          Reset
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-600">Preset:</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-md border bg-white px-2 text-xs text-gray-700 disabled:opacity-70"
            data-testid="wb-eyedropper"
            aria-label="Pick white balance from image"
            disabled={!isImageLoaded}
            onClick={() => {
              setIsPickingWhiteBalance((current) => !current);
            }}
          >
            Pick
          </button>

          <select
            value={whiteBalance.preset}
            onChange={(e) => onPresetChange(e.target.value)}
            disabled={!isImageLoaded}
            aria-label="White Balance"
            className="h-8 w-[140px] rounded-md border bg-white px-2 text-xs text-gray-700 disabled:opacity-70"
          >
            {presets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Slider
          label="Temp"
          name="temp"
          value={whiteBalance.temperatureKelvin}
          defaultValue={6500}
          min={2000}
          max={10000}
          step={50}
          disabled={!isImageLoaded}
          format={(value) => `${Math.round(value)}K`}
          onValueChange={onTempChange}
        />
        <Slider
          label="Tint"
          name="tint"
          value={whiteBalance.tint}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={onTintChange}
        />
      </div>
    </div>
  );
}
