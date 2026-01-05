export function createMockToneCurve() {
  return {
    mode: "point" as const,
    activeChannel: "rgb" as const,
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
}
