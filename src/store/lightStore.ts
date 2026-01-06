import { create } from "zustand";

import type { LightAdjustmentName, LightAdjustments } from "./cropStore";

const DEFAULT_LIGHT_ADJUSTMENTS: LightAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};

type LightStore = {
  lightAdjustments: LightAdjustments;

  setLightAdjustment: (name: LightAdjustmentName, value: number) => void;
  resetLightAdjustments: () => void;
  resetLightAdjustment: (name: LightAdjustmentName) => void;
};

export const useLightStore = create<LightStore>((set) => ({
  lightAdjustments: { ...DEFAULT_LIGHT_ADJUSTMENTS },

  setLightAdjustment: (name, value) => {
    set((state) => ({
      lightAdjustments: {
        ...state.lightAdjustments,
        [name]: value,
      },
    }));
  },

  resetLightAdjustments: () => {
    set({ lightAdjustments: { ...DEFAULT_LIGHT_ADJUSTMENTS } });
  },

  resetLightAdjustment: (name) => {
    set((state) => ({
      lightAdjustments: {
        ...state.lightAdjustments,
        [name]: DEFAULT_LIGHT_ADJUSTMENTS[name],
      },
    }));
  },
}));
