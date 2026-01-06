import { DetailsPanel } from "@/editor/DetailsPanel";
import { useSharpeningStore } from "@/store/sharpeningStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function DetailsPanelFromContext({ isImageLoaded, Slider }: PanelContext) {
  const sharpening = useSharpeningStore((state) => state.sharpening);
  const setSharpening = useSharpeningStore((state) => state.setSharpening);
  const resetSharpening = useSharpeningStore((state) => state.resetSharpening);

  return (
    <details className="rounded-md border bg-white" data-testid="details-accordion">
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span>Details</span>
        </span>
        <span className="text-xs text-gray-500">▾</span>
      </summary>

      <div className="px-3 pb-3">
        <DetailsPanel
          isImageLoaded={isImageLoaded}
          sharpening={sharpening}
          setSharpening={setSharpening}
          resetSharpening={resetSharpening}
          Slider={Slider}
        />
      </div>
    </details>
  );
}

const panel = {
  id: "details",
  order: 40,
  title: "Details",
  groupId: "advanced",
  Component: DetailsPanelFromContext,
} satisfies PanelDefinition<PanelContext>;

export default panel;
