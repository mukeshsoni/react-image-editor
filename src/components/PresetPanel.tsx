import { useSession, useSessionState } from "../model/context";
import { PRESETS, withPreset } from "../model/presets";
import { Action, Group, Slider } from "./controls";

export function PresetPanel() {
  const session = useSession();
  const strength = useSessionState((state) => state.edits.preset.intensity);
  const ready = useSessionState((state) => state.status === "ready");
  return <Group name="Presets" testId="presets-section" disabled={!ready}>
    <Slider id="preset-intensity" label="Strength" min={0} defaultValue={100} value={strength}
      onCommit={(intensity) => session.edit("Preset strength", (e) => ({ ...e, preset: { ...e.preset, intensity } }))} />
    <div className="grid grid-cols-2 gap-2">
      {PRESETS.map((preset) => <Action key={preset.id} className="justify-start whitespace-normal text-left" onClick={() => {
        session.flush(); session.edit(`${preset.name} preset`, (e) => withPreset(e, preset));
      }}>{preset.name}</Action>)}
    </div>
    <p className="text-pretty text-xs text-rie-muted">Apply a look at the chosen strength, then refine it with the manual controls.</p>
  </Group>;
}
