import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useDenoiseStore } from "./denoiseStore";
import { useLightStore } from "./lightStore";
import { useGeometryOpticsStore } from "./geometryOpticsStore";
import { getHealingEditsSnapshot, useHealingStore } from "./healingStore";
import { useSharpeningStore } from "./sharpeningStore";
import { usePresetStore } from "./presetStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

export function getImageEditorEdits(): ImageEditorEdits {
  const cropState = useCropStore.getState();
  const whiteBalanceState = useWhiteBalanceStore.getState();
  const lightState = useLightStore.getState();
  const colorState = useColorStore.getState();
  const geometryOpticsState = useGeometryOpticsStore.getState();
  const toneCurveState = useToneCurveStore.getState();
  const presetState = usePresetStore.getState();
  const sharpeningState = useSharpeningStore.getState();
  const denoiseState = useDenoiseStore.getState();
  const healingState = useHealingStore.getState();

  return {
    version: 1,
    crop: {
      rect: cropState.cropRect,
      settings: cropState.cropSettings,
      committed: cropState.cropCommitted,
      commit: cropState.cropCommit ?? undefined,
    },
    geometryOptics: geometryOpticsState.settings,
    whiteBalance: whiteBalanceState.whiteBalance,
    light: lightState.lightAdjustments,
    color: colorState.colorAdjustments,
    toneCurve: toneCurveState.toneCurve,
    preset: presetState.preset,
    sharpening: sharpeningState.sharpening,
    denoise: denoiseState.denoise,
    healing: getHealingEditsSnapshot({
      healingMode: healingState.healingMode,
      healingBrush: healingState.healingBrush,
      healingOps: healingState.healingOps,
      cloneSource: healingState.cloneSource,
    }),
  };
}
