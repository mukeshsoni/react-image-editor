import { create } from "zustand";

import type { ColorAdjustmentName, ColorAdjustments } from "./cropStore";
import { createDefaultColorAdjustments } from "./cropStore";

const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = createDefaultColorAdjustments();

type ColorStore = {
  colorAdjustments: ColorAdjustments;

  setColorAdjustment: (name: ColorAdjustmentName, value: number) => void;
  resetColorAdjustments: () => void;
  resetColorAdjustment: (name: ColorAdjustmentName) => void;
};

export const useColorStore = create<ColorStore>((set) => ({
  colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,

  setColorAdjustment: (name, value) => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        [name]: value,
      },
    }));
  },

  resetColorAdjustments: () => {
    set({ colorAdjustments: createDefaultColorAdjustments() });
  },

  resetColorAdjustment: (name) => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        [name]: DEFAULT_COLOR_ADJUSTMENTS[name],
      },
    }));
  },
}));
