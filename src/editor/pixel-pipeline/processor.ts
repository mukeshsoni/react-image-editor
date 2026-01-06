import type { PipelineBuffers, PixelPipelineContext } from "./types";

export type PixelProcessor = {
  id: string;
  order: number;
  isEnabled: (context: PixelPipelineContext) => boolean;
  apply: (buffers: PipelineBuffers, context: PixelPipelineContext) => void;
};
