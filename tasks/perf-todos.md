# Performance TODOs (Snappy editor + future RAW)

Goal: Lightroom/Photoshop-style interactivity (no UI jank), with an architecture that scales to large images and RAW.

## Phase 1 — Snappy v1 (biggest UX wins first)

### 1) Baseline + perf budgets
- [ ] Define performance budgets (pan/zoom/rotate <= 16ms/frame; slider preview <= 50–100ms; refine <= 250ms idle)
- [ ] Add lightweight instrumentation for canvas render time + pipeline time + per-processor time
- [ ] Add a dev-only “perf HUD” toggle (FPS, last render ms, last pipeline ms)

### 2) Decouple camera transforms from pixel processing
- [ ] Refactor `src/editor/EditorCanvas.tsx` cache keys into `cameraKey` vs `editsKey`
- [ ] Ensure pan/zoom/rotate only does `drawImage` from a processed source (no pixel pipeline)
- [ ] Run pixel pipeline only when edits change (WB/light/tone/color/denoise/sharpen)
- [ ] Keep rotation as a view transform (apply at draw time), verify crop overlay math stays correct
- [ ] Acceptance: pan/zoom/rotate triggers zero `getImageData`/`putImageData` calls

### 3) Make the CPU pipeline cheaper immediately
- [ ] Remove per-run sorting in `src/editor/pixel-pipeline/pipeline.ts`
- [ ] Replace full-buffer copies between processors with ping-pong buffers (swap refs, avoid `.set()` per stage)
- [ ] Keep test coverage intact (pipeline output identical)

### 4) Progressive rendering (interactive vs final)
- [ ] Add an interaction signal (slider drag start/end) to drive quality selection
- [ ] Implement quality ladder: reduced-res preview while interacting, full-res refine after idle
- [ ] Coalesce rapid updates (debounce/cancel refine while still interacting)
- [ ] Acceptance: slider drag remains responsive even with denoise/sharpen enabled

### 5) Reduce unnecessary re-renders/scheduling from state
- [ ] Replace 6 independent store subscriptions in `src/editor/EditorCanvas.tsx` with one edits selector
- [ ] Ensure stable equality for edits slices (avoid rerenders on identity-only changes)
- [ ] Separate “camera state” from “edits state” in scheduling logic

## Phase 2 — Scalable architecture (large images, background work)

### 6) Worker-based pipeline execution with cancellation
- [ ] Add a Worker pipeline executor module (input pixels/bitmap + edits, output processed pixels/bitmap)
- [ ] Implement “latest job wins” via monotonic `jobId` (ignore stale responses)
- [ ] Choose transport strategy (prefer `ImageBitmap` in/out; fallback to transferable `ArrayBuffer`)
- [ ] Move processor caches into the worker (tone curve LUT cache, denoise/sharpen buffers)
- [ ] Acceptance: no long tasks on main thread during heavy edits

### 7) Allocation + derived-data caching
- [ ] Replace tone-curve `JSON.stringify` cache key with a store-backed `toneCurveRevision`
- [ ] Cache gaussian kernels by quantized sigma (shared between runs/jobs)
- [ ] Audit and reduce typed-array allocations in export path (`src/export-download.ts`) by reusing buffers

### 8) Event handler stability (interaction hot paths)
- [ ] Refactor `src/use-canvas-zoom-pan.ts` to use stable listeners + refs for latest state
- [ ] Ensure wheel/pan handlers aren’t recreated on every zoom/offset change

## Phase 3 — RAW-ready + tile/mip pipeline + optional GPU

### 9) Pyramid + tiling rendering pipeline
- [ ] Write a short design doc: tile size, overlap strategy, cache eviction, scheduling priorities
- [ ] Implement mip pyramid generation (on-demand, in worker)
- [ ] Implement visible-tile computation from camera transform
- [ ] Process only visible tiles at appropriate mip; refine higher-res tiles progressively
- [ ] Acceptance: large images remain interactive; viewport refines progressively

### 10) RAW pipeline foundations
- [ ] Define internal color pipeline contract (linear-light working space vs display-referred output)
- [ ] Add high-precision internal buffers (Float32) for RAW/large pipeline stages
- [ ] Add tone-mapping/display transform step at the end (8-bit output only at display/export)

### 11) GPU acceleration track (optional but likely)
- [ ] Prototype GPU path (WebGL2/WebGPU) for WB/light/tone curve/color in preview
- [ ] Keep CPU fallback path with matching processor semantics
- [ ] Establish parity tests (CPU vs GPU outputs within tolerance)
