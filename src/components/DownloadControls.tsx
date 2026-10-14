import { useEffect, useRef, useState } from "react";

import { Download } from "lucide-react";

import type { PhotoRenderer } from "../engine/renderer";
import { useSession, useSessionState } from "../model/context";
import { Action, Choice, Slider } from "./controls";

export function DownloadControls({ photo }: { photo: PhotoRenderer | null }) {
  const session = useSession();
  const ready = useSessionState((state) => state.status === "ready");
  const cropping = useSessionState((state) => state.tool === "crop");
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resources = useRef({ mounted: false, urls: new Set<string>(), timers: new Set<ReturnType<typeof setTimeout>>() });

  useEffect(() => {
    const resource = resources.current;
    resource.mounted = true;
    return () => {
      resource.mounted = false;
      for (const timer of resource.timers) clearTimeout(timer);
      for (const url of resource.urls) URL.revokeObjectURL(url);
      resource.timers.clear(); resource.urls.clear();
    };
  }, []);

  async function download() {
    if (!photo || !ready || cropping || busy) return;
    session.flush(); setError(null); setBusy(true);
    const sourceId = session.store.getState().sourceId;
    try {
      const blob = await photo.encode(session.store.getState().edits, format, quality);
      const state = session.store.getState();
      if (!resources.current.mounted || state.sourceId !== sourceId || state.status !== "ready") return;
      const url = URL.createObjectURL(blob);
      resources.current.urls.add(url);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `edited-image.${format === "png" ? "png" : "jpg"}`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      const timer = setTimeout(() => { URL.revokeObjectURL(url); resources.current.urls.delete(url); resources.current.timers.delete(timer); }, 1000);
      resources.current.timers.add(timer);
    } catch {
      if (resources.current.mounted) setError("Failed to export image");
    } finally {
      if (resources.current.mounted) setBusy(false);
    }
  }

  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
    <Choice label="Export format" value={format} options={[["png", "PNG"], ["jpeg", "JPEG"]]} onChange={(value) => setFormat(value === "jpeg" ? "jpeg" : "png")} />
    <Action primary onClick={download} disabled={!ready || cropping || busy} aria-busy={busy} title={cropping ? "Apply crop to download" : undefined}>
      <Download aria-hidden="true" className="size-4" />Download
    </Action>
    {format === "jpeg" ? <div className="w-32"><Slider id="jpeg-quality" label="Quality" min={10} defaultValue={92} value={quality} onCommit={setQuality} /></div> : null}
    {error ? <p role="alert" className="w-full text-right text-xs text-red-600">{error}</p> : null}
  </div>;
}
