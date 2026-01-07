import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useLightStore } from "./lightStore";
import { useDenoiseStore } from "./denoiseStore";
import { getImageEditorEdits } from "./selectEdits";
import { useSharpeningStore } from "./sharpeningStore";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

const HISTORY_COMMIT_DEBOUNCE_MS = 250;

type Unsubscribe = () => void;

export function subscribeToEdits(onChange: (edits: ImageEditorEdits) => void): Unsubscribe {
  let scheduled = false;

  const emit = () => {
    scheduled = false;
    onChange(getImageEditorEdits());
  };

  const scheduleEmit = () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    setTimeout(emit, HISTORY_COMMIT_DEBOUNCE_MS);
  };

  const unsubscribes: Unsubscribe[] = [
    useCropStore.subscribe(scheduleEmit),
    useWhiteBalanceStore.subscribe(scheduleEmit),
    useLightStore.subscribe(scheduleEmit),
    useColorStore.subscribe(scheduleEmit),
    useToneCurveStore.subscribe(scheduleEmit),
    useSharpeningStore.subscribe(scheduleEmit),
    useDenoiseStore.subscribe(scheduleEmit),
  ];

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}
