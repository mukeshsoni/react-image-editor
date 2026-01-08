import type { ImageEditorEdits } from "@/store";

import { useColorStore } from "@/store/colorStore";
import { useCropStore } from "@/store/cropStore";
import { useDenoiseStore } from "@/store/denoiseStore";
import { useLightStore } from "@/store/lightStore";
import { useSharpeningStore } from "@/store/sharpeningStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

export function applyEditsSnapshot(edits: ImageEditorEdits) {
  const crop = useCropStore.getState();

  // Apply crop settings without triggering aspect-ratio side effects.
  crop.handleCropSettingsChange(edits.crop.settings);
  crop.setCropRect(edits.crop.rect);

  if (edits.crop.committed) {
    if (edits.crop.commit) {
      crop.commitCrop(edits.crop.commit);
    }
  } else {
    crop.clearCommittedCrop();
  }

  useWhiteBalanceStore.getState().setWhiteBalance(edits.whiteBalance);

  const lightStore = useLightStore.getState();
  for (const [key, value] of Object.entries(edits.light)) {
    lightStore.setLightAdjustment(key as keyof typeof edits.light, value);
  }

  const colorStore = useColorStore.getState();
  for (const [key, value] of Object.entries(edits.color)) {
    colorStore.setColorAdjustment(key as keyof typeof edits.color, value);
  }

  useToneCurveStore.getState().setToneCurveMode(edits.toneCurve.mode);
  useToneCurveStore.getState().setToneCurveChannel(edits.toneCurve.activeChannel);
  for (const [channel, points] of Object.entries(edits.toneCurve.point)) {
    useToneCurveStore.getState().setToneCurvePoints(
      channel as keyof typeof edits.toneCurve.point,
      points,
    );
  }
  useToneCurveStore
    .getState()
    .setToneCurveParametricRgb(edits.toneCurve.parametric.rgb);

  if (edits.sharpening) {
    useSharpeningStore.getState().setSharpening(edits.sharpening);
  }

  if (edits.denoise) {
    useDenoiseStore.getState().setDenoise(edits.denoise);
  }
}
