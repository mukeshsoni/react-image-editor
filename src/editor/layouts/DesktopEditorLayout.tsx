import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type DesktopEditorLayoutProps = {
  historyPanel: ReactNode;
  canvasPanel: ReactNode;
  controlsPanel: ReactNode;
  isHistoryPaneOpen: boolean;
  onCanvasResize: (panelWidth: number) => void;
};

export function DesktopEditorLayout({
  historyPanel,
  canvasPanel,
  controlsPanel,
  isHistoryPaneOpen,
  onCanvasResize,
}: DesktopEditorLayoutProps) {
  return (
    <ResizablePanelGroup
      id="container-panel"
      direction="horizontal"
      className="flex flex-1 min-h-0 overflow-hidden"
    >
      {isHistoryPaneOpen ? (
        <>
          <ResizablePanel defaultSize={10} className="min-h-0">
            {historyPanel}
          </ResizablePanel>
          <ResizableHandle className="w-[2px] bg-border mx-2" />
        </>
      ) : null}

      <ResizablePanel
        className="flex flex-col min-h-0 overflow-hidden"
        defaultSize={isHistoryPaneOpen ? 57 : 75}
        onResize={onCanvasResize}
      >
        {canvasPanel}
      </ResizablePanel>

      <ResizableHandle className="w-[2px] bg-border mx-2" />
      <ResizablePanel defaultSize={12} className="min-h-0">
        {controlsPanel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
