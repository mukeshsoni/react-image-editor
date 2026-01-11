import { create } from "zustand";

export type PerspectiveSettings = {
  vertical: number;
  horizontal: number;
  aspect?: number;
};

export type LensCorrectionsSettings = {
  distortion: number;
  chromaticAberration: boolean;
};

export type OpticsSettings = {
  vignette: number;
  grain: number;
  dehaze: number;
};

export type GeometryOpticsSettings = {
  perspective: PerspectiveSettings;
  lensCorrections: LensCorrectionsSettings;
  optics: OpticsSettings;
};

export const DEFAULT_GEOMETRY_OPTICS: GeometryOpticsSettings = {
  perspective: {
    vertical: 0,
    horizontal: 0,
    aspect: 0,
  },
  lensCorrections: {
    distortion: 0,
    chromaticAberration: false,
  },
  optics: {
    vignette: 0,
    grain: 0,
    dehaze: 0,
  },
};

type GeometryOpticsStore = {
  settings: GeometryOpticsSettings;

  setSettings: (settings: GeometryOpticsSettings) => void;
  setPerspective: (updates: Partial<PerspectiveSettings>) => void;
  resetPerspective: () => void;

  setLensCorrections: (updates: Partial<LensCorrectionsSettings>) => void;
  setOptics: (updates: Partial<OpticsSettings>) => void;

  resetGeometryOptics: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSettings(settings: GeometryOpticsSettings): GeometryOpticsSettings {
  return {
    ...settings,
    perspective: {
      vertical: clamp(settings.perspective.vertical, -100, 100),
      horizontal: clamp(settings.perspective.horizontal, -100, 100),
      aspect: clamp(settings.perspective.aspect ?? 0, -100, 100),
    },
    lensCorrections: {
      distortion: clamp(settings.lensCorrections.distortion, -100, 100),
      chromaticAberration: Boolean(settings.lensCorrections.chromaticAberration),
    },
    optics: {
      vignette: clamp(settings.optics.vignette, -100, 100),
      grain: clamp(settings.optics.grain, 0, 100),
      dehaze: clamp(settings.optics.dehaze, -100, 100),
    },
  };
}

export const useGeometryOpticsStore = create<GeometryOpticsStore>((set) => ({
  settings: { ...DEFAULT_GEOMETRY_OPTICS },

  setSettings: (settings) => {
    set({ settings: normalizeSettings(settings) });
  },

  setPerspective: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        perspective: {
          ...state.settings.perspective,
          ...updates,
          vertical: clamp(
            updates.vertical ?? state.settings.perspective.vertical,
            -100,
            100,
          ),
          horizontal: clamp(
            updates.horizontal ?? state.settings.perspective.horizontal,
            -100,
            100,
          ),
          aspect: clamp(updates.aspect ?? state.settings.perspective.aspect ?? 0, -100, 100),
        },
      },
    }));
  },

  resetPerspective: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        perspective: { ...DEFAULT_GEOMETRY_OPTICS.perspective },
      },
    }));
  },

  setLensCorrections: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        lensCorrections: {
          ...state.settings.lensCorrections,
          ...updates,
          distortion: clamp(
            updates.distortion ?? state.settings.lensCorrections.distortion,
            -100,
            100,
          ),
          chromaticAberration: Boolean(
            updates.chromaticAberration ?? state.settings.lensCorrections.chromaticAberration,
          ),
        },
      },
    }));
  },

  setOptics: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        optics: {
          ...state.settings.optics,
          ...updates,
          vignette: clamp(updates.vignette ?? state.settings.optics.vignette, -100, 100),
          grain: clamp(updates.grain ?? state.settings.optics.grain, 0, 100),
          dehaze: clamp(updates.dehaze ?? state.settings.optics.dehaze, -100, 100),
        },
      },
    }));
  },

  resetGeometryOptics: () => {
    set({ settings: { ...DEFAULT_GEOMETRY_OPTICS } });
  },
}));
