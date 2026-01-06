import type { PixelProcessor } from "./processor";
import type { PipelineBuffers, PixelPipelineContext } from "./types";

export function createDefaultPipeline(): Array<PixelProcessor> {
  return [];
}

export function runPipeline(
  processors: ReadonlyArray<PixelProcessor>,
  buffers: PipelineBuffers,
  context: PixelPipelineContext,
): void {
  const sorted = [...processors].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );

  for (const processor of sorted) {
    if (!processor.isEnabled(context)) {
      continue;
    }

    processor.apply(buffers, context);

    // Normalize so next processor reads from `out`.
    buffers.in = buffers.out;
  }
}
