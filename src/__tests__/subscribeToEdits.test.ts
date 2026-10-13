import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useLightStore } from "@/store/lightStore";
import { subscribeToEdits } from "@/store/subscribeToEdits";

describe("edit subscription lifecycle", () => {
  let unsubscribe: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    useLightStore.getState().resetLightAdjustments();
  });
  afterEach(() => { unsubscribe?.(); vi.useRealTimers(); });

  test("coalesces notifications with the latest committed values", () => {
    const listener = vi.fn();
    unsubscribe = subscribeToEdits(listener);
    useLightStore.getState().setLightAdjustment("exposure", 1);
    useLightStore.getState().setLightAdjustment("exposure", 2);
    vi.advanceTimersByTime(249);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].light.exposure).toBe(2);
  });

  test("cancels pending notifications when unsubscribed", () => {
    const listener = vi.fn();
    unsubscribe = subscribeToEdits(listener);
    useLightStore.getState().setLightAdjustment("exposure", 1);
    unsubscribe();
    vi.advanceTimersByTime(1000);
    useLightStore.getState().setLightAdjustment("exposure", 2);
    vi.advanceTimersByTime(1000);
    expect(listener).not.toHaveBeenCalled();
  });
});
