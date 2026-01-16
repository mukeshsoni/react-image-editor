import { create } from "zustand";

import type { PresetEdits, PresetId } from "./edits";

const DEFAULT_PRESET_EDITS: PresetEdits = {
  activePresetId: "none",
  intensity: 100,
};

type PresetStore = {
  preset: PresetEdits;

  setActivePreset: (presetId: PresetId) => void;
  setPresetIntensity: (intensity: number) => void;
  clearPreset: () => void;
};

export const usePresetStore = create<PresetStore>((set) => ({
  preset: { ...DEFAULT_PRESET_EDITS },

  setActivePreset: (presetId) => {
    set((state) => ({
      preset: {
        ...state.preset,
        activePresetId: presetId,
        intensity: presetId === "none" ? state.preset.intensity : 100,
      },
    }));
  },

  setPresetIntensity: (intensity) => {
    set((state) => ({
      preset: {
        ...state.preset,
        intensity,
      },
    }));
  },

  clearPreset: () => {
    set((state) => ({
      preset: {
        ...state.preset,
        activePresetId: "none",
      },
    }));
  },
}));
