/* eslint-disable react-refresh/only-export-components */
import { LightPanel } from "@/editor/LightPanel";
import { useLightStore } from "@/store/lightStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function LightPanelFromContext({
  isImageLoaded,
  formatSigned,
  formatSignedInt,
  Slider,
}: PanelContext) {
  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const resetLightAdjustments = useLightStore((state) => state.resetLightAdjustments);
  const setLightAdjustment = useLightStore((state) => state.setLightAdjustment);
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
