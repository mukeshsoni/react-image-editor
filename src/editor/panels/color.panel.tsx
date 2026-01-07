/* eslint-disable react-refresh/only-export-components */
import { ColorPanel } from "@/editor/ColorPanel";
import { useColorStore } from "@/store/colorStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function ColorPanelFromContext({
  isImageLoaded,
  formatSignedInt,
  Slider,
}: PanelContext) {
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const resetColorAdjustments = useColorStore((state) => state.resetColorAdjustments);
  const setColorAdjustment = useColorStore((state) => state.setColorAdjustment);
  return (
    <ColorPanel
      isImageLoaded={isImageLoaded}
      colorAdjustments={colorAdjustments}
      resetColorAdjustments={resetColorAdjustments}
      setColorAdjustment={setColorAdjustment}
      formatSignedInt={formatSignedInt}
      Slider={Slider}
    />
  );
}

const panel = {
  id: "color",
  order: 30,
  title: "Color",
  groupId: "basic",
  Component: ColorPanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
