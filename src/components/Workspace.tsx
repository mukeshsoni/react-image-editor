import { useLayoutEffect, useRef, useState } from "react";

import { Crop, History, Minus, Plus, Scan, SlidersHorizontal, Sparkles, Stamp } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import type { PhotoRenderer } from "../engine/renderer";
import { cn } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { BasicPanel } from "./BasicPanel";
import { CanvasStage } from "./CanvasStage";
import { ColorPanel } from "./ColorPanel";
import { CropPanel } from "./CropPanel";
import { DetailPanel } from "./DetailPanel";
import { LensPanel, OpticsPanel, TransformPanel } from "./GeometryPanels";
import { HistoryPanel } from "./HistoryPanel";
import { PresetPanel } from "./PresetPanel";
import { RepairPanel } from "./RepairPanel";
import { TonePanel } from "./TonePanel";
import { Action, Disclosure } from "./controls";

type ToolTab = "Presets" | "Crop" | "Healing" | "Edit" | "History";
type EditTab = "Basic" | "Color" | "Tone" | "Details" | "Geometry";
const tools = [{ name: "Presets", icon: Sparkles }, { name: "Crop", icon: Crop }, { name: "Healing", icon: Stamp }, { name: "Edit", icon: SlidersHorizontal }, { name: "History", icon: History }] as const;
const sections: readonly EditTab[] = ["Basic", "Color", "Tone", "Details", "Geometry"];

function ViewControls() {
  const session = useSession();
  const scale = useSessionState((state) => state.camera.scale);
  const ready = useSessionState((state) => state.status === "ready");
  return <div className="rie-view-controls flex shrink-0 items-center justify-center gap-2 border-t border-rie-border bg-rie-panel px-2 py-1">
    <Action quiet aria-label="Zoom out" disabled={!ready} onClick={() => session.zoom(1 / 1.2)} className="size-8 min-h-8 p-0"><Minus aria-hidden="true" className="size-4" /></Action>
    <output className="min-w-12 text-center text-xs text-rie-muted tabular-nums">{Math.round(scale * 100)}%</output>
    <Action quiet aria-label="Zoom in" disabled={!ready} onClick={() => session.zoom(1.2)} className="size-8 min-h-8 p-0"><Plus aria-hidden="true" className="size-4" /></Action>
    <Action quiet aria-label="Reset zoom" disabled={!ready} onClick={() => session.fit()} className="min-h-8"><Scan aria-hidden="true" className="size-4" />Fit</Action>
  </div>;
}

