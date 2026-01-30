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
    <div className="relative flex h-full min-h-0 flex-col mobile-editor-layout">
      <div className="flex flex-1 min-h-0 flex-col">{canvasPanel}</div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30">
        <div className="pointer-events-auto">{trayPanel}</div>
      </div>
    </div>
  );
}
