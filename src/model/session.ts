import { createStore } from "zustand/vanilla";

import { constrainWarpedCrop } from "../engine/crop-constraints";
import { boundPresentedView, centeredCrop, containCrop, fitView, frameDimensions, limit, trayDisplacement, visibleView } from "../engine/geometry";
import { equal, recordHistory } from "./history";
import type { Timeline } from "./history";
import { initialEdits } from "./settings";
import type { Camera, CropSettings, Dimensions, EditorTool, ImageEditorEdits, Point, Rectangle, SampleTool, Viewport } from "./types";

export type SessionState = {
  edits: ImageEditorEdits;
  timeline: Timeline;
  camera: Camera;
  presentationOffset: number;
  viewport: Viewport;
  image: Dimensions;
  sourceId: number;
  status: "loading" | "ready" | "error";
  error: string | null;
  tool: EditorTool;
  sampler: SampleTool;
  selectedRepair: string | null;
  spaceHeld: boolean;
};

export function createSession() {
  const store = createStore<SessionState>(() => ({
    edits: initialEdits(), timeline: { entries: [], position: 0 },
    camera: { scale: 1, origin: { x: 0, y: 0 } }, presentationOffset: 0,
    viewport: { width: 1, height: 1, coveredHeight: 0 },
    image: { width: 0, height: 0 }, sourceId: 0, status: "loading", error: null,
    tool: "inspect", sampler: null, selectedRepair: null, spaceHeld: false,
  }));
  const observers = new Set<(edits: ImageEditorEdits) => void>();
  let published: ImageEditorEdits | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingTitle: string | null = null;
  let pendingHistory = false;
  let cropIntent: Rectangle | null = null;
  let draftIntent: Rectangle | null = null;
  const presentationOffsets = new Map<number, number>();
  let savedCrop: {
    crop: ImageEditorEdits["crop"]; camera: Camera; viewport: Viewport;
    presentationOffset: number; intent: Rectangle | null;
    presentationOffsets: Array<[number, number]>;
  } | null = null;

  function cancel() {
    clearTimeout(timer); timer = undefined; pendingTitle = null; pendingHistory = false;
  }
  function notify(force = false) {
    const { edits } = store.getState();
    if (!force && equal(edits, published)) return;
    published = structuredClone(edits);
    for (const observer of observers) observer(structuredClone(edits));
  }
  function cropWithRect(crop: ImageEditorEdits["crop"], rect: Rectangle): ImageEditorEdits["crop"] {
    if (!crop.committed) return { ...crop, rect };
    return { ...crop, rect, commit: {
      outputWidth: Math.max(1, Math.round(rect.width)), outputHeight: Math.max(1, Math.round(rect.height)),
      bakedOffset: { x: -rect.x, y: -rect.y }, rotationDegrees: crop.settings.rotation ?? 0,
    } };
  }
  function constrained(crop: ImageEditorEdits["crop"], intent: Rectangle, edits: ImageEditorEdits) {
    const image = store.getState().image;
    return cropWithRect(crop, constrainWarpedCrop(containCrop(intent, image, crop.settings), image, crop.settings, edits.geometryOptics));
  }
  function restoredCrop(edits: ImageEditorEdits) {
    if (!savedCrop) return edits.crop;
    return savedCrop.crop.committed
      ? constrained(savedCrop.crop, savedCrop.intent ?? savedCrop.crop.rect, edits) : savedCrop.crop;
  }
  function reframeCamera(camera: Camera, before: ImageEditorEdits["crop"], after: ImageEditorEdits["crop"]): Camera {
    return { scale: camera.scale, origin: {
      x: camera.origin.x + ((before.commit?.bakedOffset.x ?? 0) - (after.commit?.bakedOffset.x ?? 0)) * camera.scale,
      y: camera.origin.y + ((before.commit?.bakedOffset.y ?? 0) - (after.commit?.bakedOffset.y ?? 0)) * camera.scale,
    } };
  }
  function resetPresentation(viewport: Viewport, offset: number) {
    presentationOffsets.clear(); presentationOffsets.set(viewport.coveredHeight, offset);
  }
  function presentationFor(camera: Camera, image: Dimensions, viewport: Viewport): number {
    const previous = presentationOffsets.get(viewport.coveredHeight);
    if (previous !== undefined) return previous;
    const offset = trayDisplacement(camera, image, viewport);
    presentationOffsets.set(viewport.coveredHeight, offset);
    return offset;
  }
  function flush(publish = true) {
    const title = pendingTitle, record = pendingHistory;
    cancel();
    const state = store.getState();
    if (!title || state.status !== "ready") return;
    if (record) {
      // Draft framing is public while editing, but never becomes an undo target.
      const crop = restoredCrop(state.edits);
      const edits = savedCrop ? { ...state.edits, crop } : state.edits;
      const camera = savedCrop ? reframeCamera(savedCrop.camera, savedCrop.crop, crop) : state.camera;
      const viewport = savedCrop?.viewport ?? state.viewport;
      const sameFraming = savedCrop && equal(savedCrop.crop, crop);
      const offset = savedCrop ? sameFraming ? savedCrop.presentationOffset
        : trayDisplacement(camera, frameDimensions(edits, state.image), viewport) : state.presentationOffset;
      store.setState({ timeline: recordHistory(state.timeline, {
        title, edits, camera, viewport,
        presentationOffset: offset,
        presentationOffsets: savedCrop ? sameFraming ? savedCrop.presentationOffsets : [[viewport.coveredHeight, offset]] : [...presentationOffsets],
        cropIntent: savedCrop ? savedCrop.intent : cropIntent,
      }) });
    }
    if (publish) notify();
  }
  function schedule(title: string, record = true) {
    clearTimeout(timer);
    if (record || !pendingHistory) pendingTitle = title;
    pendingHistory ||= record;
    timer = setTimeout(flush, 250);
  }
  function edit(title: string, update: (edits: ImageEditorEdits) => ImageEditorEdits, record = true) {
    const state = store.getState();
    if (state.status !== "ready") return;
    let next = update(state.edits);
    const changedGeometry = !equal(
      [state.edits.geometryOptics.perspective, state.edits.geometryOptics.lensCorrections.distortion],
      [next.geometryOptics.perspective, next.geometryOptics.lensCorrections.distortion],
    );
    if (changedGeometry && (state.tool === "crop" || next.crop.committed)) {
      const intent = state.tool === "crop" ? draftIntent ?? next.crop.rect : cropIntent ?? next.crop.rect;
      next = { ...next, crop: constrained(next.crop, intent, next) };
    }
    if (equal(next, state.edits)) return;
    store.setState({ edits: next });
    if (changedGeometry && state.tool !== "crop" && next.crop.commit && state.edits.crop.commit) {
      const camera = reframeCamera(state.camera, state.edits.crop, next.crop);
      const presentationOffset = trayDisplacement(camera, frameDimensions(next, state.image), state.viewport);
      resetPresentation(state.viewport, presentationOffset);
      store.setState({ camera, presentationOffset });
    }
    schedule(title, record);
  }
  function dimensions(state = store.getState()) {
    return frameDimensions(state.edits, state.image, state.tool === "crop");
  }
  function fit(record = true) {
    const state = store.getState();
    const camera = fitView(dimensions(state), state.viewport);
    const presentationOffset = trayDisplacement(camera, dimensions(state), state.viewport);
    resetPresentation(state.viewport, presentationOffset);
    if (equal(camera, state.camera) && presentationOffset === state.presentationOffset) return;
    store.setState({ camera, presentationOffset });
    if (record) schedule("Fit image", state.tool !== "crop");
  }
  function moveCamera(camera: Camera) {
    const state = store.getState();
    if (state.status !== "ready") return;
    const bounded = boundPresentedView(camera, state.presentationOffset, dimensions(state), state.viewport);
    if (equal(bounded, state.camera)) return;
    store.setState({ camera: bounded }); schedule("View", state.tool !== "crop");
  }
  function zoom(factor: number, anchor?: Point) {
    const state = store.getState();
    if (state.status !== "ready") return;
    const min = Math.max(0.001, fitView(dimensions(state), state.viewport).scale / 10);
    const scale = limit(state.camera.scale * factor, min, 32);
    const point = anchor ?? { x: state.viewport.width / 2, y: (state.viewport.height - state.viewport.coveredHeight) / 2 };
    const displayed = visibleView(state.camera, state.presentationOffset);
    const ratio = scale / state.camera.scale;
    moveCamera({ scale, origin: {
      x: point.x - (point.x - displayed.origin.x) * ratio,
      y: point.y - (point.y - displayed.origin.y) * ratio - (displayed.origin.y - state.camera.origin.y),
    } });
  }
  function toggleZoom(point: Point) {
    const state = store.getState();
    if (Math.abs(state.camera.scale - fitView(dimensions(state), state.viewport).scale) < 0.00001) zoom(2, point);
    else fit();
  }
  function load(image: Dimensions) {
    cancel(); savedCrop = null; cropIntent = null; draftIntent = null;
    const edits = initialEdits(image);
    const viewport = store.getState().viewport;
    const camera = fitView(image, viewport);
    const presentationOffset = trayDisplacement(camera, image, viewport);
    resetPresentation(viewport, presentationOffset);
    store.setState({ image, edits, camera, presentationOffset, sourceId: store.getState().sourceId + 1,
      status: "ready", error: null, tool: "inspect", sampler: null, selectedRepair: null, spaceHeld: false,
      timeline: { entries: [{ title: "Original", edits: structuredClone(edits), camera: structuredClone(camera),
        viewport: { ...viewport }, presentationOffset, presentationOffsets: [...presentationOffsets], cropIntent: null }], position: 0 },
    });
    notify(true);
  }
  function resize(viewport: Viewport) {
    const state = store.getState();
    if (equal(viewport, state.viewport)) return;
    const changed = viewport.width !== state.viewport.width || viewport.height !== state.viewport.height || state.tool === "crop";
    const camera = changed ? fitView(dimensions(state), viewport) : state.camera;
    if (changed) resetPresentation(viewport, trayDisplacement(camera, dimensions(state), viewport));
    else presentationOffsets.set(state.viewport.coveredHeight, state.presentationOffset);
    const presentationOffset = presentationFor(camera, dimensions(state), viewport);
    store.setState({ viewport, presentationOffset,
      camera: changed ? camera : boundPresentedView(camera, presentationOffset, dimensions(state), viewport) });
  }
  function discardCrop() {
    if (!savedCrop) return;
    const state = store.getState(), before = savedCrop;
    const crop = restoredCrop(state.edits);
    const size = frameDimensions({ ...state.edits, crop }, state.image);
    const sameSize = before.viewport.width === state.viewport.width && before.viewport.height === state.viewport.height;
    const camera = sameSize ? reframeCamera(before.camera, before.crop, crop) : fitView(size, state.viewport);
    presentationOffsets.clear();
    if (sameSize && equal(before.crop, crop)) {
      for (const [height, offset] of before.presentationOffsets) presentationOffsets.set(height, offset);
    }
    const presentationOffset = presentationFor(camera, size, state.viewport);
    cropIntent = before.intent; draftIntent = null; savedCrop = null;
    store.setState({ edits: { ...state.edits, crop }, tool: "inspect", presentationOffset, camera });
  }
  function chooseTool(tool: EditorTool) {
    const state = store.getState();
    if (state.status !== "ready" || state.tool === tool) return;
    if (state.tool === "crop") {
      discardCrop();
      // Restore before flushing, so Cancel cannot publish a discarded draft.
      flush(false); notify();
    } else flush();
    if (tool === "crop") {
      const current = store.getState();
      savedCrop = { crop: structuredClone(current.edits.crop), camera: structuredClone(current.camera),
        viewport: { ...current.viewport }, presentationOffset: current.presentationOffset,
        presentationOffsets: [...presentationOffsets],
        intent: cropIntent ? { ...cropIntent } : null };
      draftIntent = { ...(cropIntent ?? current.edits.crop.rect) };
      const crop = constrained(current.edits.crop, draftIntent, current.edits);
      store.setState({ edits: { ...current.edits, crop } });
      if (!equal(crop, current.edits.crop)) schedule("Crop settings", false);
    }
    store.setState({ tool, sampler: null, selectedRepair: null });
    if (tool === "crop") fit(false);
  }
  function configureCrop(changes: Partial<CropSettings>) {
    if (store.getState().tool !== "crop") chooseTool("crop");
    edit(changes.rotation === undefined ? "Crop settings" : "Straighten", (edits) => {
      const settings = { ...edits.crop.settings, ...changes };
      settings.rotation = limit(settings.rotation ?? 0, -45, 45);
      const needsFit = Object.keys(changes).some((key) => key !== "aspectRatioLocked");
      if (needsFit) draftIntent = centeredCrop(store.getState().image, settings);
      const rect = constrainWarpedCrop(draftIntent ?? edits.crop.rect, store.getState().image, settings, edits.geometryOptics);
      return { ...edits, crop: { ...edits.crop, settings, rect } };
    }, false);
  }
  function selectCrop(rect: Rectangle) {
    const state = store.getState();
    if (state.tool !== "crop" || equal(rect, state.edits.crop.rect)) return;
    draftIntent = containCrop(rect, state.image, state.edits.crop.settings);
    const next = constrainWarpedCrop(draftIntent, state.image, state.edits.crop.settings, state.edits.geometryOptics);
    edit("Crop selection", (edits) => ({ ...edits, crop: { ...edits.crop, rect: next } }), false);
  }
  function applyCrop() {
    const state = store.getState();
    if (state.tool !== "crop") return;
    flush(false);
    const crop = constrained({ ...state.edits.crop, committed: true }, draftIntent ?? state.edits.crop.rect, state.edits);
    cropIntent = { ...(draftIntent ?? state.edits.crop.rect) };
    savedCrop = null; draftIntent = null;
    store.setState({ edits: { ...state.edits, crop }, tool: "inspect" });
    fit(false); schedule("Crop");
  }
  function resetCrop() {
    const wasEditing = store.getState().tool === "crop";
    if (store.getState().status !== "ready") return;
    discardCrop(); flush(false);
    const current = store.getState(), crop = initialEdits(current.image).crop;
    cropIntent = null; draftIntent = null; savedCrop = null;
    store.setState({ edits: { ...current.edits, crop }, tool: "inspect" });
    fit(false);
    if (wasEditing) {
      const reset = store.getState();
      savedCrop = { crop: structuredClone(crop), camera: structuredClone(reset.camera), viewport: { ...reset.viewport },
        presentationOffset: reset.presentationOffset, presentationOffsets: [...presentationOffsets], intent: null };
      draftIntent = { ...crop.rect };
      store.setState({ tool: "crop", edits: { ...reset.edits, crop: constrained(crop, draftIntent, reset.edits) } });
    }
    schedule("Reset crop");
  }
  function prepareHistoryMove() { discardCrop(); flush(false); }
  function jump(position: number) {
    if (store.getState().status !== "ready") return;
    prepareHistoryMove();
    const state = store.getState(), entry = state.timeline.entries[position];
    if (!entry) { notify(); return; }
    savedCrop = null; draftIntent = null; cropIntent = entry.cropIntent ? { ...entry.cropIntent } : null;
    const size = frameDimensions(entry.edits, state.image);
    const sameSize = entry.viewport?.width === state.viewport.width && entry.viewport?.height === state.viewport.height;
    const camera = sameSize ? entry.camera : fitView(size, state.viewport);
    presentationOffsets.clear();
    if (sameSize) {
      for (const [height, offset] of entry.presentationOffsets ?? []) presentationOffsets.set(height, offset);
      if (entry.viewport) presentationOffsets.set(entry.viewport.coveredHeight, entry.presentationOffset ?? 0);
    }
    const presentationOffset = presentationFor(camera, size, state.viewport);
    store.setState({ edits: structuredClone(entry.edits), tool: "inspect", sampler: null, selectedRepair: null,
      timeline: { ...state.timeline, position }, presentationOffset,
      camera: boundPresentedView(camera, presentationOffset, size, state.viewport),
    });
    notify();
  }
  function sample(sampler: SampleTool) {
    if (store.getState().status !== "ready") return;
    if (!sampler || store.getState().sampler === sampler) { store.setState({ sampler: null }); return; }
    if (store.getState().tool === "crop") chooseTool("inspect");
    store.setState({ sampler, tool: sampler === "clone" ? "repair" : "inspect" });
  }
  function deleteRepair() {
    const id = store.getState().selectedRepair;
    if (!id) return;
    edit("Delete spot", (edits) => ({ ...edits, healing: { ...edits.healing, ops: edits.healing.ops.filter((op) => op.id !== id) } }));
    store.setState({ selectedRepair: null });
  }
  function beginLoad() {
    cancel(); savedCrop = null; cropIntent = null; draftIntent = null; published = undefined;
    presentationOffsets.clear();
    store.setState({ status: "loading", error: null, tool: "inspect", sampler: null, selectedRepair: null, spaceHeld: false,
      sourceId: store.getState().sourceId + 1, image: { width: 0, height: 0 }, edits: initialEdits(),
      timeline: { entries: [], position: 0 }, camera: { scale: 1, origin: { x: 0, y: 0 } }, presentationOffset: 0 });
  }
  return {
    store, edit, flush, cancel, load, resize, fit, zoom, toggleZoom, moveCamera,
    chooseTool, configureCrop, selectCrop, applyCrop, resetCrop, jump, sample, deleteRepair,
    undo() { prepareHistoryMove(); jump(store.getState().timeline.position - 1); },
    redo() { prepareHistoryMove(); jump(store.getState().timeline.position + 1); },
    reset() { jump(0); },
    beginLoad,
    fail(message: string) { cancel(); store.setState({ status: "error", error: message }); },
    holdSpace(spaceHeld: boolean) { if (store.getState().spaceHeld !== spaceHeld) store.setState({ spaceHeld }); },
    selectRepair(selectedRepair: string | null) { store.setState({ selectedRepair }); },
    subscribe(callback: (edits: ImageEditorEdits) => void) {
      observers.add(callback);
      return () => { observers.delete(callback); };
    },
  };
}

export type EditorSession = ReturnType<typeof createSession>;
