import type { ReactNode } from "react";

type MobileEditorLayoutProps = {
  canvasPanel: ReactNode;
  trayPanel: ReactNode;
};

export function MobileEditorLayout({
  canvasPanel,
  trayPanel,
}: MobileEditorLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0">{canvasPanel}</div>
      <div className="max-h-[40%] min-h-0 overflow-y-auto border-t bg-muted">
        {trayPanel}
      </div>
    </div>
  );
}
