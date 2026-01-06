import { Button } from "@/components/ui/button";
import type { LightAdjustments } from "@/store/cropStore";

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
  lightAdjustments: LightAdjustments;
  resetLightAdjustments: () => void;
  setLightAdjustment: (name: keyof LightAdjustments, value: number) => void;
  formatSigned: (value: number, digits: number) => string;
  formatSignedInt: (value: number) => string;
  Slider: (props: SliderProps) => import("react").ReactNode;
};

export function LightPanel({
  isImageLoaded,
  lightAdjustments,
  resetLightAdjustments,
  setLightAdjustment,
  formatSigned,
  formatSignedInt,
  Slider,
}: Props) {
  return (
    <div className="mt-4 border-t pt-3" data-testid="tone-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Tone</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => resetLightAdjustments()}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Slider
          label="Exposure"
          name="exposure"
          value={lightAdjustments.exposure}
          defaultValue={0}
          min={-2}
          max={2}
          step={0.01}
          disabled={!isImageLoaded}
          format={(value) => formatSigned(value, 2)}
          onValueChange={(value) => setLightAdjustment("exposure", value)}
        />

        <Slider
          label="Contrast"
          name="contrast"
          value={lightAdjustments.contrast}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setLightAdjustment("contrast", value)}
        />

        <Slider
          label="Highlights"
          name="highlights"
          value={lightAdjustments.highlights}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setLightAdjustment("highlights", value)}
        />

        <Slider
          label="Shadows"
          name="shadows"
          value={lightAdjustments.shadows}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setLightAdjustment("shadows", value)}
        />

        <Slider
          label="Whites"
          name="whites"
          value={lightAdjustments.whites}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setLightAdjustment("whites", value)}
        />

        <Slider
          label="Blacks"
          name="blacks"
          value={lightAdjustments.blacks}
          defaultValue={0}
          min={-100}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => formatSignedInt(value)}
          onValueChange={(value) => setLightAdjustment("blacks", value)}
        />
      </div>
    </div>
  );
}
