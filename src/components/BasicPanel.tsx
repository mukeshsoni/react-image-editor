import { Pipette } from "lucide-react";

import { capitalize } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { BALANCE_PRESETS, initialEdits } from "../model/settings";
import { Action, Choice, Group, Slider } from "./controls";

export function BasicPanel() {
  const session = useSession();
  const edits = useSessionState((state) => state.edits);
  const ready = useSessionState((state) => state.status === "ready");
  const sampling = useSessionState((state) => state.sampler);
  return <div className="space-y-6">
    <Group name="White Balance" testId="wb-section" disabled={!ready} reset={() => session.edit("Reset white balance", (e) => ({ ...e, whiteBalance: initialEdits().whiteBalance }))}>
      <div className="flex items-center gap-2">
        <Choice label="White Balance" value={edits.whiteBalance.preset} className="flex-1" options={BALANCE_PRESETS.map((p) => [p.id, p.name])}
          onChange={(id) => {
            const preset = BALANCE_PRESETS.find((p) => p.id === id);
            if (preset) session.edit("White balance preset", (e) => ({ ...e, whiteBalance: { temperatureKelvin: preset.kelvin, tint: preset.tint, preset: preset.id } }));
          }} />
        <Action data-testid="wb-eyedropper" aria-label="Pick white balance from image" aria-pressed={sampling === "balance"} onClick={() => session.sample("balance")}>
          <Pipette aria-hidden="true" className="size-4" />Pick
        </Action>
      </div>
      <Slider id="temp" label="Temp" min={2000} max={10000} step={50} defaultValue={6500} value={edits.whiteBalance.temperatureKelvin} format={(v) => `${v} K`}
        onCommit={(temperatureKelvin) => session.edit("Temperature", (e) => ({ ...e, whiteBalance: { ...e.whiteBalance, temperatureKelvin, preset: "custom" } }))} />
      <Slider id="tint" label="Tint" value={edits.whiteBalance.tint}
        onCommit={(tint) => session.edit("Tint", (e) => ({ ...e, whiteBalance: { ...e.whiteBalance, tint, preset: "custom" } }))} />
    </Group>
    <Group name="Tone" testId="tone-section" disabled={!ready} reset={() => session.edit("Reset tone", (e) => ({ ...e, light: initialEdits().light }))}>
      {(["exposure", "contrast", "highlights", "shadows", "whites", "blacks"] as const).map((key) => <Slider key={key} id={key} label={capitalize(key)} value={edits.light[key]}
        min={key === "exposure" ? -2 : -100} max={key === "exposure" ? 2 : 100} step={key === "exposure" ? 0.01 : 1}
        onCommit={(value) => session.edit(capitalize(key), (e) => ({ ...e, light: { ...e.light, [key]: value } }))} />)}
    </Group>
    <Group name="Color" testId="color-section" disabled={!ready} reset={() => session.edit("Reset color", (e) => ({ ...e, color: { ...e.color, vibrance: 0, saturation: 0 } }))}>
      {(["vibrance", "saturation"] as const).map((key) => <Slider key={key} id={key} label={capitalize(key)} value={edits.color[key]}
        onCommit={(value) => session.edit(capitalize(key), (e) => ({ ...e, color: { ...e.color, [key]: value } }))} />)}
    </Group>
  </div>;
}
