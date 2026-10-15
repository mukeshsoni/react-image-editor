import { afterEach, describe, expect, test, vi } from "vitest";

import { createSession } from "../model/session";

afterEach(() => vi.useRealTimers());

describe("editor sessions", () => {
  test("instances and delivered snapshots are independently owned", () => {
    vi.useFakeTimers();
    const first = createSession(), second = createSession();
    first.subscribe((edits) => { edits.light.exposure = -999; edits.healing.brush.size = 999; });
    first.load({ width: 320, height: 240 }); second.load({ width: 320, height: 240 });
    first.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 2 } }));
    vi.advanceTimersByTime(250);
    expect(first.store.getState().edits.light.exposure).toBe(2);
    expect(second.store.getState().edits.light.exposure).toBe(0);
    expect(first.store.getState().edits.healing.brush.size).toBe(30);
  });

  test("coalesces edits and cancels publication at a source boundary", () => {
    vi.useFakeTimers();
    const session = createSession(), listener = vi.fn();
    session.subscribe(listener); session.load({ width: 320, height: 240 });
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 1 } }));
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 2 } }));
    vi.advanceTimersByTime(249); expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].light.exposure).toBe(2);
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: -1 } }));
    session.beginLoad(); session.load({ width: 320, height: 240 });
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(session.store.getState().timeline.entries).toHaveLength(1);
    expect(session.store.getState().edits.light.exposure).toBe(0);
  });

  test("retains Original after the history limit and discards an abandoned future", () => {
    vi.useFakeTimers();
    const session = createSession(); session.load({ width: 320, height: 240 });
    for (let i = 0; i < 60; i++) {
      session.edit("Contrast", (e) => ({ ...e, light: { ...e.light, contrast: i % 2 ? -100 : 100 } }));
      vi.advanceTimersByTime(250);
    }
    const { timeline } = session.store.getState();
    expect(timeline.entries).toHaveLength(50);
    expect(timeline.entries[0].title).toBe("Original");
    expect(timeline.entries[0].edits.light.contrast).toBe(0);
    session.jump(0);
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 1 } }));
    vi.advanceTimersByTime(250); session.redo();
    expect(session.store.getState().timeline.entries).toHaveLength(2);
    expect(session.store.getState().edits.light.exposure).toBe(1);
  });

  test("restoring a desktop history entry keeps the camera visible on mobile", () => {
    const session = createSession();
    session.resize({ width: 1400, height: 900, coveredHeight: 0 });
    session.load({ width: 320, height: 240 });
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 1 } })); session.flush();
    session.resize({ width: 390, height: 600, coveredHeight: 60 }); session.jump(1);
    const { camera } = session.store.getState();
    expect(camera.origin.x).toBeLessThan(390);
    expect(camera.origin.x + camera.scale * 320).toBeGreaterThan(0);
  });

  test("cancels pending work on disposal and keeps repair active after picking", () => {
    vi.useFakeTimers();
    const session = createSession(), listener = vi.fn();
    session.subscribe(listener); session.load({ width: 100, height: 100 });
    session.chooseTool("repair"); session.sample("clone"); session.sample(null);
    expect(session.store.getState().tool).toBe("repair");
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 2 } }));
    session.cancel(); vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
