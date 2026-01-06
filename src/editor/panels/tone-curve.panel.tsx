import { ToneCurvePanel } from "@/editor/ToneCurvePanel";
import { useToneCurveStore } from "@/store/toneCurveStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function ToneCurvePanelFromContext({
  isImageLoaded,
  Slider,
  formatSignedInt,
}: PanelContext) {
  const toneCurve = useToneCurveStore((state) => state.toneCurve);
  const resetToneCurve = useToneCurveStore((state) => state.resetToneCurve);
  const setToneCurveMode = useToneCurveStore((state) => state.setToneCurveMode);
  const setToneCurveChannel = useToneCurveStore((state) => state.setToneCurveChannel);
  const setToneCurvePoints = useToneCurveStore((state) => state.setToneCurvePoints);
  const setToneCurveParametricRgb = useToneCurveStore((state) => state.setToneCurveParametricRgb);
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
