import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useLightStore } from "./lightStore";
import { useDenoiseStore } from "./denoiseStore";
import { getImageEditorEdits } from "./selectEdits";
import { useSharpeningStore } from "./sharpeningStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";
import { useGeometryOpticsStore } from "./geometryOpticsStore";
import { useHealingStore } from "./healingStore";
import { usePresetStore } from "./presetStore";

const HISTORY_COMMIT_DEBOUNCE_MS = 250;

type Unsubscribe = () => void;

export function subscribeToEdits(onChange: (edits: ImageEditorEdits) => void): Unsubscribe {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    timeout = null;
    onChange(getImageEditorEdits());
  };

  const scheduleEmit = () => {
    if (timeout !== null) {
      return;
    }

    timeout = setTimeout(emit, HISTORY_COMMIT_DEBOUNCE_MS);
  };

  const unsubscribes: Unsubscribe[] = [
    useCropStore.subscribe(scheduleEmit),
    useWhiteBalanceStore.subscribe(scheduleEmit),
    useLightStore.subscribe(scheduleEmit),
    useColorStore.subscribe(scheduleEmit),
    useToneCurveStore.subscribe(scheduleEmit),
    usePresetStore.subscribe(scheduleEmit),
    useSharpeningStore.subscribe(scheduleEmit),
    useDenoiseStore.subscribe(scheduleEmit),
    useGeometryOpticsStore.subscribe(scheduleEmit),
    useHealingStore.subscribe(scheduleEmit),
  ];

  return () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}
