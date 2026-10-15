import { useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { rgbToHsl } from "../engine/color";
import { canvasToFrame, frameToCanvas, limit, visibleView } from "../engine/geometry";
import { sampleNeighborhood } from "../engine/pixels";
import { chooseRepairSource } from "../engine/repair";
import type { PhotoRenderer } from "../engine/renderer";
import { useSession } from "../model/context";
import type { Camera, Point, RepairMode } from "../model/types";

type Contact = { start: Point; position: Point; began: number };
type Gesture =
  | { kind: "pan"; previous: Point; time: number; travelled: number; velocity: Point }
  | { kind: "stroke"; points: Point[]; mode: RepairMode }
  | { kind: "source"; id: string }
  | { kind: "selection" };

export function useCanvasInput(photo: PhotoRenderer | null, canvas: RefObject<HTMLCanvasElement | null>) {
  const session = useSession();
  const contacts = useRef(new Map<number, Contact>());
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<{ distance: number; center: Point; camera: Camera; displacement: number } | null>(null);
  const usedMultipleFingers = useRef(false);
  const previousTap = useRef<{ time: number; position: Point } | null>(null);
  const touchTime = useRef<number | null>(null);
  const animation = useRef(0);
  const [cursor, setCursor] = useState<Point | null>(null);

  useEffect(() => {
    const pointers = contacts.current;
    return () => { cancelAnimationFrame(animation.current); pointers.clear(); gesture.current = null; pinch.current = null; };
  }, [photo]);

  useEffect(() => session.store.subscribe((next, previous) => {
    if (next.tool !== previous.tool || next.sampler !== previous.sampler || next.sourceId !== previous.sourceId) {
      cancelAnimationFrame(animation.current);
    }
  }), [session]);

  useEffect(() => {
    const element = canvas.current;
    const container = element?.parentElement;
    if (!element || !container) return;
    function wheel(event: WheelEvent) {
      event.preventDefault(); cancelAnimationFrame(animation.current);
      const box = element!.getBoundingClientRect();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      session.zoom(Math.exp(limit(-event.deltaY * units / 500, -4, 4)), { x: event.clientX - box.x, y: event.clientY - box.y });
    }
    container.addEventListener("wheel", wheel, { passive: false });
    return () => container.removeEventListener("wheel", wheel);
  }, [canvas, session]);

  function display() {
    const state = session.store.getState();
    const view = visibleView(state.camera, state.presentationOffset);
    return { state, view };
  }
  function sourcePoint(point: Point): Point | null {
    const { state, view } = display();
    return photo?.sourcePoint(canvasToFrame(point, view), state.edits, state.tool === "crop") ?? null;
  }
  function position(event: PointerEvent<HTMLCanvasElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.x, y: event.clientY - box.y };
  }
  function pick(point: Point): boolean {
    const { state, view } = display();
    if (!state.sampler || !photo) return false;
    const source = sourcePoint(point);
    if (!source) return true;
    if (state.sampler === "clone") {
      session.edit("Clone source", (e) => ({ ...e, healing: { ...e.healing, cloneSource: source } }));
    } else {
      const rgb = state.sampler === "color"
        ? photo.samplePointColor(canvasToFrame(point, view), state.edits, state.tool === "crop")
        : sampleNeighborhood(photo.original, source);
      if (!rgb) return true;
      if (state.sampler === "color") {
        session.edit("Pick point color", (e) => ({ ...e, color: { ...e.color, pointColor: { ...e.color.pointColor, hue: rgbToHsl(rgb)[0] } } }));
      } else {
        const temperatureKelvin = Math.round(limit(6500 + Math.log((rgb[2] + 1) / (rgb[0] + 1)) * 2400, 2000, 10000) / 50) * 50;
        const tint = Math.round(limit(Math.log((rgb[1] + 1) / ((rgb[0] + rgb[2]) / 2 + 1)) * 80, -100, 100));
        session.edit("Pick white balance", (e) => ({ ...e, whiteBalance: { temperatureKelvin, tint, preset: "custom" } }));
      }
    }
    session.sample(null); return true;
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const state = session.store.getState();
    if (event.button !== 0 || state.status !== "ready") return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    cancelAnimationFrame(animation.current);
    const point = position(event), now = performance.now();
    if (event.pointerType === "touch") touchTime.current = now;
    contacts.current.set(event.pointerId, { start: point, position: point, began: now });
    if (contacts.current.size > 1) {
      const [a, b] = [...contacts.current.values()].map((contact) => contact.position);
      usedMultipleFingers.current = true; previousTap.current = null; gesture.current = null;
      pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        camera: visibleView(state.camera, state.presentationOffset), displacement: state.presentationOffset };
      return;
    }
    if (pick(point)) { gesture.current = { kind: "selection" }; return; }
    if (state.tool !== "repair" || state.spaceHeld) {
      gesture.current = { kind: "pan", previous: point, time: now, travelled: 0, velocity: { x: 0, y: 0 } };
      return;
    }
    const source = sourcePoint(point);
    if (!source || !photo) return;
    if (state.edits.healing.mode === "clone" && event.altKey) {
      session.edit("Clone source", (e) => ({ ...e, healing: { ...e.healing, cloneSource: source } }));
      gesture.current = { kind: "selection" }; return;
    }
    if (state.edits.healing.mode === "spot") {
      const { view } = display();
      for (const op of [...state.edits.healing.ops].reverse()) {
        if (op.type !== "spot") continue;
        const pin = op.source ? frameToCanvas(photo.framePoint(op.source, state.edits, false), view) : null;
        if (pin && Math.hypot(pin.x - point.x, pin.y - point.y) < 12) {
          session.selectRepair(op.id); gesture.current = { kind: "source", id: op.id }; return;
        }
        if (Math.hypot(op.center.x - source.x, op.center.y - source.y) < op.radius) {
          session.selectRepair(op.id); gesture.current = { kind: "selection" }; return;
        }
      }
    }
    if (state.edits.healing.mode === "clone" && !state.edits.healing.cloneSource) return;
    session.flush(); session.selectRepair(null);
    gesture.current = { kind: "stroke", mode: state.edits.healing.mode, points: [source] };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = position(event), contact = contacts.current.get(event.pointerId);
    setCursor(point);
    if (!contact) return;
    contact.position = point;
    if (pinch.current && contacts.current.size > 1) {
      const [a, b] = [...contacts.current.values()].map((value) => value.position);
      const start = pinch.current;
      const scale = limit(start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance, 0.001, 32);
      const ratio = scale / start.camera.scale;
      session.moveCamera({ scale, origin: {
        x: (a.x + b.x) / 2 - (start.center.x - start.camera.origin.x) * ratio,
        y: (a.y + b.y) / 2 - (start.center.y - start.camera.origin.y) * ratio - start.displacement,
      } });
      return;
    }
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "pan") {
      const dx = point.x - active.previous.x, dy = point.y - active.previous.y;
      const now = performance.now(), elapsed = Math.max(8, now - active.time);
      active.travelled += Math.hypot(dx, dy); active.previous = point; active.time = now;
      active.velocity = { x: dx / elapsed, y: dy / elapsed };
      const current = session.store.getState().camera;
      session.moveCamera({ scale: current.scale, origin: { x: current.origin.x + dx, y: current.origin.y + dy } });
    } else if (active.kind === "source") {
      const source = sourcePoint(point);
      if (source) session.edit("Healing sample", (e) => ({ ...e, healing: { ...e.healing, ops: e.healing.ops.map((op) => op.id === active.id ? { ...op, source } : op) } }));
    } else if (active.kind === "stroke") {
      const source = sourcePoint(point), last = active.points[active.points.length - 1];
      if (source && Math.hypot(source.x - last.x, source.y - last.y) >= 1) active.points.push(source);
    }
  }

  function finish(event: PointerEvent<HTMLCanvasElement>, cancelled: boolean) {
    const contact = contacts.current.get(event.pointerId);
    contacts.current.delete(event.pointerId);
    if (usedMultipleFingers.current) {
      if (contacts.current.size < 2) pinch.current = null;
      if (!contacts.current.size) { usedMultipleFingers.current = false; gesture.current = null; }
      return;
    }
    const active = gesture.current;
    gesture.current = null;
    if (!contact || cancelled) return;
    if (active?.kind === "stroke") {
      const state = session.store.getState(), healing = state.edits.healing;
      const center = active.points[0], radius = healing.brush.size / 2, id = crypto.randomUUID();
      const source = active.mode === "clone" ? healing.cloneSource ?? undefined : chooseRepairSource(center, state.image, radius);
      const brush = { id, radius, feather: healing.brush.feather / 100, opacity: 1, source };
      session.edit(active.mode === "clone" ? "Clone stroke" : active.mode === "spot" ? "Heal spot" : "Heal stroke", (e) => ({ ...e,
        healing: { ...e.healing, ops: [...e.healing.ops, active.mode === "spot"
          ? { ...brush, type: "spot", mode: "spot", center }
          : { ...brush, type: "stroke", mode: active.mode, points: active.points }] },
      }));
      if (active.mode === "spot") session.selectRepair(id);
    }
    if (active?.kind !== "pan") return;
    if (active.travelled > 8 && performance.now() - active.time < 80) {
      let speed = active.velocity, frames = 0;
      const coast = () => {
        if (++frames > 30 || Math.hypot(speed.x, speed.y) < 0.02) return;
        speed = { x: speed.x * 0.8, y: speed.y * 0.8 };
        const current = session.store.getState().camera;
        session.moveCamera({ scale: current.scale, origin: { x: current.origin.x + speed.x * 16, y: current.origin.y + speed.y * 16 } });
        animation.current = requestAnimationFrame(coast);
      };
      animation.current = requestAnimationFrame(coast);
    }
    if (event.pointerType === "touch" && active.travelled < 6 && performance.now() - contact.began < 300) {
      const last = previousTap.current;
      if (last && performance.now() - last.time < 320 && Math.hypot(last.position.x - contact.position.x, last.position.y - contact.position.y) < 24) {
        session.toggleZoom(contact.position); previousTap.current = null;
      } else previousTap.current = { time: performance.now(), position: contact.position };
    }
  }

  return {
    cursor,
    onPointerDown, onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => finish(event, false),
    onPointerCancel: (event: PointerEvent<HTMLCanvasElement>) => finish(event, true),
    onPointerLeave: () => setCursor(null),
    doubleClick(point: Point) {
      const state = session.store.getState();
      if (state.tool !== "inspect" || state.sampler || (touchTime.current !== null && performance.now() - touchTime.current < 700)) return;
      cancelAnimationFrame(animation.current); session.toggleZoom(point);
    },
  };
}
