import { useEffect } from "react";

type Ownership = { original: boolean; applied: boolean; owners: Map<symbol, boolean> };
const themes = new WeakMap<HTMLElement, Ownership>();

/** Last registered global owner wins; the host is restored after the final owner. */
export function claimGlobalTheme(root: HTMLElement, dark: boolean): () => void {
  let ownership = themes.get(root);
  if (!ownership) {
    const original = root.classList.contains("dark");
    ownership = { original, applied: original, owners: new Map() };
    themes.set(root, ownership);
  }
  const owner = Symbol("editor-theme");
  const record = ownership;
  function apply() {
    const current = root.classList.contains("dark");
    if (current !== record.applied) record.original = current;
    const values = [...record.owners.values()];
    record.applied = values.length ? values[values.length - 1] : record.original;
    root.classList.toggle("dark", record.applied);
  }
  record.owners.set(owner, dark); apply();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    record.owners.delete(owner); apply();
    if (!record.owners.size) themes.delete(root);
  };
}

export function useGlobalTheme(theme: "light" | "dark", enabled: boolean): void {
  useEffect(() => enabled ? claimGlobalTheme(document.documentElement, theme === "dark") : undefined, [theme, enabled]);
}
