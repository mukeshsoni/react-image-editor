import { useEffect, useState } from "react";

type Options = {
  key: string;
  defaultValue: boolean;
};

export function useLocalStorageBoolean({ key, defaultValue }: Options) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return defaultValue;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      if (raw === "true") return true;
      if (raw === "false") return false;
      return defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? "true" : "false");
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}
