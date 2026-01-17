import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useColorStore } from "@/store/colorStore";
import { COLOR_MIXER_BANDS } from "@/store/cropStore";
import type { ColorAdjustments, ColorMixerBand } from "@/store/cropStore";

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
  setColorAdjustment: (name: "vibrance" | "saturation", value: number) => void;
  setIsPickingPointColor: (updater: (current: boolean) => boolean) => void;
  formatSignedInt: (value: number) => string;
  Slider: (props: SliderProps) => import("react").ReactNode;
};

type TabId = "basic" | "mixer" | "point-color";

export function ColorPanel({
  isImageLoaded,
  colorAdjustments,
  resetColorAdjustments,
  setColorAdjustment,
  setIsPickingPointColor,
  formatSignedInt,
  Slider,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [activeMixerBand, setActiveMixerBand] = useState<ColorMixerBand>("red");

  const setMixerBandAdjustment = useColorStore((state) => state.setMixerBandAdjustment);
  const resetMixerBand = useColorStore((state) => state.resetMixerBand);
  const resetMixer = useColorStore((state) => state.resetMixer);
  const setPointColor = useColorStore((state) => state.setPointColor);
  const resetPointColor = useColorStore((state) => state.resetPointColor);

  const tabButtonClass = useMemo(
    () =>
      cn(
        "h-7 px-2 text-xs",
        "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
      ),
    [],
  );

  return (
    <div className="mt-4 border-t pt-3" data-testid="color-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Color</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => {
            if (activeTab === "basic") {
              resetColorAdjustments();
            } else if (activeTab === "mixer") {
              resetMixer();
            } else {
              resetPointColor();
            }
          }}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 flex gap-1" role="tablist" aria-label="Color panel tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "basic"}
          className={cn(tabButtonClass, activeTab === "basic" && "bg-accent")}
          onClick={() => setActiveTab("basic")}
          disabled={!isImageLoaded}
          data-testid="color-tab-basic"
        >
          Basic
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mixer"}
          className={cn(tabButtonClass, activeTab === "mixer" && "bg-accent")}
          onClick={() => setActiveTab("mixer")}
          disabled={!isImageLoaded}
          data-testid="color-tab-mixer"
        >
          Mixer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "point-color"}
          className={cn(tabButtonClass, activeTab === "point-color" && "bg-accent")}
          onClick={() => setActiveTab("point-color")}
          disabled={!isImageLoaded}
          data-testid="color-tab-point-color"
        >
          Point Color
        </button>
      </div>

      {activeTab === "basic" ? (
        <div className="mt-3 flex flex-col gap-3" data-testid="color-tab-panel-basic">
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
      ) : null}

      {activeTab === "mixer" ? (
        <div className="mt-3 flex flex-col gap-3" data-testid="color-tab-panel-mixer">
          <div className="flex flex-wrap gap-1" aria-label="Mixer bands">
            {COLOR_MIXER_BANDS.map((band) => (
              <button
                key={band}
                type="button"
                className={cn(
                  tabButtonClass,
                  "capitalize",
                  activeMixerBand === band && "bg-accent",
                )}
                onClick={() => setActiveMixerBand(band)}
                disabled={!isImageLoaded}
                data-testid={`mixer-band-${band}`}
              >
                {band}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-700 capitalize">{activeMixerBand}</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => resetMixerBand(activeMixerBand)}
              disabled={!isImageLoaded}
            >
              Reset band
            </Button>
          </div>

          <Slider
            label="Hue"
            name={`mixer-${activeMixerBand}-hue`}
            value={colorAdjustments.mixerHsl[activeMixerBand].hue}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) =>
              setMixerBandAdjustment(activeMixerBand, "hue", value)
            }
          />
          <Slider
            label="Saturation"
            name={`mixer-${activeMixerBand}-saturation`}
            value={colorAdjustments.mixerHsl[activeMixerBand].saturation}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) =>
              setMixerBandAdjustment(activeMixerBand, "saturation", value)
            }
          />
          <Slider
            label="Luminance"
            name={`mixer-${activeMixerBand}-luminance`}
            value={colorAdjustments.mixerHsl[activeMixerBand].luminance}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) =>
              setMixerBandAdjustment(activeMixerBand, "luminance", value)
            }
          />

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => resetMixer()}
            disabled={!isImageLoaded}
          >
            Reset mixer
          </Button>
        </div>
      ) : null}

      {activeTab === "point-color" ? (
        <div className="mt-3 flex flex-col gap-3" data-testid="color-tab-panel-point-color">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-700">Point Color</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => resetPointColor()}
              disabled={!isImageLoaded}
            >
              Reset
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setIsPickingPointColor((current) => !current)}
            disabled={!isImageLoaded}
            data-testid="point-color-eyedropper"
          >
            Pick
          </Button>

          <Slider
            label="Hue Shift"
            name="point-color-hue"
            value={colorAdjustments.pointColor.hueShift}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) => setPointColor({ hueShift: value })}
          />
          <Slider
            label="Sat. Shift"
            name="point-color-saturation"
            value={colorAdjustments.pointColor.saturationShift}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) => setPointColor({ saturationShift: value })}
          />
          <Slider
            label="Lum. Shift"
            name="point-color-luminance"
            value={colorAdjustments.pointColor.luminanceShift}
            defaultValue={0}
            min={-100}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => formatSignedInt(value)}
            onValueChange={(value) => setPointColor({ luminanceShift: value })}
          />

          <Slider
            label="Range"
            name="point-color-range"
            value={colorAdjustments.pointColor.range}
            defaultValue={50}
            min={0}
            max={100}
            step={1}
            disabled={!isImageLoaded}
            format={(value) => `${Math.round(value)}`}
            onValueChange={(value) => setPointColor({ range: value })}
          />
        </div>
      ) : null}
    </div>
  );
}
