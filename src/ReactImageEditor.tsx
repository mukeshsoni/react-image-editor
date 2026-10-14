import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { Crop, History, Redo2, RotateCcw, Stamp, Undo2 } from "lucide-react";
import { useStore } from "zustand";

import { Action } from "./components/controls";
import { DownloadControls } from "./components/DownloadControls";
import { Workspace } from "./components/Workspace";
import { estimateLevel } from "./engine/straighten";
import { useMedia } from "./hooks/use-media";
import { useGlobalTheme } from "./hooks/use-global-theme";
import { usePhoto } from "./hooks/use-photo";
import { cn } from "./lib/utils";
import { EditorThemeContext, SessionContext } from "./model/context";
import { createSession } from "./model/session";
import type { ImageEditorEdits, ThemeMode } from "./model/types";

export type ReactImageEditorProps = {
  imageSrc: string;
  onEditsChange?: (edits: ImageEditorEdits) => void;
  themeMode?: ThemeMode;
  themeScope?: "local" | "global";
};

function ownsKeyboard(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('[role="dialog"], [role="listbox"], [role="combobox"]')) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !["range", "checkbox", "radio", "button"].includes(target.type);
}

export function ReactImageEditor({ imageSrc, onEditsChange, themeMode = "dark", themeScope = "local" }: ReactImageEditorProps) {
  const [session] = useState(createSession);
  const photo = usePhoto(imageSrc, session);
  const mobile = useMedia("(max-width: 768px)");
  const prefersDark = useMedia("(prefers-color-scheme: dark)");
  const theme = themeMode === "system" ? prefersDark ? "dark" : "light" : themeMode;
  const ready = useStore(session.store, (state) => state.status === "ready");
  const tool = useStore(session.store, (state) => state.tool);
  const sourceId = useStore(session.store, (state) => state.sourceId);
  const canUndo = useStore(session.store, (state) => state.timeline.position > 0);
  const canRedo = useStore(session.store, (state) => state.timeline.position < state.timeline.entries.length - 1);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => onEditsChange ? session.subscribe(onEditsChange) : undefined, [onEditsChange, session]);
  useEffect(() => () => session.cancel(), [session]);
  useGlobalTheme(theme, themeScope === "global");

  function autoLevel() {
    if (!photo) return;
    const result = estimateLevel(photo.original);
    if (result.confidence >= 0.12) session.configureCrop({ rotation: Math.round(result.angle * 10) / 10 });
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || ownsKeyboard(event.target)) return;
    const state = session.store.getState();
    if (event.key === "Escape" && state.sampler) { event.preventDefault(); session.sample(null); return; }
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === "z") {
        event.preventDefault(); if (event.shiftKey) session.redo(); else session.undo();
      } else if (["=", "+", "-", "0"].includes(event.key)) {
        event.preventDefault(); if (event.key === "0") session.fit(); else session.zoom(event.key === "-" ? 1 / 1.2 : 1.2);
      }
      return;
    }
    if (state.tool === "crop" && !(event.target instanceof HTMLInputElement)) {
      if (event.key === "[" || event.key === "]") {
        event.preventDefault(); session.configureCrop({ rotation: (state.edits.crop.settings.rotation ?? 0) + (event.key === "[" ? -1 : 1) * (event.shiftKey ? 5 : 1) });
      } else if (event.key.toLowerCase() === "r") { event.preventDefault(); session.configureCrop({ rotation: 0 }); }
    }
    if (state.tool === "repair") {
      if (event.key === " ") { if (!(event.target instanceof HTMLButtonElement)) event.preventDefault(); session.holdSpace(true); }
      if ((event.key === "Delete" || event.key === "Backspace") && event.target instanceof HTMLCanvasElement) { event.preventDefault(); session.deleteRepair(); }
    }
  }

  return <SessionContext.Provider value={session}><EditorThemeContext.Provider value={theme}>
    <div data-testid="react-image-editor" className={cn("react-image-editor flex size-full min-h-0 flex-col overflow-hidden bg-rie-background text-rie-foreground", theme === "dark" && "dark")}
      onKeyDown={keyboard} onKeyUp={(event) => { if (event.key === " ") session.holdSpace(false); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) session.holdSpace(false); }}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-rie-border bg-rie-panel px-3 py-2">
        <div className="flex items-center gap-1">
          {!mobile ? <>
            <Action quiet aria-label={showHistory ? "Hide history" : "Show history"} aria-pressed={showHistory} onClick={() => setShowHistory(!showHistory)} className="px-2"><History aria-hidden="true" className="size-4" /></Action>
            <Action disabled={!ready} aria-pressed={tool === "crop"} primary={tool === "crop"} onClick={() => session.chooseTool(tool === "crop" ? "inspect" : "crop")}><Crop aria-hidden="true" className="size-4" />Crop</Action>
            <Action disabled={!ready} aria-label="Healing tool" aria-pressed={tool === "repair"} primary={tool === "repair"} onClick={() => session.chooseTool(tool === "repair" ? "inspect" : "repair")}><Stamp aria-hidden="true" className="size-4" />Healing</Action>
            <span className="mx-2 h-5 border-r border-rie-border" />
          </> : null}
          <Action quiet aria-label="Undo (⌘Z)" title="Undo (⌘Z)" disabled={!ready || !canUndo} onClick={session.undo} className="px-2"><Undo2 aria-hidden="true" className="size-4" /></Action>
          <Action quiet aria-label="Redo (⇧⌘Z)" title="Redo (⇧⌘Z)" disabled={!ready || !canRedo} onClick={session.redo} className="px-2"><Redo2 aria-hidden="true" className="size-4" /></Action>
          <Action quiet aria-label="Reset all edits" disabled={!ready} onClick={session.reset} className="px-2"><RotateCcw aria-hidden="true" className="size-4" />Reset</Action>
        </div>
        <DownloadControls photo={photo} />
      </header>
      <Workspace key={sourceId} photo={photo} mobile={mobile} showHistory={showHistory} autoLevel={autoLevel} />
    </div>
  </EditorThemeContext.Provider></SessionContext.Provider>;
}
