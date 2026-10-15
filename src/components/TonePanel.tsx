import { useRef, useState } from "react";
import type { PointerEvent } from "react";

import { limit } from "../engine/geometry";
import { interpolateCurve } from "../engine/tone";
import { capitalize } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { initialEdits } from "../model/settings";
import type { CurveChannel, Point } from "../model/types";
import { Action, Choice, Group, Slider } from "./controls";

const POINT_GAP = 0.001;

export function TonePanel() {
  const session = useSession();
  const curve = useSessionState((state) => state.edits.toneCurve);
  const ready = useSessionState((state) => state.status === "ready");
  const [selection, setSelection] = useState(0);
  const drag = useRef<number | null>(null);
  const points = curve.point[curve.activeChannel];
  const selected = Math.min(selection, points.length - 1);
  const table = interpolateCurve(points);
  const line = Array.from({ length: 65 }, (_, i) => `${i ? "L" : "M"}${i * 100 / 64} ${100 - table[Math.round(i * 255 / 64)] * 100 / 255}`).join(" ");

  function save(next: Point[]) {
    session.edit("Tone curve", (e) => ({ ...e, toneCurve: { ...e.toneCurve, point: { ...e.toneCurve.point, [curve.activeChannel]: next } } }));
  }
  function move(index: number, point: Point) {
    const current = session.store.getState().edits.toneCurve.point[curve.activeChannel];
    const x = index === 0 ? 0 : index === current.length - 1 ? 1 : limit(point.x, current[index - 1].x + POINT_GAP, current[index + 1].x - POINT_GAP);
    save(current.map((p, i) => i === index ? { x, y: limit(point.y, 0, 1) } : p));
  }
  function coordinates(event: PointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: limit((event.clientX - box.left) / box.width, 0, 1), y: limit(1 - (event.clientY - box.top) / box.height, 0, 1) };
  }
  function add(point?: Point) {
    if (point) {
      const existing = points.findIndex((p) => Math.abs(p.x - point.x) < POINT_GAP);
      if (existing >= 0) { setSelection(existing); return existing; }
    }
    if (points.length >= 16) return;
    let gap = 0;
    if (point) gap = Math.max(0, points.findIndex((p) => p.x > point.x) - 1);
    else for (let i = 1; i < points.length - 1; i++) if (points[i + 1].x - points[i].x > points[gap + 1].x - points[gap].x) gap = i;
    if (points[gap + 1].x - points[gap].x < POINT_GAP * 2) { setSelection(gap); return gap; }
    const x = point ? limit(point.x, points[gap].x + POINT_GAP, points[gap + 1].x - POINT_GAP) : (points[gap].x + points[gap + 1].x) / 2;
    const inserted = { x, y: point?.y ?? table[Math.round(x * 255)] / 255 };
    const next = [...points, inserted].sort((a, b) => a.x - b.x);
    const index = next.indexOf(inserted);
    save(next); setSelection(index); return index;
  }

  return <Group name="Tone Curve" disabled={!ready} reset={() => { session.edit("Reset tone curve", (e) => ({ ...e, toneCurve: initialEdits().toneCurve })); setSelection(0); }}>
    <div role="group" aria-label="Curve mode" className="flex gap-2">
      {(["point", "parametric"] as const).map((mode) => <Action key={mode} aria-label={`Tone Curve mode: ${capitalize(mode)}`} aria-pressed={curve.mode === mode} primary={curve.mode === mode}
        onClick={() => session.edit("Curve mode", (e) => ({ ...e, toneCurve: { ...e.toneCurve, mode } }))}>{capitalize(mode)}</Action>)}
    </div>
    {curve.mode === "point" ? <>
      <Choice label="Tone curve channel" value={curve.activeChannel} options={[["rgb", "RGB"], ["r", "Red"], ["g", "Green"], ["b", "Blue"]]}
        onChange={(value) => { setSelection(0); session.edit("Curve channel", (e) => ({ ...e, toneCurve: { ...e.toneCurve, activeChannel: value as CurveChannel } })); }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="application" aria-label="Tone curve editor" tabIndex={0}
        className="h-48 w-full touch-none rounded-md border border-rie-border bg-rie-background"
        onPointerDown={(event) => {
          if (!ready) return;
          event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
          const point = coordinates(event);
          const hit = points.findIndex((p) => Math.hypot(p.x - point.x, p.y - point.y) < 0.06);
          drag.current = hit >= 0 ? hit : add(point) ?? null;
          if (drag.current !== null) setSelection(drag.current);
        }}
        onPointerMove={(event) => { if (drag.current !== null) move(drag.current, coordinates(event)); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault(); event.stopPropagation();
            if (selected > 0 && selected < points.length - 1) { save(points.filter((_, i) => i !== selected)); setSelection(0); }
          } else if (event.key.startsWith("Arrow")) {
            event.preventDefault(); event.stopPropagation();
            const p = points[selected], step = event.shiftKey ? 0.05 : 0.01;
            move(selected, { x: p.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: p.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0) });
          }
        }}>
        {[25, 50, 75].map((value) => <path key={value} d={`M${value},0V100 M0,${value}H100`} stroke="var(--rie-border)" strokeWidth="0.4" />)}
        <path d="M0,100L100,0" stroke="var(--rie-muted)" strokeDasharray="2 2" strokeWidth="0.5" />
        <path d={line} fill="none" stroke="var(--rie-accent)" strokeWidth="1" />
        {points.map((p, index) => <circle key={index} cx={p.x * 100} cy={(1 - p.y) * 100} r={index === selected ? 2.2 : 1.5}
          fill={index === selected ? "var(--rie-accent)" : "var(--rie-panel)"} stroke="var(--rie-foreground)" strokeWidth="0.6" />)}
      </svg>
      <div className="flex items-center gap-2">
        <Choice label="Selected curve point" value={String(selected)} options={points.map((_, i) => [String(i), `Point ${i + 1}`])} onChange={(value) => setSelection(Number(value))} />
        <Action disabled={points.length >= 16} onClick={() => add()}>Add point</Action>
      </div>
      <p className="text-pretty text-xs text-rie-muted">Click to add, drag or use arrow keys to move, and Delete to remove a point.</p>
    </> : (["highlights", "lights", "darks", "shadows"] as const).map((key) => <Slider key={key} id={`tone-curve-${key}`} label={capitalize(key)} value={curve.parametric.rgb[key]}
      onCommit={(value) => session.edit(`Curve ${key}`, (e) => ({ ...e, toneCurve: { ...e.toneCurve, parametric: { rgb: { ...e.toneCurve.parametric.rgb, [key]: value } } } }))} />)}
  </Group>;
}
