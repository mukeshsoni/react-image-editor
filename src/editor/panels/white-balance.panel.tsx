import { WhiteBalancePanel } from "@/editor/WhiteBalancePanel";
import { WHITE_BALANCE_PRESETS } from "@/lib/white-balance";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

const WHITE_BALANCE_PRESETS_UI = [
  { value: "daylight", label: "Daylight" },
  { value: "cloudy", label: "Cloudy" },
  { value: "shade", label: "Shade" },
  { value: "tungsten", label: "Tungsten" },
  { value: "fluorescent", label: "Fluorescent" },
  { value: "flash", label: "Flash" },
  { value: "custom", label: "Custom" },
] as const;

function WhiteBalancePanelFromContext({
  isImageLoaded,
  setIsPickingWhiteBalance,
  formatSignedInt,
  Slider,
}: PanelContext) {
  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const resetWhiteBalance = useWhiteBalanceStore((state) => state.resetWhiteBalance);
  const setWhiteBalance = useWhiteBalanceStore((state) => state.setWhiteBalance);
  return (
    <WhiteBalancePanel
      isImageLoaded={isImageLoaded}
      whiteBalance={whiteBalance}
      resetWhiteBalance={resetWhiteBalance}
      setIsPickingWhiteBalance={setIsPickingWhiteBalance}
      presets={WHITE_BALANCE_PRESETS_UI}
      formatSignedInt={formatSignedInt}
      Slider={Slider}
      onPresetChange={(nextPreset) => {
        const preset =
          nextPreset as (typeof WHITE_BALANCE_PRESETS_UI)[number]["value"];

        if (preset === "custom") {
          setWhiteBalance({ preset: "custom" });
          return;
        }

        const presetKey = preset as keyof typeof WHITE_BALANCE_PRESETS;
        const presetValues = WHITE_BALANCE_PRESETS[presetKey];

        setWhiteBalance({
          preset,
          temperatureKelvin: presetValues.temperatureKelvin,
          tint: presetValues.tint,
        });
      }}
      onTempChange={(value) => setWhiteBalance({ temperatureKelvin: value })}
      onTintChange={(value) => setWhiteBalance({ tint: value })}
    />
  );
}

const panel = {
  id: "white-balance",
  order: 10,
  title: "White Balance",
  groupId: "basic",
  Component: WhiteBalancePanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
