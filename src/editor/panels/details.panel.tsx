/* eslint-disable react-refresh/only-export-components */
import { useLocalStorageBoolean } from "@/hooks/useLocalStorageBoolean";
import { DetailsPanel } from "@/editor/DetailsPanel";
import { useDenoiseStore } from "@/store/denoiseStore";
import { useSharpeningStore } from "@/store/sharpeningStore";

import type { PanelContext } from "./context";
import type { PanelDefinition } from "./types";

function DetailsPanelFromContext({ isImageLoaded, Slider, panelVariant }: PanelContext) {
  const sharpening = useSharpeningStore((state) => state.sharpening);
  const setSharpening = useSharpeningStore((state) => state.setSharpening);
  const resetSharpening = useSharpeningStore((state) => state.resetSharpening);

  const denoise = useDenoiseStore((state) => state.denoise);
  const setDenoise = useDenoiseStore((state) => state.setDenoise);
  const resetDenoise = useDenoiseStore((state) => state.resetDenoise);

  const [isDetailsAccordionOpen, setIsDetailsAccordionOpen] =
    useLocalStorageBoolean({
      key: "react-image-editor:accordion:details",
      defaultValue: false,
    });

  // On mobile the editor already provides its own tray + tabs; nesting another
  // accordion makes the UI feel redundant and cramped.
  if (panelVariant === "flat") {
    return (
      <DetailsPanel
        isImageLoaded={isImageLoaded}
        sharpening={sharpening}
        setSharpening={setSharpening}
        resetSharpening={resetSharpening}
        denoise={denoise}
        setDenoise={setDenoise}
        resetDenoise={resetDenoise}
        Slider={Slider}
      />
    );
  }

  return (
    <details
      className="rounded-md border bg-card"
      data-testid="details-accordion"
      open={isDetailsAccordionOpen}
      onToggle={(event) => {
        setIsDetailsAccordionOpen((event.target as HTMLDetailsElement).open);
      }}
    >
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span>Details</span>
        </span>
        <span className="text-xs text-muted-foreground">▾</span>
      </summary>

      <div className="px-3 pb-3">
        <DetailsPanel
          isImageLoaded={isImageLoaded}
          sharpening={sharpening}
          setSharpening={setSharpening}
          resetSharpening={resetSharpening}
          denoise={denoise}
          setDenoise={setDenoise}
          resetDenoise={resetDenoise}
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
