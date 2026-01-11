import type { PipelineBuffers, PixelPipelineContext } from "./types";

export type PixelProcessorId =
  | "healing"
  | "white-balance"
  | "light"
  | "tone-curve"
  | "color"
  | "perspective-warp"
  | "geometry-optics"
  | "denoise"
  | "sharpening";

export type PixelProcessor = {
  id: PixelProcessorId;
  order: number;
  isEnabled: (context: PixelPipelineContext) => boolean;
  apply: (buffers: PipelineBuffers, context: PixelPipelineContext) => void;
};
