import { ToneCurvePanel } from "@/editor/ToneCurvePanel";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function ToneCurvePanelFromContext({
  isImageLoaded,
  toneCurve,
  resetToneCurve,
  setToneCurveMode,
  setToneCurveChannel,
  setToneCurvePoints,
  setToneCurveParametricRgb,
  Slider,
  formatSignedInt,
}: PanelContext) {
  return (
    <ToneCurvePanel
      isImageLoaded={isImageLoaded}
      toneCurve={toneCurve}
      resetToneCurve={resetToneCurve}
      setToneCurveMode={setToneCurveMode}
      setToneCurveChannel={setToneCurveChannel}
      setToneCurvePoints={setToneCurvePoints}
      setToneCurveParametricRgb={setToneCurveParametricRgb}
      Slider={Slider}
      formatSignedInt={formatSignedInt}
    />
  );
}

const panel = {
  id: "tone-curve",
  order: 100,
  title: "Tone Curve",
  groupId: "advanced",
  Component: ToneCurvePanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
