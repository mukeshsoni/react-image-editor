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
    <div className="flex h-full min-h-0 flex-col mobile-editor-layout">
      <div className="flex flex-1 min-h-0 flex-col">{canvasPanel}</div>
      <div className="flex min-h-0 flex-col overflow-hidden border-t bg-muted">
        {trayPanel}
      </div>
    </div>
  );
}
