import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <div className="text-xs font-medium text-foreground">White Balance</div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => resetWhiteBalance()}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Preset:</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            data-testid="wb-eyedropper"
            aria-label="Pick white balance from image"
            disabled={!isImageLoaded}
            onClick={() => {
              setIsPickingWhiteBalance((current) => !current);
            }}
          >
            Pick
          </Button>

          <Select
            value={whiteBalance.preset}
            onValueChange={(value) => onPresetChange(value)}
            disabled={!isImageLoaded}
          >
            <SelectTrigger size="sm" className="w-[140px]" aria-label="White Balance">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
