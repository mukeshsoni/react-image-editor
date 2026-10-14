import { useRef } from "react";
import type { PointerEvent } from "react";

import { CROP_HANDLES, resizeSelection } from "../engine/geometry";
import type { CropHandle } from "../engine/geometry";
import { useSession, useSessionState } from "../model/context";
import type { Camera, Point, Rectangle } from "../model/types";

export function CropOverlay({ camera }: { camera: Camera }) {
  const session = useSession();
  const crop = useSessionState((state) => state.edits.crop);
  const gesture = useRef<{ rect: Rectangle; start: Point; handle: CropHandle | null } | null>(null);

  function begin(event: PointerEvent<HTMLElement>, handle: CropHandle | null) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { rect: crop.rect, start: { x: event.clientX, y: event.clientY }, handle };
  }
  function keyboardDelta(key: string, large: boolean): Point {
    const step = large ? 10 : 1;
    return { x: key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0, y: key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0 };
  }

  return <div data-testid="crop-region" aria-label="Crop selection" tabIndex={0} className="rie-crop absolute z-10 touch-none border border-white"
    style={{ left: camera.origin.x + crop.rect.x * camera.scale, top: camera.origin.y + crop.rect.y * camera.scale, width: crop.rect.width * camera.scale, height: crop.rect.height * camera.scale }}
    onPointerDown={(event) => begin(event, null)} onPointerMove={(event) => {
      const active = gesture.current;
      if (!active) return;
      const delta = { x: (event.clientX - active.start.x) / camera.scale, y: (event.clientY - active.start.y) / camera.scale };
      session.selectCrop(active.handle ? resizeSelection(active.rect, active.handle, delta, crop.settings.aspectRatioLocked)
        : { ...active.rect, x: active.rect.x + delta.x, y: active.rect.y + delta.y });
    }} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}
    onKeyDown={(event) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      const delta = keyboardDelta(event.key, event.shiftKey);
      session.selectCrop({ ...crop.rect, x: crop.rect.x + delta.x, y: crop.rect.y + delta.y });
    }}>
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      <path d="M33.33,0V100 M66.67,0V100 M0,33.33H100 M0,66.67H100" stroke="white" strokeWidth="0.25" opacity="0.65" />
    </svg>
    {CROP_HANDLES.map((handle) => <button key={handle} type="button" data-testid={`crop-handle-${handle}`} aria-label={`Resize crop ${handle}`}
      className="rie-handle absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: handle.includes("left") ? "0%" : handle.includes("right") ? "100%" : "50%", top: handle.includes("top") ? "0%" : handle.includes("bottom") ? "100%" : "50%",
        cursor: handle === "top" || handle === "bottom" ? "ns-resize" : handle === "left" || handle === "right" ? "ew-resize" : handle === "top-left" || handle === "bottom-right" ? "nwse-resize" : "nesw-resize" }}
      onPointerDown={(event) => begin(event, handle)} onKeyDown={(event) => {
        if (!event.key.startsWith("Arrow")) return;
        event.preventDefault(); event.stopPropagation();
        session.selectCrop(resizeSelection(crop.rect, handle, keyboardDelta(event.key, event.shiftKey), crop.settings.aspectRatioLocked));
      }}><span className="size-2.5 rounded-sm border border-black/50 bg-white shadow-sm" /></button>)}
  </div>;
}
