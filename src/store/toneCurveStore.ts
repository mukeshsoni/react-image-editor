import { create } from "zustand";

import type {
  CurvePoint,
  ToneCurveChannel,
  ToneCurveParametricSettings,
  ToneCurveSettings,
} from "./cropStore";

const DEFAULT_TONE_CURVE: ToneCurveSettings = {
  mode: "point",
  activeChannel: "rgb",
  point: {
    rgb: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    r: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    g: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    b: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  parametric: {
    rgb: {
      highlights: 0,
      lights: 0,
      darks: 0,
      shadows: 0,
    },
  },
};

function cloneDefaultToneCurve(): ToneCurveSettings {
  return {
    mode: DEFAULT_TONE_CURVE.mode,
    activeChannel: DEFAULT_TONE_CURVE.activeChannel,
    point: {
      rgb: DEFAULT_TONE_CURVE.point.rgb.map((point) => ({ ...point })),
      r: DEFAULT_TONE_CURVE.point.r.map((point) => ({ ...point })),
      g: DEFAULT_TONE_CURVE.point.g.map((point) => ({ ...point })),
      b: DEFAULT_TONE_CURVE.point.b.map((point) => ({ ...point })),
    },
    parametric: {
      rgb: { ...DEFAULT_TONE_CURVE.parametric.rgb },
    },
  };
}

type ToneCurveStore = {
  toneCurve: ToneCurveSettings;

  setToneCurveMode: (mode: ToneCurveSettings["mode"]) => void;
  setToneCurveChannel: (channel: ToneCurveChannel) => void;
  setToneCurvePoints: (channel: ToneCurveChannel, points: CurvePoint[]) => void;
  setToneCurveParametricRgb: (updates: Partial<ToneCurveParametricSettings>) => void;
  resetToneCurve: () => void;
};

export const useToneCurveStore = create<ToneCurveStore>((set) => ({
  toneCurve: cloneDefaultToneCurve(),

  setToneCurveMode: (mode) => {
    set((state) => ({
      toneCurve: {
        ...state.toneCurve,
        mode,
      },
    }));
  },

  setToneCurveChannel: (channel) => {
    set((state) => ({
      toneCurve: {
        ...state.toneCurve,
        activeChannel: channel,
      },
    }));
  },

  setToneCurvePoints: (channel, points) => {
    set((state) => ({
      toneCurve: {
        ...state.toneCurve,
        point: {
          ...state.toneCurve.point,
          [channel]: points,
        },
      },
    }));
  },

  setToneCurveParametricRgb: (updates) => {
    set((state) => ({
      toneCurve: {
        ...state.toneCurve,
        parametric: {
          ...state.toneCurve.parametric,
          rgb: {
            ...state.toneCurve.parametric.rgb,
            ...updates,
          },
        },
      },
    }));
  },

  resetToneCurve: () => {
    set({ toneCurve: cloneDefaultToneCurve() });
  },
}));
