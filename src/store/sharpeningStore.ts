import { create } from "zustand";

import { DEFAULT_SHARPENING_SETTINGS, type SharpeningSettings } from "./cropStore";

type SharpeningStore = {
  sharpening: SharpeningSettings;

  setSharpening: (updates: Partial<SharpeningSettings>) => void;
  resetSharpening: () => void;
  resetSharpeningSetting: (name: keyof SharpeningSettings) => void;
};

export const useSharpeningStore = create<SharpeningStore>((set) => ({
  sharpening: { ...DEFAULT_SHARPENING_SETTINGS },

  setSharpening: (updates) => {
    set((state) => ({
      sharpening: {
        ...state.sharpening,
        ...updates,
      },
    }));
  },

  resetSharpening: () => {
    set({ sharpening: { ...DEFAULT_SHARPENING_SETTINGS } });
  },

  resetSharpeningSetting: (name) => {
    set((state) => ({
      sharpening: {
        ...state.sharpening,
        [name]: DEFAULT_SHARPENING_SETTINGS[name],
      },
    }));
  },
}));
