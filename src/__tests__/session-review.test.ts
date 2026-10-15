import { afterEach, describe, expect, test, vi } from "vitest";

import { visibleView } from "../engine/geometry";
import { createSession } from "../model/session";

afterEach(() => vi.useRealTimers());

function ready() {
  const session = createSession();
  session.resize({ width: 390, height: 600, coveredHeight: 64 });
  session.load({ width: 320, height: 700 });
  return session;
}

describe("review: camera and session boundaries", () => {
  test("an open tray does not cancel vertical pan deltas", () => {
    const session = ready();
    session.zoom(3); session.flush();
    session.resize({ width: 390, height: 600, coveredHeight: 200 });
    const before = session.store.getState();
    const displayed = visibleView(before.camera, before.presentationOffset);
    session.moveCamera({ ...before.camera, origin: { ...before.camera.origin, y: before.camera.origin.y + 40 } });
    const after = session.store.getState();
    expect(visibleView(after.camera, after.presentationOffset).origin.y - displayed.origin.y).toBeCloseTo(40, 6);
    session.moveCamera({ ...after.camera, origin: { ...after.camera.origin, y: after.camera.origin.y - 30 } });
    const moved = session.store.getState();
    expect(visibleView(moved.camera, moved.presentationOffset).origin.y - displayed.origin.y).toBeCloseTo(10, 6);
    session.cancel();
  });

  test("tray opening and closing never accumulates a camera displacement", () => {
    const session = ready();
    const camera = structuredClone(session.store.getState().camera);
    for (let i = 0; i < 5; i++) {
      session.resize({ width: 390, height: 600, coveredHeight: 276 });
      session.resize({ width: 390, height: 600, coveredHeight: 64 });
    }
    expect(session.store.getState().camera).toEqual(camera);
    expect(session.store.getState().timeline.entries).toHaveLength(1);
  });

  test("tray cycles restore the visible zoomed and panned view, including after replay", () => {
    const session = ready(); session.zoom(2); session.flush();
    const initial = session.store.getState();
    session.moveCamera({ ...initial.camera, origin: { ...initial.camera.origin, y: initial.camera.origin.y + 20 } }); session.flush();
    const before = session.store.getState();
    const expected = visibleView(before.camera, before.presentationOffset);
    for (let i = 0; i < 4; i++) {
      session.resize({ width: 390, height: 600, coveredHeight: 200 });
      session.resize({ width: 390, height: 600, coveredHeight: 64 });
      const after = session.store.getState();
      expect(visibleView(after.camera, after.presentationOffset)).toEqual(expected);
    }
    session.resize({ width: 390, height: 600, coveredHeight: 200 });
    const open = session.store.getState();
    session.moveCamera({ ...open.camera, origin: { ...open.camera.origin, y: open.camera.origin.y + 15 } }); session.flush();
    session.undo(); session.redo();
    session.resize({ width: 390, height: 600, coveredHeight: 64 });
    const replayed = session.store.getState();
    expect(visibleView(replayed.camera, replayed.presentationOffset).origin.y).toBeCloseTo(expected.origin.y + 15, 6);
  });

  test("undo and redo restore a panned view with an open tray", () => {
    const session = ready(); session.zoom(3); session.flush();
    session.resize({ width: 390, height: 600, coveredHeight: 200 });
    const start = session.store.getState();
    session.moveCamera({ ...start.camera, origin: { ...start.camera.origin, y: start.camera.origin.y + 45 } }); session.flush();
    const before = session.store.getState();
    const expected = visibleView(before.camera, before.presentationOffset);
    session.undo(); session.redo();
    const after = session.store.getState();
    expect(visibleView(after.camera, after.presentationOffset)).toEqual(expected);
  });

  test("failed replacements clear old edits, dimensions, and history", () => {
    const session = ready(), observer = vi.fn(); session.subscribe(observer);
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 2 } })); session.flush();
    const count = observer.mock.calls.length;
    session.beginLoad(); session.fail("Missing image");
    const state = session.store.getState();
    expect(state.edits.light.exposure).toBe(0);
    expect(state.image).toEqual({ width: 0, height: 0 });
    expect(state.timeline.entries).toHaveLength(0);
    session.jump(0); session.undo(); session.redo();
    expect(observer).toHaveBeenCalledTimes(count);
  });
});

