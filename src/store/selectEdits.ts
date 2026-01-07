import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useDenoiseStore } from "./denoiseStore";
import { useLightStore } from "./lightStore";
import { useSharpeningStore } from "./sharpeningStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

export function getImageEditorEdits(): ImageEditorEdits {
  const cropState = useCropStore.getState();
  const whiteBalanceState = useWhiteBalanceStore.getState();
  const lightState = useLightStore.getState();
  const colorState = useColorStore.getState();
  const toneCurveState = useToneCurveStore.getState();
  const sharpeningState = useSharpeningStore.getState();
  const denoiseState = useDenoiseStore.getState();

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
    sharpening: sharpeningState.sharpening,
    denoise: denoiseState.denoise,
  };
}
