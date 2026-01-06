import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

type PanelModule = {
  default: PanelDefinition<PanelContext>;
};

const panelModules = import.meta.glob<PanelModule>("./*.panel.tsx", {
  eager: true,
});

const allPanels = Object.values(panelModules).map((module) => module.default);

export function getPanelRegistry(): PanelDefinition<PanelContext>[] {
  return [...allPanels].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
