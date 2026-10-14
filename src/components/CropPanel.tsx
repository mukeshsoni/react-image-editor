import { useContext, useRef, useState } from "react";

import * as Dialog from "@radix-ui/react-dialog";
import { Lock, Unlock, X } from "lucide-react";

import { cn } from "../lib/utils";
import { EditorThemeContext, useSession, useSessionState } from "../model/context";
import { ASPECT_OPTIONS } from "../model/settings";
import { Action, Choice, Slider } from "./controls";

export function CropPanel({ autoLevel }: { autoLevel: () => void }) {
  const session = useSession();
  const crop = useSessionState((state) => state.edits.crop);
  const editing = useSessionState((state) => state.tool === "crop");
  const ready = useSessionState((state) => state.status === "ready");
  const theme = useContext(EditorThemeContext);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const widthField = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const ratio = Number(width) / Number(height);
  const valid = Number(width) > 0 && Number(height) > 0 && Number.isFinite(ratio) && ratio > 0;

  if (!editing) return <div className="space-y-3">
    <p className="text-pretty text-sm text-rie-muted">{crop.committed ? "Crop applied. Refine the framing whenever you like." : "Choose a composition for this image."}</p>
    <Action disabled={!ready} onClick={() => session.chooseTool("crop")}>Edit crop</Action>
  </div>;

  return <fieldset disabled={!ready} className="min-w-0 space-y-4 border-0 p-0">
    <div className="flex items-center justify-between gap-2"><h3 className="text-balance text-sm font-semibold">Crop & straighten</h3><Action onClick={session.resetCrop}>Reset crop</Action></div>
    <div className="flex items-center gap-2">
      <Choice triggerRef={trigger} label="Aspect ratio" value={crop.settings.aspectRatio} options={ASPECT_OPTIONS} className="flex-1"
        onChange={(aspectRatio) => aspectRatio === "custom" ? setOpen(true) : session.configureCrop({ aspectRatio })} />
      <Action aria-label={crop.settings.aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"} aria-pressed={crop.settings.aspectRatioLocked}
        onClick={() => session.configureCrop({ aspectRatioLocked: !crop.settings.aspectRatioLocked })}>
        {crop.settings.aspectRatioLocked ? <Lock aria-hidden="true" className="size-4" /> : <Unlock aria-hidden="true" className="size-4" />}
      </Action>
    </div>
    {crop.settings.aspectRatio === "custom" ? <Action quiet onClick={() => setOpen(true)}>Custom: {crop.settings.customAspectRatio}</Action> : null}
    <Slider id="crop-rotation" label="Straighten" min={-45} max={45} step={0.1} value={crop.settings.rotation ?? 0} format={(v) => `${v.toFixed(1)}°`}
      onCommit={(rotation) => session.configureCrop({ rotation })} />
    <div className="flex flex-wrap gap-2"><Action onClick={autoLevel}>Auto straighten</Action><Action quiet onClick={() => session.configureCrop({ rotation: 0 })}>Reset rotation</Action></div>
    <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={crop.settings.constrainCrop !== false}
      onChange={(event) => session.configureCrop({ constrainCrop: event.target.checked })} />Constrain Crop</label>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-rie-muted tabular-nums">{Math.round(crop.rect.width)} × {Math.round(crop.rect.height)} px</span>
      <Action primary onClick={session.applyCrop}>Apply</Action>
    </div>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="rie-overlay fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className={cn("rie-overlay rie-dialog fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-rie-border bg-rie-panel p-6 text-rie-foreground shadow-lg", theme === "dark" && "dark")}
          onOpenAutoFocus={(event) => { event.preventDefault(); widthField.current?.focus(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
          <Dialog.Title className="text-balance text-lg font-semibold">Custom Aspect Ratio</Dialog.Title>
          <Dialog.Description className="text-pretty text-sm text-rie-muted">Enter a positive width and height to set your crop proportions.</Dialog.Description>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-sm">Width<input ref={widthField} className="rie-number w-full" type="number" min="0" step="any" value={width} onChange={(event) => setWidth(event.target.value)} /></label>
            <label className="space-y-2 text-sm">Height<input className="rie-number w-full" type="number" min="0" step="any" value={height} onChange={(event) => setHeight(event.target.value)} /></label>
          </div>
          {!valid && (width || height) ? <p className="text-sm text-red-600">Use a positive, finite width and height.</p> : null}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild><Action>Cancel</Action></Dialog.Close>
            <Action primary disabled={!valid} onClick={() => {
              session.configureCrop({ aspectRatio: "custom", customAspectRatio: `${Number(width)}x${Number(height)}` }); setOpen(false);
            }}>Apply</Action>
          </div>
          <Dialog.Close asChild><Action quiet aria-label="Close dialog" className="absolute top-2 right-2 size-8 min-h-8 p-0"><X aria-hidden="true" className="size-4" /></Action></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </fieldset>;
}
