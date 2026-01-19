import { useEffect, useMemo, useState } from "react";

import {
  readStoredThemeMode,
  resolveTheme,
  storeThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

type Options = {
  defaultMode: ThemeMode;
  persist: boolean;
};

export function useThemeMode({ defaultMode, persist }: Options) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (!persist) return defaultMode;
    return readStoredThemeMode() ?? defaultMode;
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode !== "system") return;

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const onChange = () => setSystemPrefersDark(media.matches);

    onChange();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    // Safari fallback
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [mode]);

  useEffect(() => {
    if (!persist) return;
    storeThemeMode(mode);
  }, [mode, persist]);

  const resolvedTheme: ResolvedTheme = useMemo(
    () => resolveTheme(mode, systemPrefersDark),
    [mode, systemPrefersDark],
  );

  return {
    mode,
    setMode,
    resolvedTheme,
  };
}
