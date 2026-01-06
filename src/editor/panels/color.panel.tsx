import { ColorPanel } from "@/editor/ColorPanel";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function ColorPanelFromContext({
  isImageLoaded,
  colorAdjustments,
  resetColorAdjustments,
  setColorAdjustment,
  formatSignedInt,
  Slider,
}: PanelContext) {
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
