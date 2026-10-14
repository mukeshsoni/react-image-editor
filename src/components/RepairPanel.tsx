import { useSession, useSessionState } from "../model/context";
import type { RepairMode } from "../model/types";
import { Action, Choice, Group, Slider } from "./controls";

export function RepairPanel() {
  const session = useSession();
  const healing = useSessionState((state) => state.edits.healing);
  const ready = useSessionState((state) => state.status === "ready");
  const selected = useSessionState((state) => state.selectedRepair);
  return <Group name="Healing" testId="healing-panel" disabled={!ready}>
    <div className="flex items-center justify-between gap-2">
      <Choice label="Healing mode" testId="healing-mode" value={healing.mode} options={[["spot", "Spot"], ["heal", "Heal"], ["clone", "Clone"]]}
        onChange={(value) => { session.selectRepair(null); session.edit("Healing mode", (e) => ({ ...e, healing: { ...e.healing, mode: value as RepairMode } })); }} />
      <Action aria-label="Clear healing strokes" disabled={!healing.ops.length} onClick={() => {
        session.flush(); session.edit("Clear healing", (e) => ({ ...e, healing: { ...e.healing, ops: [], cloneSource: null } })); session.selectRepair(null);
      }}>Clear</Action>
    </div>
    <Slider id="healing-size" label="Brush size" min={5} max={200} defaultValue={30} value={healing.brush.size}
      onCommit={(size) => session.edit("Brush size", (e) => ({ ...e, healing: { ...e.healing, brush: { ...e.healing.brush, size } } }))} />
    <Slider id="healing-feather" label="Feather" min={0} defaultValue={50} value={healing.brush.feather}
      onCommit={(feather) => session.edit("Brush feather", (e) => ({ ...e, healing: { ...e.healing, brush: { ...e.healing.brush, feather } } }))} />
    {healing.mode === "clone" ? <div className="space-y-2">
      <Action onClick={() => session.sample("clone")}>Set clone source</Action>
      <p className="text-pretty text-xs text-rie-muted">Alt/Option-click to select a sample{healing.cloneSource ? " (selected)" : ""}, then paint on the photo.</p>
    </div> : <p className="text-pretty text-xs text-rie-muted">{healing.mode === "spot" ? "Click a distraction to repair it. Drag the source pin to refine the sample." : "Paint over a distraction to blend it with nearby texture."}</p>}
    {selected ? <Action onClick={session.deleteRepair}>Delete selected spot</Action> : null}
    <p className="text-pretty text-xs text-rie-muted">Hold Space and drag to pan. {healing.ops.length} operation{healing.ops.length === 1 ? "" : "s"}.</p>
  </Group>;
}
