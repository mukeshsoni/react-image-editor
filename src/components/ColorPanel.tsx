import { useState } from "react";

import * as Tabs from "@radix-ui/react-tabs";
import { Pipette } from "lucide-react";

import { capitalize, cn } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";
import { COLOR_BANDS, initialEdits } from "../model/settings";
import type { ColorBand } from "../model/types";
import { Action, Group, Slider } from "./controls";

const swatches = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777"];

export function ColorPanel() {
  const session = useSession();
  const color = useSessionState((state) => state.edits.color);
  const ready = useSessionState((state) => state.status === "ready");
  const sampler = useSessionState((state) => state.sampler);
  const [band, setBand] = useState<ColorBand>("red");
  return <Group name="Color Mixer" disabled={!ready} reset={() => session.edit("Reset mixer", (e) => ({ ...e,
    color: { ...e.color, mixerHsl: initialEdits().color.mixerHsl, pointColor: initialEdits().color.pointColor },
  }))}>
    <Tabs.Root defaultValue="mixer">
      <Tabs.List aria-label="Color mixer mode" className="rie-tabs mb-4 grid grid-cols-2 gap-1 rounded-md bg-rie-soft p-1">
        <Tabs.Trigger value="mixer">Mixer</Tabs.Trigger><Tabs.Trigger value="point">Point Color</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="mixer" className="space-y-4">
        <div role="group" aria-label="Color bands" className="grid grid-cols-8 gap-1">
          {COLOR_BANDS.map((name, i) => <button type="button" key={name} data-testid={`mixer-band-${name}`} aria-label={capitalize(name)} aria-pressed={band === name}
            onClick={() => setBand(name)} className={cn("flex min-h-11 items-center justify-center rounded-md border-2", band === name ? "border-rie-foreground" : "border-transparent")}>
            <span aria-hidden="true" className="size-4 rounded-full" style={{ background: swatches[i] }} />
          </button>)}
        </div>
        <div className="flex items-center justify-between"><h4 className="text-xs font-medium">{capitalize(band)}</h4>
          <Action quiet onClick={() => session.edit(`Reset ${band}`, (e) => ({ ...e, color: { ...e.color, mixerHsl: { ...e.color.mixerHsl, [band]: { hue: 0, saturation: 0, luminance: 0 } } } }))}>Reset band</Action>
        </div>
        {(["hue", "saturation", "luminance"] as const).map((key) => <Slider key={`${band}-${key}`} id={`mixer-${band}-${key}`} label={capitalize(key)} value={color.mixerHsl[band][key]}
          onCommit={(value) => session.edit(`${capitalize(band)} ${key}`, (e) => ({ ...e, color: { ...e.color, mixerHsl: { ...e.color.mixerHsl, [band]: { ...e.color.mixerHsl[band], [key]: value } } } }))} />)}
      </Tabs.Content>
      <Tabs.Content value="point" className="space-y-4">
        <Action data-testid="point-color-eyedropper" aria-pressed={sampler === "color"} onClick={() => session.sample("color")}><Pipette aria-hidden="true" className="size-4" />Pick color</Action>
        <p className="text-pretty text-xs text-rie-muted">{color.pointColor.hue === null ? "Pick a color from the image to adjust it selectively." : `Selected hue: ${Math.round(color.pointColor.hue * 360)}°`}</p>
        <Slider id="point-color-range" label="Range" min={0} defaultValue={50} value={color.pointColor.range}
          onCommit={(range) => session.edit("Point color range", (e) => ({ ...e, color: { ...e.color, pointColor: { ...e.color.pointColor, range } } }))} />
        {(["hue", "saturation", "luminance"] as const).map((channel) => {
          const key = `${channel}Shift` as const;
          return <Slider key={key} id={`point-color-${channel}`} label={capitalize(channel)} value={color.pointColor[key]}
            onCommit={(value) => session.edit(`Point color ${channel}`, (e) => ({ ...e, color: { ...e.color, pointColor: { ...e.color.pointColor, [key]: value } } }))} />;
        })}
      </Tabs.Content>
    </Tabs.Root>
  </Group>;
}
