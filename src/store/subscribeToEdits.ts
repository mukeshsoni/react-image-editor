import type { ImageEditorEdits } from "./edits";

import { useColorStore } from "./colorStore";
import { useCropStore } from "./cropStore";
import { useLightStore } from "./lightStore";
import { getImageEditorEdits } from "./selectEdits";
import { useToneCurveStore } from "./toneCurveStore";
import { useWhiteBalanceStore } from "./whiteBalanceStore";

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
    queueMicrotask(emit);
  };

  const unsubscribes: Unsubscribe[] = [
    useCropStore.subscribe(scheduleEmit),
    useWhiteBalanceStore.subscribe(scheduleEmit),
    useLightStore.subscribe(scheduleEmit),
    useColorStore.subscribe(scheduleEmit),
    useToneCurveStore.subscribe(scheduleEmit),
  ];

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}
