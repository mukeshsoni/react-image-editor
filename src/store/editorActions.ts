import { useCallback } from "react";

import type { Bounds } from "./cropStore";
import { useCropStore } from "./cropStore";
import { useColorStore } from "./colorStore";
import { useLightStore } from "./lightStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

export function useResetAll(): (bounds: Bounds) => void {
  const resetCropSettings = useCropStore((state) => state.resetCropSettings);
  const resetCropRect = useCropStore((state) => state.resetCropRect);

  const resetWhiteBalance = useWhiteBalanceStore((state) => state.resetWhiteBalance);
  const resetLightAdjustments = useLightStore((state) => state.resetLightAdjustments);
  const resetColorAdjustments = useColorStore((state) => state.resetColorAdjustments);
  const resetToneCurve = useToneCurveStore((state) => state.resetToneCurve);

  return useCallback(
    (bounds) => {
      resetCropSettings();
      resetCropRect(bounds);
      resetWhiteBalance();
      resetLightAdjustments();
      resetColorAdjustments();
      resetToneCurve();
    },
    [
      resetColorAdjustments,
      resetCropRect,
      resetCropSettings,
      resetLightAdjustments,
      resetToneCurve,
      resetWhiteBalance,
    ],
  );
}
