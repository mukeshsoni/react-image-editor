import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DenoiseSettings, SharpeningSettings } from "@/store/cropStore";

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

  denoise: DenoiseSettings;
  setDenoise: (updates: Partial<DenoiseSettings>) => void;
  resetDenoise: () => void;

  Slider: (props: SliderProps) => import("react").ReactNode;
};

export function DetailsPanel({
  isImageLoaded,
  sharpening,
  setSharpening,
  resetSharpening,
  denoise,
  setDenoise,
  resetDenoise,
  Slider,
}: Props) {
  const [denoiseDraft, setDenoiseDraft] = useState<DenoiseSettings>(denoise);
  const denoiseDraftRef = useRef<DenoiseSettings>(denoise);
  const denoiseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDenoiseDraft(denoise);
    denoiseDraftRef.current = denoise;
  }, [denoise]);

  useEffect(() => {
    return () => {
      if (denoiseTimeoutRef.current) {
        clearTimeout(denoiseTimeoutRef.current);
      }
    };
  }, []);

  const commitDenoise = useMemo(() => {
    return (next: DenoiseSettings) => {
      denoiseDraftRef.current = next;
      if (denoiseTimeoutRef.current) {
        clearTimeout(denoiseTimeoutRef.current);
      }

      // Debounce expensive pixel processing during active slider drag.
      denoiseTimeoutRef.current = setTimeout(() => {
        setDenoise(denoiseDraftRef.current);
      }, 150);
    };
  }, [setDenoise]);
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

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Noise Reduction</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => resetDenoise()}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Slider
          label="Luminance"
          name="denoise-luminance"
          value={denoiseDraft.luminance}
          defaultValue={0}
          min={0}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => {
            const next = {
              ...denoiseDraftRef.current,
              luminance: value,
            };
            setDenoiseDraft(next);
            commitDenoise(next);
          }}
        />
        <Slider
          label="Color"
          name="denoise-color"
          value={denoiseDraft.color}
          defaultValue={0}
          min={0}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => {
            const next = {
              ...denoiseDraftRef.current,
              color: value,
            };
            setDenoiseDraft(next);
            commitDenoise(next);
          }}
        />
        <Slider
          label="Detail"
          name="denoise-detail"
          value={denoiseDraft.detail}
          defaultValue={50}
          min={0}
          max={100}
          step={1}
          disabled={!isImageLoaded}
          format={(value) => String(Math.round(value))}
          onValueChange={(value) => {
            const next = {
              ...denoiseDraftRef.current,
              detail: value,
            };
            setDenoiseDraft(next);
            commitDenoise(next);
          }}
        />
      </div>
    </div>
  );
}