export function Workspace({ photo, mobile, showHistory, autoLevel }: { photo: PhotoRenderer | null; mobile: boolean; showHistory: boolean; autoLevel: () => void }) {
  const session = useSession();
  const tool = useSessionState((state) => state.tool);
  const [selectedTab, setSelectedTab] = useState<ToolTab | null>(null);
  const [editTab, setEditTab] = useState<EditTab | null>(null);
  const [coveredHeight, setCoveredHeight] = useState(0);
  const [compact, setCompact] = useState(false);
  const area = useRef<HTMLDivElement>(null), tray = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null);
  const committedCrop = useSessionState((state) => Boolean(state.edits.crop.committed));
  const inactiveTab = selectedTab === "Healing" || (selectedTab === "Crop" && !committedCrop) ? null : selectedTab;
  const activeTab = tool === "crop" ? "Crop" : tool === "repair" ? "Healing" : inactiveTab;
  const expanded = activeTab !== null && (activeTab !== "Edit" || editTab !== null);

  useLayoutEffect(() => {
    const element = area.current;
    if (!mobile || !element) return;
    const measure = () => setCompact(element.getBoundingClientRect().height < 360);
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, [mobile]);

  useLayoutEffect(() => {
    const element = tray.current;
    if (!mobile || compact || !element) return;
    const measure = () => setCoveredHeight(Math.ceil(element.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, [mobile, compact]);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [activeTab, editTab]);

  function chooseTab(tab: ToolTab) {
    const next = activeTab === tab ? null : tab;
    setSelectedTab(next);
    if (next === "Edit") setEditTab(null);
    session.chooseTool(next === "Crop" ? "crop" : next === "Healing" ? "repair" : "inspect");
  }

  let content = null;
  if (activeTab === "Crop") content = <CropPanel autoLevel={autoLevel} />;
  else if (activeTab === "Healing") content = <RepairPanel />;
  else if (activeTab === "Presets") content = <PresetPanel />;
  else if (activeTab === "History") content = <HistoryPanel />;
  else if (editTab === "Basic") content = <BasicPanel />;
  else if (editTab === "Color") content = <ColorPanel />;
  else if (editTab === "Tone") content = <TonePanel />;
  else if (editTab === "Details") content = <DetailPanel />;
  else if (editTab === "Geometry") content = <div className="space-y-6"><TransformPanel autoLevel={autoLevel} /><LensPanel /><OpticsPanel /></div>;

  const navigation = <>
    {activeTab === "Edit" ? <div role="group" aria-label="Adjustment sections" className="grid grid-cols-5 gap-1 border-t border-rie-border px-2 py-1">
          {sections.map((section) => <Action key={section} primary={editTab === section} quiet={editTab !== section} aria-pressed={editTab === section} className="min-w-0 px-1"
            onClick={() => { setEditTab(editTab === section ? null : section); session.chooseTool("inspect"); }}>{section}</Action>)}
        </div> : null}
    <nav aria-label="Editing tools" className="grid grid-cols-5 gap-1 border-t border-rie-border px-2 py-1">
          {tools.map(({ name, icon: Icon }) => <Action key={name} quiet aria-pressed={activeTab === name} onClick={() => chooseTab(name)}
            className={cn("min-w-0 flex-col gap-1 px-1 py-2", activeTab === name && "bg-rie-soft text-rie-accent")}>
            <Icon aria-hidden="true" className="size-4" />{name}
          </Action>)}
    </nav>
  </>;

  if (mobile) return <div ref={area} className="flex min-h-0 flex-1 flex-col">
    {compact ? <>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1"><CanvasStage photo={photo} coveredHeight={0} /></div>
        {expanded ? <aside ref={scroll} data-testid="mobile-tray-scroll" aria-label="Tool controls"
          className="rie-compact-controls overflow-y-auto overscroll-contain border-l border-rie-border bg-rie-panel p-3">{content}</aside> : null}
      </div>
      <div className="shrink-0 bg-rie-panel">{navigation}</div>
    </> : <div className="relative min-h-0 flex-1">
      <CanvasStage photo={photo} coveredHeight={coveredHeight} />
      <div ref={tray} className="rie-tray absolute right-0 bottom-0 left-0 z-30 border-t border-rie-border bg-rie-panel">
        {expanded ? <div ref={scroll} data-testid="mobile-tray-scroll" className="rie-tray-content overflow-y-auto overscroll-contain p-4">{content}</div> : null}
        {navigation}
      </div>
    </div>}
    <ViewControls />
  </div>;

  return <PanelGroup direction="horizontal" autoSaveId="react-image-editor:panels" className="min-h-0 flex-1">
    {showHistory ? <>
      <Panel id="history" order={1} defaultSize={17} minSize={12} maxSize={28}>
        <aside aria-label="Editing history" className="h-full overflow-y-auto bg-rie-panel"><Disclosure name="History" initiallyOpen><HistoryPanel /></Disclosure></aside>
      </Panel>
      <PanelResizeHandle aria-label="Resize history panel" className="rie-divider w-1 bg-rie-border" />
    </> : null}
    <Panel id="preview" order={2} defaultSize={showHistory ? 57 : 74} minSize={25}>
      <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1"><CanvasStage photo={photo} coveredHeight={0} /></div><ViewControls /></div>
    </Panel>
    <PanelResizeHandle aria-label="Resize adjustments panel" className="rie-divider w-1 bg-rie-border" />
    <Panel id="adjustments" order={3} defaultSize={26} minSize={20} maxSize={45}>
      <aside aria-label="Image adjustments" className="h-full overflow-y-auto overscroll-contain bg-rie-panel">
        {tool === "crop" ? <div className="border-b border-rie-border p-4"><CropPanel autoLevel={autoLevel} /></div> : null}
        <Disclosure name="Basic" initiallyOpen><BasicPanel /></Disclosure>
        <Disclosure name="Presets"><PresetPanel /></Disclosure>
        <Disclosure name="Color Mixer"><ColorPanel /></Disclosure>
        <Disclosure name="Tone Curve"><TonePanel /></Disclosure>
        <Disclosure name="Details"><DetailPanel /></Disclosure>
        <Disclosure name="Transform"><TransformPanel autoLevel={autoLevel} /></Disclosure>
        <Disclosure name="Lens Corrections"><LensPanel /></Disclosure>
        <Disclosure name="Optics"><OpticsPanel /></Disclosure>
        <Disclosure name="Healing"><RepairPanel /></Disclosure>
      </aside>
    </Panel>
  </PanelGroup>;
}