describe("review: draft crop transactions", () => {
  test("cancelling before the debounce does not publish or record the draft", () => {
    vi.useFakeTimers();
    const session = ready(), observer = vi.fn(); session.subscribe(observer);
    const crop = structuredClone(session.store.getState().edits.crop);
    session.chooseTool("crop"); session.configureCrop({ aspectRatio: "1x1", rotation: 30 });
    session.chooseTool("inspect"); vi.advanceTimersByTime(1000);
    expect(observer).not.toHaveBeenCalled();
    expect(session.store.getState().edits.crop).toEqual(crop);
    expect(session.store.getState().timeline.entries.map((entry) => entry.title)).toEqual(["Original"]);
  });

  test("already-published crop previews are discarded without ghost undo entries", () => {
    vi.useFakeTimers();
    const session = ready();
    session.chooseTool("crop"); session.configureCrop({ aspectRatio: "1x1", rotation: 30 });
    vi.advanceTimersByTime(250);
    session.chooseTool("inspect"); vi.advanceTimersByTime(250);
    session.undo();
    expect(session.store.getState().edits.crop.settings.rotation).toBe(0);
    expect(session.store.getState().edits.crop.settings.aspectRatio).toBe("original");
    expect(session.store.getState().timeline.entries).toHaveLength(1);
  });

  test("one undo of Apply restores the pre-crop descriptor and rotation", () => {
    const session = ready();
    const before = structuredClone(session.store.getState().edits.crop);
    session.chooseTool("crop"); session.configureCrop({ rotation: 30 }); session.flush();
    session.applyCrop(); session.flush();
    expect(session.store.getState().timeline.entries.map((entry) => entry.title)).toEqual(["Original", "Crop"]);
    session.undo();
    expect(session.store.getState().edits.crop).toEqual(before);
    expect(session.store.getState().tool).toBe("inspect");
  });

  test("other adjustments survive crop cancellation and remain undoable", () => {
    const session = ready(); session.chooseTool("crop"); session.configureCrop({ rotation: 30 });
    session.edit("Exposure", (e) => ({ ...e, light: { ...e.light, exposure: 1 } }));
    session.chooseTool("inspect");
    expect(session.store.getState().edits.light.exposure).toBe(1);
    expect(session.store.getState().edits.crop.settings.rotation).toBe(0);
    expect(session.store.getState().timeline.entries.map((entry) => entry.title)).toEqual(["Original", "Exposure"]);
    session.undo(); expect(session.store.getState().edits.light.exposure).toBe(0);
  });

  test("Reset crop persists when leaving the tool and can be undone", () => {
    const session = ready(); session.chooseTool("crop"); session.configureCrop({ aspectRatio: "1x1" });
    session.applyCrop(); session.flush();
    const square = structuredClone(session.store.getState().edits.crop);
    session.chooseTool("crop"); session.configureCrop({ rotation: 30 }); session.resetCrop();
    session.chooseTool("inspect");
    expect(session.store.getState().edits.crop.committed).toBe(false);
    expect(session.store.getState().edits.crop.settings.rotation).toBe(0);
    expect(session.store.getState().edits.crop.rect).toEqual({ x: 0, y: 0, width: 320, height: 700 });
    expect(session.store.getState().timeline.entries.map((entry) => entry.title)).toEqual(["Original", "Crop", "Reset crop"]);
    session.undo(); expect(session.store.getState().edits.crop).toEqual(square);
  });

  test("auto-style rotation after an existing crop explicitly opens an editable draft", () => {
    const session = ready(); session.chooseTool("crop"); session.applyCrop(); session.flush();
    const commit = structuredClone(session.store.getState().edits.crop.commit);
    session.configureCrop({ rotation: 30 });
    expect(session.store.getState().tool).toBe("crop");
    expect(session.store.getState().edits.crop.settings.rotation).toBe(30);
    session.chooseTool("inspect");
    expect(session.store.getState().edits.crop.commit).toEqual(commit);
  });

  test("locked aspect ratios survive resizing beyond image bounds", () => {
    const session = ready(); session.chooseTool("crop");
    session.configureCrop({ aspectRatio: "1x1", aspectRatioLocked: true });
    session.selectCrop({ x: 0, y: 0, width: 900, height: 900 });
    const rect = session.store.getState().edits.crop.rect;
    expect(rect.width / rect.height).toBeCloseTo(1, 8);
    expect(rect.width).toBeLessThanOrEqual(320);
  });

  test("constraints respond to geometry and restore the intended framing on reset", () => {
    const session = ready(); session.chooseTool("crop"); session.applyCrop(); session.flush();
    const before = structuredClone(session.store.getState().edits.crop);
    session.edit("Perspective", (e) => ({ ...e, geometryOptics: { ...e.geometryOptics, perspective: { ...e.geometryOptics.perspective, horizontal: 100 } } }));
    expect(session.store.getState().edits.crop.commit!.outputWidth).toBeLessThan(before.commit!.outputWidth);
    session.edit("Perspective", (e) => ({ ...e, geometryOptics: { ...e.geometryOptics, perspective: { ...e.geometryOptics.perspective, horizontal: 0 } } }));
    expect(session.store.getState().edits.crop).toEqual(before);
    session.cancel();
  });
});
