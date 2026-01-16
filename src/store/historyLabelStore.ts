import { create } from "zustand";

type HistoryLabelStore = {
  pendingLabel: string | null;
  pendingUntil: number | null;

  setPendingHistoryLabel: (label: string, ttlMs?: number) => void;
  consumePendingHistoryLabel: () => string | null;
};

export const useHistoryLabelStore = create<HistoryLabelStore>((set, get) => ({
  pendingLabel: null,
  pendingUntil: null,

  setPendingHistoryLabel: (label, ttlMs = 2000) => {
    set({
      pendingLabel: label,
      pendingUntil: Date.now() + Math.max(0, ttlMs),
    });
  },

  consumePendingHistoryLabel: () => {
    const { pendingLabel, pendingUntil } = get();

    const isExpired = pendingUntil != null && Date.now() > pendingUntil;
    if (!pendingLabel || isExpired) {
      if (pendingLabel || pendingUntil) {
        set({ pendingLabel: null, pendingUntil: null });
      }
      return null;
    }

    set({ pendingLabel: null, pendingUntil: null });
    return pendingLabel;
  },
}));
