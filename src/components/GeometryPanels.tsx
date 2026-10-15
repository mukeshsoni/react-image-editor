import { capitalize } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { initialEdits } from "../model/settings";
import { Action, Group, Slider } from "./controls";

export function TransformPanel({ autoLevel }: { autoLevel: () => void }) {
  const session = useSession();
  const settings = useSessionState((state) => state.edits.geometryOptics.perspective);
  const ready = useSessionState((state) => state.status === "ready");
  return <Group name="Perspective" disabled={!ready} reset={() => session.edit("Reset perspective", (e) => ({ ...e,
    geometryOptics: { ...e.geometryOptics, perspective: initialEdits().geometryOptics.perspective },
  }))}>
    <Action onClick={autoLevel}>Auto straighten</Action>
    {(["vertical", "horizontal", "aspect"] as const).map((key) => <Slider key={key} id={`transform-${key}`} label={capitalize(key)} value={settings[key] ?? 0}
      onCommit={(value) => session.edit(`Perspective ${key}`, (e) => ({ ...e, geometryOptics: { ...e.geometryOptics, perspective: { ...e.geometryOptics.perspective, [key]: value } } }))} />)}
  </Group>;
}

export function LensPanel() {
  const session = useSession();
  const settings = useSessionState((state) => state.edits.geometryOptics.lensCorrections);
  const ready = useSessionState((state) => state.status === "ready");
  return <Group name="Lens Corrections" disabled={!ready} reset={() => session.edit("Reset lens", (e) => ({ ...e,
    geometryOptics: { ...e.geometryOptics, lensCorrections: initialEdits().geometryOptics.lensCorrections },
  }))}>
    <Slider id="lens-distortion" label="Distortion" value={settings.distortion} onCommit={(distortion) => session.edit("Distortion", (e) => ({ ...e,
      geometryOptics: { ...e.geometryOptics, lensCorrections: { ...e.geometryOptics.lensCorrections, distortion } },
    }))} />
    <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={settings.chromaticAberration} onChange={(event) => {
      const chromaticAberration = event.target.checked;
      session.edit("Chromatic aberration", (e) => ({ ...e, geometryOptics: { ...e.geometryOptics, lensCorrections: { ...e.geometryOptics.lensCorrections, chromaticAberration } } }));
    }} />Remove Chromatic Aberration</label>
  </Group>;
}

export function OpticsPanel() {
  const session = useSession();
  const settings = useSessionState((state) => state.edits.geometryOptics.optics);
  const ready = useSessionState((state) => state.status === "ready");
  return <Group name="Optics" disabled={!ready} reset={() => session.edit("Reset optics", (e) => ({ ...e,
    geometryOptics: { ...e.geometryOptics, optics: initialEdits().geometryOptics.optics },
  }))}>
    {(["vignette", "grain", "dehaze"] as const).map((key) => <Slider key={key} id={`optics-${key}`} label={capitalize(key)} value={settings[key]} min={key === "grain" ? 0 : -100}
      onCommit={(value) => session.edit(capitalize(key), (e) => ({ ...e, geometryOptics: { ...e.geometryOptics, optics: { ...e.geometryOptics.optics, [key]: value } } }))} />)}
  </Group>;
}
