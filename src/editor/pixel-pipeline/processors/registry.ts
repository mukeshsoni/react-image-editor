import type { PixelProcessor } from "../processor";

type ProcessorModule = {
  processor: PixelProcessor;
};

const processorModules = import.meta.glob<ProcessorModule>("./*.processor.ts", {
  eager: true,
});

export function getProcessorRegistry(): PixelProcessor[] {
  return Object.values(processorModules)
    .map((module) => module.processor)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
