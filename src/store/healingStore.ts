import { create } from "zustand";

import type { Point } from "./cropStore";

export type HealingMode = "spot" | "heal" | "clone";

export type HealingBrushSettings = {
  size: number;
  feather: number;
};

export type HealingSpotOp = {
  id: string;
  type: "spot";
  mode: "spot" | "heal";
  center: Point;
  radius: number;
  feather: number;
  opacity: number;
};

export type HealingStrokeOp = {
  id: string;
  type: "stroke";
  mode: "heal" | "clone";
  points: Point[];
  radius: number;
  feather: number;
  opacity: number;
  source?: Point;
};

export type HealingOp = HealingSpotOp | HealingStrokeOp;

export type HealingEdits = {
  version: 1;
  mode: HealingMode;
  brush: HealingBrushSettings;
  ops: HealingOp[];
  cloneSource: Point | null;
};

const DEFAULT_HEALING_BRUSH: HealingBrushSettings = {
  size: 30,
  feather: 50,
};

const DEFAULT_HEALING_EDITS: HealingEdits = {
  version: 1,
  mode: "spot",
  brush: { ...DEFAULT_HEALING_BRUSH },
  ops: [],
  cloneSource: null,
};

type HealingStore = {
  healingMode: HealingMode;
  healingBrush: HealingBrushSettings;
  healingOps: HealingOp[];
  cloneSource: Point | null;

  setHealingMode: (mode: HealingMode) => void;
  setHealingBrushSettings: (updates: Partial<HealingBrushSettings>) => void;
  setCloneSource: (source: Point | null) => void;

  addHealingOp: (op: HealingOp) => void;
  removeHealingOp: (id: string) => void;
  clearHealingOps: () => void;

  setHealingOps: (ops: HealingOp[]) => void;
  resetHealing: () => void;
};

export const useHealingStore = create<HealingStore>((set) => ({
  healingMode: DEFAULT_HEALING_EDITS.mode,
  healingBrush: { ...DEFAULT_HEALING_BRUSH },
  healingOps: [],
  cloneSource: null,

  setHealingMode: (mode) => {
    set({ healingMode: mode });
  },

  setHealingBrushSettings: (updates) => {
    set((state) => ({
      healingBrush: {
        ...state.healingBrush,
        ...updates,
      },
    }));
  },

  setCloneSource: (source) => {
    set({ cloneSource: source });
  },

  addHealingOp: (op) => {
    set((state) => ({
      healingOps: [...state.healingOps, op],
    }));
  },

  removeHealingOp: (id) => {
    set((state) => ({
      healingOps: state.healingOps.filter((op) => op.id !== id),
    }));
  },

  clearHealingOps: () => {
    set({ healingOps: [], cloneSource: null });
  },

  setHealingOps: (ops) => {
    set({ healingOps: ops });
  },

  resetHealing: () => {
    set({
      healingMode: DEFAULT_HEALING_EDITS.mode,
      healingBrush: { ...DEFAULT_HEALING_BRUSH },
      healingOps: [],
      cloneSource: null,
    });
  },
}));

export function getHealingEditsSnapshot(params: {
  healingMode: HealingMode;
  healingBrush: HealingBrushSettings;
  healingOps: HealingOp[];
  cloneSource: Point | null;
}): HealingEdits {
  return {
    version: 1,
    mode: params.healingMode,
    brush: params.healingBrush,
    ops: params.healingOps,
    cloneSource: params.cloneSource,
  };
}
