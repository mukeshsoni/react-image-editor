import { capitalize } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { initialEdits } from "../model/settings";
import { Group, Slider } from "./controls";

const defaults = initialEdits();

export function DetailPanel() {
  const session = useSession();
  const ready = useSessionState((state) => state.status === "ready");
  const sharpening = useSessionState((state) => state.edits.sharpening ?? defaults.sharpening!);
  const denoise = useSessionState((state) => state.edits.denoise ?? defaults.denoise!);
  return <div className="space-y-6" data-testid="details-section">
    <Group name="Sharpening" disabled={!ready} reset={() => session.edit("Reset sharpening", (e) => ({ ...e, sharpening: initialEdits().sharpening }))}>
      {(["amount", "radius", "detail", "masking"] as const).map((key) => <Slider key={key} id={`sharpening-${key}`} label={capitalize(key)} value={sharpening[key]}
        defaultValue={defaults.sharpening![key]} min={key === "radius" ? 0.5 : 0} max={key === "amount" ? 150 : key === "radius" ? 3 : 100} step={key === "radius" ? 0.1 : 1}
        onCommit={(value) => session.edit(`Sharpening ${key}`, (e) => ({ ...e, sharpening: { ...e.sharpening!, [key]: value } }))} />)}
    </Group>
    <Group name="Noise Reduction" disabled={!ready} reset={() => session.edit("Reset noise reduction", (e) => ({ ...e, denoise: initialEdits().denoise }))}>
      {(["luminance", "color", "detail"] as const).map((key) => <Slider key={key} id={`denoise-${key}`} label={capitalize(key)} value={denoise[key]}
        min={0} defaultValue={defaults.denoise![key]} onCommit={(value) => session.edit(`Denoise ${key}`, (e) => ({ ...e, denoise: { ...e.denoise!, [key]: value } }))} />)}
    </Group>
  </div>;
}
