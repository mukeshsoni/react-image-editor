import { create } from "zustand";

import type { WhiteBalancePreset, WhiteBalanceSettings } from "./cropStore";

const DEFAULT_WHITE_BALANCE: WhiteBalanceSettings = {
  temperatureKelvin: 6500,
  tint: 0,
  preset: "custom",
};

type WhiteBalanceStore = {
  whiteBalance: WhiteBalanceSettings;

  setWhiteBalance: (updates: Partial<WhiteBalanceSettings>) => void;
  setWhiteBalancePreset: (preset: WhiteBalancePreset) => void;
  resetWhiteBalance: () => void;
};

export const useWhiteBalanceStore = create<WhiteBalanceStore>((set) => ({
  whiteBalance: { ...DEFAULT_WHITE_BALANCE },

  setWhiteBalance: (updates) => {
    set((state) => {
      const nextWhiteBalance = { ...state.whiteBalance, ...updates };
      const hasManualChange =
        updates.temperatureKelvin !== undefined || updates.tint !== undefined;
      const shouldForceCustom = hasManualChange && updates.preset === undefined;

      return {
        whiteBalance: {
          ...nextWhiteBalance,
          preset: shouldForceCustom ? "custom" : nextWhiteBalance.preset,
        },
      };
    });
  },

  setWhiteBalancePreset: (preset) => {
    set((state) => ({
      whiteBalance: {
        ...state.whiteBalance,
        preset,
      },
    }));
  },

  resetWhiteBalance: () => {
    set({ whiteBalance: { ...DEFAULT_WHITE_BALANCE } });
  },
}));
