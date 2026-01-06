import { Button } from "@/components/ui/button";
import type { ColorAdjustments } from "@/store/cropStore";

type SliderProps = {
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
};

type Props = {
  isImageLoaded: boolean;
  colorAdjustments: ColorAdjustments;
  resetColorAdjustments: () => void;
  setColorAdjustment: (name: keyof ColorAdjustments, value: number) => void;
  formatSignedInt: (value: number) => string;
  Slider: (props: SliderProps) => import("react").ReactNode;
};

export function ColorPanel({
  isImageLoaded,
  colorAdjustments,
  resetColorAdjustments,
  setColorAdjustment,
  formatSignedInt,
  Slider,
}: Props) {
  return (
    <div className="mt-4 border-t pt-3" data-testid="color-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Color</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => resetColorAdjustments()}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Slider
          label="Vibrance"
          name="vibrance"
          value={colorAdjustments.vibrance}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setColorAdjustment("vibrance", value)}
        />
        <Slider
          label="Saturation"
          name="saturation"
          value={colorAdjustments.saturation}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setColorAdjustment("saturation", value)}
        />
      </div>
    </div>
  );
}
