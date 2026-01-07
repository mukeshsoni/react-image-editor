import { Button } from "@/components/ui/button";
import type { SharpeningSettings } from "@/store/cropStore";

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

  sharpening: SharpeningSettings;
  setSharpening: (updates: Partial<SharpeningSettings>) => void;
  resetSharpening: () => void;

  Slider: (props: SliderProps) => import("react").ReactNode;
};

export function DetailsPanel({
  isImageLoaded,
  sharpening,
  setSharpening,
  resetSharpening,
  Slider,
}: Props) {
  return (
    <div className="mt-4 border-t pt-3" data-testid="details-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Sharpening</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => resetSharpening()}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Slider
          label="Amount"
          name="sharpening-amount"
          value={sharpening.amount}
          defaultValue={0}
          min={0}
          max={150}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => setSharpening({ amount: value })}
        />
        <Slider
          label="Radius"
          name="sharpening-radius"
          value={sharpening.radius}
          defaultValue={1}
          min={0.5}
          max={3}
          step={0.1}
          disabled={!isImageLoaded}
          format={(value) => value.toFixed(1)}
          onValueChange={(value) => setSharpening({ radius: value })}
        />
        <Slider
          label="Detail"
          name="sharpening-detail"
          value={sharpening.detail}
          defaultValue={25}
          min={0}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => setSharpening({ detail: value })}
        />
        <Slider
          label="Masking"
          name="sharpening-masking"
          value={sharpening.masking}
          defaultValue={0}
          min={0}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => setSharpening({ masking: value })}
        />

      </div>
    </div>
  );
}
