import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DebouncedRange } from "@/components/DebouncedRange";
import { useHealingStore } from "@/store/healingStore";

type HealingToolButtonsProps = {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
};

export function HealingToolButtons({ enabled, disabled, onToggle }: HealingToolButtonsProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={
        enabled
          ? "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-gray-900 text-white h-9 px-3"
          : "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3"
      }
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label="Healing tool"
    >
      Healing
    </button>
  );
}

type Props = {
  enabled: boolean;
  isImageLoaded: boolean;
};

export function HealingToolPanel({ enabled, isImageLoaded }: Props) {
  const mode = useHealingStore((state) => state.healingMode);
  const brush = useHealingStore((state) => state.healingBrush);
  const opsCount = useHealingStore((state) => state.healingOps.length);
  const cloneSource = useHealingStore((state) => state.cloneSource);

  const setMode = useHealingStore((state) => state.setHealingMode);
  const setBrush = useHealingStore((state) => state.setHealingBrushSettings);
  const clear = useHealingStore((state) => state.clearHealingOps);

  if (!enabled) {
    return null;
  }

  return (
    <div className="px-3 pb-3" data-testid="healing-panel">
      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-700">Healing</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={clear}
            disabled={!isImageLoaded || opsCount === 0}
            aria-label="Clear healing strokes"
          >
            Clear
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-gray-700" htmlFor="healing-mode">
              Mode
            </label>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as typeof mode)}
              disabled={!isImageLoaded}
            >
              <SelectTrigger
                id="healing-mode"
                size="sm"
                className="w-[110px]"
                data-testid="healing-mode"
              >
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spot">Spot</SelectItem>
                <SelectItem value="heal">Heal</SelectItem>
                <SelectItem value="clone">Clone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-700" htmlFor="healing-size">
                Brush size
              </label>
              <span className="text-xs tabular-nums text-gray-700 w-[52px] text-right">
                {Math.round(brush.size)}
              </span>
            </div>
            <DebouncedRange
              id="healing-size"
              label="Brush size"
              value={brush.size}
              defaultValue={30}
              min={5}
              max={200}
              step={1}
              disabled={!isImageLoaded}
              className="w-full"
              data-testid="healing-size"
              onValueChange={(value) => setBrush({ size: value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-700" htmlFor="healing-feather">
                Feather
              </label>
              <span className="text-xs tabular-nums text-gray-700 w-[52px] text-right">
                {Math.round(brush.feather)}
              </span>
            </div>
            <DebouncedRange
              id="healing-feather"
              label="Feather"
              value={brush.feather}
              defaultValue={50}
              min={0}
              max={100}
              step={1}
              disabled={!isImageLoaded}
              className="w-full"
              data-testid="healing-feather"
              onValueChange={(value) => setBrush({ feather: value })}
            />
          </div>

          {mode === "clone" ? (
            <div className="text-xs text-gray-600">
              Hold Alt/Option and click to set clone source{cloneSource ? " (set)" : ""}
            </div>
          ) : null}

          <div className="text-xs text-gray-600">Pan: hold Space + drag</div>
        </div>
      </div>
    </div>
  );
}
