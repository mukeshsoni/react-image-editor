import { createContext, useContext } from "react";

import { useStore } from "zustand";

import type { EditorSession, SessionState } from "./session";

export const SessionContext = createContext<EditorSession | null>(null);
export const EditorThemeContext = createContext<"light" | "dark">("light");

export function useSession(): EditorSession {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Editor controls must be mounted inside ReactImageEditor");
  return value;
}

export function useSessionState<T>(selector: (state: SessionState) => T): T {
  const session = useSession();
  return useStore(session.store, selector);
}
