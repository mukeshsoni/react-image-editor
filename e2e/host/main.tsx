import { useCallback, useEffect, useRef, useState, version } from "react";
import { createRoot } from "react-dom/client";

import { ReactImageEditor } from "editor-under-test";
import type { ImageEditorEdits, ThemeMode } from "editor-under-test";

import "test-host-styles";
import "./layout.css";

export function TestHost() {
  const params = new URLSearchParams(location.search);
  const initialSource = params.get("image") ?? "/__e2e_images__/grid.png";
  const [imageSrc, setImageSrc] = useState(initialSource);
  const [draftSource, setDraftSource] = useState(initialSource);
  const [mounted, setMounted] = useState(true);
  const [renders, setRenders] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>((params.get("theme") as ThemeMode) ?? "light");
  const [events, setEvents] = useState<ImageEditorEdits[]>([]);
  const fileUrl = useRef<string | null>(null);
  const onEditsChange = useCallback((edits: ImageEditorEdits) => {
    setEvents((previous) => [...previous.slice(-199), edits]);
  }, []);

  useEffect(() => () => {
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
  }, []);

  return (
    <main className="test-host">
      <header className="test-toolbar">
        <h1>Image editor test host</h1>
        <label>Image URL<input aria-label="Image URL" value={draftSource} onChange={(event) => setDraftSource(event.target.value)} /></label>
        <button type="button" onClick={() => setImageSrc(draftSource)}>Load image</button>
        <label>Upload image<input type="file" accept="image/*" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
          fileUrl.current = URL.createObjectURL(file);
          setImageSrc(fileUrl.current);
        }} /></label>
        <button type="button" onClick={() => setMounted((value) => !value)}>{mounted ? "Unmount editor" : "Mount editor"}</button>
        <button type="button" onClick={() => setRenders((value) => value + 1)}>Rerender host</button>
        <label>Theme<select value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>
          <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
        </select></label>
        <input aria-label="Host text field" placeholder="Host text" />
      </header>
      <section className="test-editor" aria-label="Editor">
        {mounted ? <ReactImageEditor imageSrc={imageSrc} onEditsChange={onEditsChange} themeMode={theme} /> : null}
      </section>
      <output hidden data-testid="latest-edits">{JSON.stringify(events.at(-1) ?? null)}</output>
      <output hidden data-testid="edit-events">{JSON.stringify(events)}</output>
      <output hidden data-testid="event-count">{events.length}</output>
      <output hidden data-testid="host-renders">{renders}</output>
      <output hidden data-testid="react-version">{version}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<TestHost />);
