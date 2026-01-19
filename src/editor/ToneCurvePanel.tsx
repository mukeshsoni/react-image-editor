import type { ReactNode } from "react";

import { useLocalStorageBoolean } from "@/hooks/useLocalStorageBoolean";

import { Button } from "@/components/ui/button";
import { ToneCurveEditor } from "@/components/ToneCurveEditor";
import type {
  CurvePoint,
  ToneCurveChannel,
  ToneCurveSettings,
} from "@/store/cropStore";

type Props = {
  isImageLoaded: boolean;
  toneCurve: ToneCurveSettings;
  resetToneCurve: () => void;
  setToneCurveMode: (mode: ToneCurveSettings["mode"]) => void;
  setToneCurveChannel: (channel: ToneCurveChannel) => void;
  setToneCurvePoints: (channel: ToneCurveChannel, points: CurvePoint[]) => void;
  setToneCurveParametricRgb: (updates: {
    highlights?: number;
    lights?: number;
    darks?: number;
    shadows?: number;
  }) => void;
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
  formatSignedInt: (value: number) => string;
};

export function ToneCurvePanel({
  isImageLoaded,
  toneCurve,
  resetToneCurve,
  setToneCurveMode,
  setToneCurveChannel,
  setToneCurvePoints,
  setToneCurveParametricRgb,
  Slider,
  formatSignedInt,
}: Props) {
  const toggleClass = "h-7 rounded-md border px-2 text-xs bg-background text-foreground hover:bg-accent";
  const toggleActiveClass = "bg-primary text-primary-foreground";

  const [isToneCurveAccordionOpen, setIsToneCurveAccordionOpen] =
    useLocalStorageBoolean({
      key: "react-image-editor:accordion:tone-curve",
      defaultValue: false,
    });

  return (
    <details
      className="rounded-md border bg-card"
      data-testid="tone-curve-accordion"
      open={isToneCurveAccordionOpen}
      onToggle={(event) => {
        setIsToneCurveAccordionOpen((event.target as HTMLDetailsElement).open);
      }}
    >
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span>Tone Curve</span>
        </span>
        <span className="text-xs text-muted-foreground">▾</span>
      </summary>

      <div className="px-3 pb-3">
        <div className="flex items-center justify-between py-2">
          <div className="text-xs font-medium text-foreground">Tone Curve</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => resetToneCurve()}
            disabled={!isImageLoaded}
          >
            Reset
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Mode:</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${toggleClass} ${toneCurve.mode === "point" ? toggleActiveClass : ""}`}
                onClick={() => setToneCurveMode("point")}
                disabled={!isImageLoaded}
                aria-label="Tone Curve mode: Point"
              >
                Point
              </button>
              <button
                type="button"
                className={`${toggleClass} ${toneCurve.mode === "parametric" ? toggleActiveClass : ""}`}
                onClick={() => setToneCurveMode("parametric")}
                disabled={!isImageLoaded}
                aria-label="Tone Curve mode: Parametric"
              >
                Region
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Adjust:</div>
            <div className="flex items-center gap-2">
              {([
                { key: "rgb", label: "RGB" },
                { key: "r", label: "R" },
                { key: "g", label: "G" },
                { key: "b", label: "B" },
              ] as const).map((channel) => (
                <button
                  key={channel.key}
                  type="button"
                  className={`${toggleClass} ${toneCurve.activeChannel === channel.key ? toggleActiveClass : ""}`}
                  onClick={() => setToneCurveChannel(channel.key)}
                  disabled={!isImageLoaded}
                  aria-label={`Tone Curve channel: ${channel.label}`}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          <ToneCurveEditor
            points={toneCurve.point[toneCurve.activeChannel]}
            onChangePoints={(nextPoints) =>
              setToneCurvePoints(toneCurve.activeChannel, nextPoints)
            }
            disabled={!isImageLoaded || toneCurve.mode !== "point"}
          />

          <div className="border-t pt-3">
            <div className="text-xs font-medium text-foreground">Region</div>
            <div className="mt-3 flex flex-col gap-3">
              <Slider
                label="Highlights"
                name="tone-curve-highlights"
                value={toneCurve.parametric.rgb.highlights}
                defaultValue={0}
                min={-100}
                max={100}
                step={1}
                disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                format={(value) => formatSignedInt(value)}
                onValueChange={(value) => setToneCurveParametricRgb({ highlights: value })}
              />
              <Slider
                label="Lights"
                name="tone-curve-lights"
                value={toneCurve.parametric.rgb.lights}
                defaultValue={0}
                min={-100}
                max={100}
                step={1}
                disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                format={(value) => formatSignedInt(value)}
                onValueChange={(value) => setToneCurveParametricRgb({ lights: value })}
              />
              <Slider
                label="Darks"
                name="tone-curve-darks"
                value={toneCurve.parametric.rgb.darks}
                defaultValue={0}
                min={-100}
                max={100}
                step={1}
                disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                format={(value) => formatSignedInt(value)}
                onValueChange={(value) => setToneCurveParametricRgb({ darks: value })}
              />
              <Slider
                label="Shadows"
                name="tone-curve-shadows"
                value={toneCurve.parametric.rgb.shadows}
                defaultValue={0}
                min={-100}
                max={100}
                step={1}
                disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                format={(value) => formatSignedInt(value)}
                onValueChange={(value) => setToneCurveParametricRgb({ shadows: value })}
              />
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
