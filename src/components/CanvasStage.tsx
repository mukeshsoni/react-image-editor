import { useEffect, useLayoutEffect, useRef } from "react";

import { frameToCanvas, visibleView } from "../engine/geometry";
import type { PhotoRenderer } from "../engine/renderer";
import { useCanvasInput } from "../hooks/use-canvas-input";
import { cn } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { CropOverlay } from "./CropOverlay";

export function CanvasStage({ photo, coveredHeight }: { photo: PhotoRenderer | null; coveredHeight: number }) {
  const session = useSession();
  const state = useSessionState((value) => value);
  const holder = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const input = useCanvasInput(photo, canvas);
  const camera = visibleView(state.camera, state.presentationOffset);

  useLayoutEffect(() => {
    const element = holder.current;
    if (!element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      session.resize({ width: Math.max(1, Math.floor(box.width)), height: Math.max(1, Math.floor(box.height)), coveredHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, [coveredHeight, session]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = canvas.current;
      if (!element) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(state.viewport.width * dpr), height = Math.round(state.viewport.height * dpr);
      if (element.width !== width) element.width = width;
      if (element.height !== height) element.height = height;
      const ctx = element.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
      if (!photo || state.status !== "ready") return;
      const image = photo.frame(state.edits, state.tool === "crop");
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, camera.origin.x, camera.origin.y, image.width * camera.scale, image.height * camera.scale);
    });
    return () => cancelAnimationFrame(frame);
  }, [photo, state.edits, state.status, state.tool, state.viewport, camera.scale, camera.origin.x, camera.origin.y]);

  const hint = state.sampler === "balance" ? "Click image to pick white balance (Esc to cancel)"
    : state.sampler === "color" ? "Click image to pick point color (Esc to cancel)"
      : state.sampler === "clone" ? "Click image to set clone source (Esc to cancel)" : null;

  return <div ref={holder} className="relative size-full min-h-0 overflow-hidden bg-rie-background">
    <canvas ref={canvas} aria-label="Image preview" tabIndex={0} className={cn("absolute inset-0 size-full touch-none outline-none", state.sampler || (state.tool === "repair" && !state.spaceHeld) ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
      onPointerDown={input.onPointerDown} onPointerMove={input.onPointerMove} onPointerUp={input.onPointerUp}
      onPointerCancel={input.onPointerCancel} onPointerLeave={input.onPointerLeave}
      onDoubleClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); input.doubleClick({ x: event.clientX - box.x, y: event.clientY - box.y }); }} />
    {state.tool === "crop" && state.status === "ready" ? <CropOverlay camera={camera} /> : null}
    {state.tool === "repair" && photo ? <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${state.viewport.width} ${state.viewport.height}`}>
      {state.edits.healing.ops.map((op) => {
        if (op.type !== "spot") return null;
        const center = frameToCanvas(photo.framePoint(op.center, state.edits, false), camera);
        const source = op.source ? frameToCanvas(photo.framePoint(op.source, state.edits, false), camera) : null;
        return <g key={op.id} fill="none" stroke={state.selectedRepair === op.id ? "#22c55e" : "white"} strokeWidth="1.5">
          <circle cx={center.x} cy={center.y} r={op.radius * camera.scale} />
          {source ? <><line x1={center.x} y1={center.y} x2={source.x} y2={source.y} strokeDasharray="3 3" /><circle cx={source.x} cy={source.y} r="6" /></> : null}
        </g>;
      })}
      {input.cursor ? <circle cx={input.cursor.x} cy={input.cursor.y} r={state.edits.healing.brush.size * camera.scale / 2} stroke="white" fill="none" /> : null}
    </svg> : null}
    {hint ? <p className="pointer-events-none absolute top-4 left-4 z-20 max-w-64 rounded-md bg-rie-panel px-3 py-2 text-pretty text-xs shadow-sm">{hint}</p> : null}
    {state.status !== "ready" ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <p role="status" className="max-w-sm text-center text-pretty text-sm text-rie-muted">{state.status === "loading" ? "Loading image…" : state.error}</p>
    </div> : null}
  </div>;
}
