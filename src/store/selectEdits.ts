import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useLightStore } from "./lightStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

export function getImageEditorEdits(): ImageEditorEdits {
  const cropState = useCropStore.getState();
  const whiteBalanceState = useWhiteBalanceStore.getState();
  const lightState = useLightStore.getState();
  const colorState = useColorStore.getState();
  const toneCurveState = useToneCurveStore.getState();

  return {
    version: 1,
    crop: {
      rect: cropState.cropRect,
      settings: cropState.cropSettings,
    },
    whiteBalance: whiteBalanceState.whiteBalance,
    light: lightState.lightAdjustments,
    color: colorState.colorAdjustments,
    toneCurve: toneCurveState.toneCurve,
  };
}
