import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";

type Props = {
  isImageLoaded: boolean;
};

function formatSignedInt(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  return `${sign}${Math.abs(rounded)}`;
}

export function GeometryOpticsPanel({ isImageLoaded }: Props) {
  const settings = useGeometryOpticsStore((state) => state.settings);
  const setPerspective = useGeometryOpticsStore((state) => state.setPerspective);
  const setLensCorrections = useGeometryOpticsStore((state) => state.setLensCorrections);
  const setOptics = useGeometryOpticsStore((state) => state.setOptics);
  const resetGeometryOptics = useGeometryOpticsStore((state) => state.resetGeometryOptics);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-gray-700">Geometry & Optics</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={resetGeometryOptics}
          disabled={!isImageLoaded}
        >
          Reset
        </Button>
      </div>

      <div className="border-t pt-3 mt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-700">Perspective</div>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="transform-vertical">
                Vertical
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.perspective.vertical)}
              </span>
            </div>
            <DebouncedRange
              id="transform-vertical"
              label="Vertical"
              value={settings.perspective.vertical}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setPerspective({ vertical: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="transform-horizontal">
                Horizontal
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.perspective.horizontal)}
              </span>
            </div>
            <DebouncedRange
              id="transform-horizontal"
              label="Horizontal"
              value={settings.perspective.horizontal}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setPerspective({ horizontal: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="transform-aspect">
                Aspect
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.perspective.aspect ?? 0)}
              </span>
            </div>
            <DebouncedRange
              id="transform-aspect"
              label="Aspect"
              value={settings.perspective.aspect ?? 0}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setPerspective({ aspect: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-3 mt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-700">Lens Corrections</div>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="lens-distortion">
                Distortion
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.lensCorrections.distortion)}
              </span>
            </div>
            <DebouncedRange
              id="lens-distortion"
              label="Distortion"
              value={settings.lensCorrections.distortion}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setLensCorrections({ distortion: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings.lensCorrections.chromaticAberration}
              onChange={(e) =>
                setLensCorrections({ chromaticAberration: e.target.checked })
              }
              disabled={!isImageLoaded}
            />
            Remove Chromatic Aberration
          </label>
        </div>
      </div>

      <div className="border-t pt-3 mt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-700">Optics</div>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="optics-vignette">
                Vignette
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.optics.vignette)}
              </span>
            </div>
            <DebouncedRange
              id="optics-vignette"
              label="Vignette"
              value={settings.optics.vignette}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setOptics({ vignette: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="optics-grain">
                Grain
              </label>
              <span className="text-xs font-medium tabular-nums">
                {Math.round(settings.optics.grain)}
              </span>
            </div>
            <DebouncedRange
              id="optics-grain"
              label="Grain"
              value={settings.optics.grain}
              defaultValue={0}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => setOptics({ grain: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs" htmlFor="optics-dehaze">
                Dehaze
              </label>
              <span className="text-xs font-medium tabular-nums">
                {formatSignedInt(settings.optics.dehaze)}
              </span>
            </div>
            <DebouncedRange
              id="optics-dehaze"
              label="Dehaze"
              value={settings.optics.dehaze}
              defaultValue={0}
              min={-100}
              max={100}
              step={1}
              onValueChange={(value) => setOptics({ dehaze: value })}
              className="w-full"
              disabled={!isImageLoaded}
            />
          </div>
        </div>
      </div>
    </>
  );
}
