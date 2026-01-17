/* eslint-disable react-refresh/only-export-components */
import { ColorMixerPanel } from "@/editor/ColorMixerPanel";
import { useColorStore } from "@/store/colorStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function ColorMixerPanelFromContext({
  isImageLoaded,
  setIsPickingPointColor,
  formatSignedInt,
  Slider,
}: PanelContext) {
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  return (
    <ColorMixerPanel
      isImageLoaded={isImageLoaded}
      colorAdjustments={colorAdjustments}
      setIsPickingPointColor={setIsPickingPointColor}
      formatSignedInt={formatSignedInt}
      Slider={Slider}
    />
  );
}

const panel = {
  id: "color-mixer",
  order: 35,
  title: "Color Mixer",
  groupId: "advanced",
  Component: ColorMixerPanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
