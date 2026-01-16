import { create } from "zustand";

import type { ColorAdjustmentName, ColorAdjustments } from "./cropStore";
import {
  createDefaultColorAdjustments,
  createDefaultMixerHslAdjustments,
  createDefaultPointColorAdjustments,
} from "./cropStore";

const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = createDefaultColorAdjustments();

type ColorStore = {
  colorAdjustments: ColorAdjustments;

  setColorAdjustment: (name: ColorAdjustmentName, value: number) => void;
  resetColorAdjustments: () => void;
  resetColorAdjustment: (name: ColorAdjustmentName) => void;

  setMixerBandAdjustment: (
    band: keyof ColorAdjustments["mixerHsl"],
    channel: "hue" | "saturation" | "luminance",
    value: number,
  ) => void;
  resetMixerBand: (band: keyof ColorAdjustments["mixerHsl"]) => void;
  resetMixer: () => void;

  setPointColor: (updates: Partial<ColorAdjustments["pointColor"]>) => void;
  resetPointColor: () => void;
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

  setMixerBandAdjustment: (band, channel, value) => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        mixerHsl: {
          ...state.colorAdjustments.mixerHsl,
          [band]: {
            ...state.colorAdjustments.mixerHsl[band],
            [channel]: value,
          },
        },
      },
    }));
  },

  resetMixerBand: (band) => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        mixerHsl: {
          ...state.colorAdjustments.mixerHsl,
          [band]: createDefaultMixerHslAdjustments()[band],
        },
      },
    }));
  },

  resetMixer: () => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        mixerHsl: createDefaultMixerHslAdjustments(),
      },
    }));
  },

  setPointColor: (updates) => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        pointColor: {
          ...state.colorAdjustments.pointColor,
          ...updates,
        },
      },
    }));
  },

  resetPointColor: () => {
    set((state) => ({
      colorAdjustments: {
        ...state.colorAdjustments,
        pointColor: createDefaultPointColorAdjustments(),
      },
    }));
  },
}));
