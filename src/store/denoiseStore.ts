import { create } from "zustand";

import { DEFAULT_DENOISE_SETTINGS, type DenoiseSettings } from "./cropStore";

type DenoiseStore = {
  denoise: DenoiseSettings;

  setDenoise: (updates: Partial<DenoiseSettings>) => void;
  resetDenoise: () => void;
};

export const useDenoiseStore = create<DenoiseStore>((set) => ({
  denoise: { ...DEFAULT_DENOISE_SETTINGS },

  setDenoise: (updates) => {
    set((state) => ({
      denoise: {
        ...state.denoise,
        ...updates,
      },
    }));
  },

  resetDenoise: () => {
    set({ denoise: { ...DEFAULT_DENOISE_SETTINGS } });
  },
}));
