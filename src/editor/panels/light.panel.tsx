import { LightPanel } from "@/editor/LightPanel";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function LightPanelFromContext({
  isImageLoaded,
  lightAdjustments,
  resetLightAdjustments,
  setLightAdjustment,
  formatSigned,
  formatSignedInt,
  Slider,
}: PanelContext) {
  return (
    <LightPanel
      isImageLoaded={isImageLoaded}
      lightAdjustments={lightAdjustments}
      resetLightAdjustments={resetLightAdjustments}
      setLightAdjustment={setLightAdjustment}
      formatSigned={formatSigned}
      formatSignedInt={formatSignedInt}
      Slider={Slider}
    />
  );
}

const panel = {
  id: "light",
  order: 20,
  title: "Tone",
  groupId: "basic",
  Component: LightPanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
