import type { PipelineBuffers, PixelPipelineContext } from "./types";

export type PixelProcessorId =
  | "white-balance"
  | "light"
  | "tone-curve"
  | "color"
  | "sharpening";

export type PixelProcessor = {
  id: PixelProcessorId;
  order: number;
  isEnabled: (context: PixelPipelineContext) => boolean;
  apply: (buffers: PipelineBuffers, context: PixelPipelineContext) => void;
};
