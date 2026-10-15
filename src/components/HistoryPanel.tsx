import { cn } from "../lib/utils";
import { useSession, useSessionState } from "../model/context";

export function HistoryPanel() {
  const session = useSession();
  const timeline = useSessionState((state) => state.timeline);
  const ready = useSessionState((state) => state.status === "ready");
  return <div data-testid="history-list" className="flex flex-col gap-1">
    {timeline.entries.map((entry, index) => <button type="button" key={index} data-testid={`history-entry-${index}`}
      aria-current={timeline.position === index ? "step" : undefined} disabled={!ready} onClick={() => session.jump(index)}
      className={cn("min-h-9 rounded-md px-3 py-2 text-left text-xs", timeline.position === index ? "bg-rie-accent text-rie-on-accent" : "hover:bg-rie-soft")}>
      {entry.title}
    </button>)}
    {!timeline.entries.length ? <p className="text-pretty text-xs text-rie-muted">Your edit history will appear here.</p> : null}
  </div>;
}
