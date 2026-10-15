import { useEffect, useState } from "react";

import { ReactImageEditor } from "./ReactImageEditor";
import type { ThemeMode } from "./model/types";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState(`${import.meta.env.BASE_URL}sample.svg`);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { const value = localStorage.getItem("react-image-editor:theme"); return value === "light" || value === "dark" ? value : "system"; }
    catch { return "system"; }
  });
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <main className="demo">
    <header className="demo-header">
      <h1>React Image Editor</h1>
      <label>Open image<input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="ml-auto">Theme<select value={theme} onChange={(event) => {
        const value = event.target.value as ThemeMode; setTheme(value);
        try { localStorage.setItem("react-image-editor:theme", value); } catch { /* Theme works without persistence. */ }
      }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </header>
    <section className="demo-editor" aria-label="Photo editor"><ReactImageEditor imageSrc={source} themeMode={theme} /></section>
  </main>;
}
