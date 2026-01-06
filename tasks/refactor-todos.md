# Refactor (Merge-Conflict Reduction) — Task Checklist

Goal: reduce merge conflicts when multiple roadmap features land in parallel.

Context:
- `src/ReactImageEditor.tsx` is currently a large “god component” (canvas + tools + sidebar UI).
- `src/store/cropStore.ts` is a monolithic store containing multiple feature domains.

## 1) Split `ReactImageEditor` into modules
- [x] Create `src/editor/` folder (or similar) for editor modules
- [x] Extract canvas rendering concerns into `EditorCanvas` (preview canvas + listeners + RAF scheduling)
- [x] Extract crop concerns into `CropTool` (crop overlay + apply/reset)
- [x] Extract export concerns into `ExportTool` (format/quality/download UI + download handler)
- [x] Extract sidebar panels into dedicated components:
  - [x] `WhiteBalancePanel`
  - [x] `LightPanel`
  - [x] `ColorPanel`
  - [x] `ToneCurvePanel`
- [x] Keep `src/ReactImageEditor.tsx` as a thin shell: layout + composition only

## 2) Introduce a panel registry (avoid everyone editing the same sidebar JSX)
- [x] Define a `PanelDefinition` contract (e.g. `{ id, order, title, Component }`)
- [x] Option A (simple): central `src/editor/panels/index.ts` exports ordered panel array
- [x] Option B (best for parallel PRs): auto-discover panels via Vite `import.meta.glob`
- [x] Render sidebar from the registry list (sorted by `order`)
- [x] Ensure each new feature can add a panel by adding a new file only

## 3) Extract a pixel processing pipeline (avoid everyone editing `renderImageToCanvas`)
- [x] Create `src/editor/pixel-pipeline/` module
- [x] Define `PixelProcessor` interface (name/id, enabled check, apply function)
- [x] Move current steps into per-feature processors:
  - [x] White balance processor
  - [x] Light adjustments processor
  - [x] Tone curve processor
  - [x] Color adjustments processor
- [x] Implement `runPipeline()` that applies processors in a stable order
- [x] Decide how cache/buffer reuse is owned:
  - [x] Pipeline-level shared buffers
  - [x] Or processor-owned caches
- [x] Optional: auto-discover processors via `import.meta.glob` to reduce central edits

## 4) Split Zustand store by domain (avoid conflicts in `src/store/cropStore.ts`)
- [x] Choose approach:
  - [ ] Slice composition (one store, multiple slice files)
  - [x] Multiple stores (one store per feature domain)
- [ ] If using slices:
  - [ ] Create `src/store/slices/` (e.g. `cropSlice`, `whiteBalanceSlice`, `lightSlice`, `colorSlice`, `toneCurveSlice`)
  - [ ] Keep types/defaults/actions close to each slice
  - [ ] Compose slices in a small `src/store/editorStore.ts`
  - [ ] Migrate `src/store/cropStore.ts` gradually (keep API stable where possible)


## 5) Make “reset” and “edits snapshot” feature-owned
- [ ] Replace a single central `resetAll` that must be edited by every feature
- [ ] Each slice/store exports:
  - [ ] `reset()`
  - [ ] `selectEdits()` (or similar) for export/download/history
- [ ] Add an aggregator helper that:
  - [ ] Calls all resets
  - [ ] Merges all edits into an `ImageEditorEdits` snapshot

## 6) Reduce top-level store destructuring in the editor shell
- [ ] Move feature-specific selectors/actions into their feature components
- [ ] Ensure `src/ReactImageEditor.tsx` doesn’t grow a giant `useCropStore()` destructure list

## 7) Testing / verification
- [x] Keep existing tests passing after each extraction step
- [x] Add/adjust component tests if selectors or component boundaries change
- [x] Run `npx vitest run` and `npm run lint` after refactor milestones
