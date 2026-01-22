/* eslint-disable react-refresh/only-export-components */

import * as React from "react";

import type { ResolvedTheme } from "@/lib/theme";

type EditorThemeContextValue = {
  resolvedTheme: ResolvedTheme;
};

const EditorThemeContext = React.createContext<EditorThemeContextValue | null>(
  null,
);

export function EditorThemeProvider({
  resolvedTheme,
  children,
}: {
  resolvedTheme: ResolvedTheme;
  children: React.ReactNode;
}) {
  return (
    <EditorThemeContext.Provider value={{ resolvedTheme }}>
      {children}
    </EditorThemeContext.Provider>
  );
}

export function useEditorTheme() {
  const value = React.useContext(EditorThemeContext);
  if (!value) return { resolvedTheme: "light" as const };
  return value;
}
