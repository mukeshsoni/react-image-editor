# Refactor (Merge-Conflict Reduction) — Task Checklist

Goal: reduce merge conflicts when multiple roadmap features land in parallel.

Context:
- `src/ReactImageEditor.tsx` is currently a large “god component” (canvas + tools + sidebar UI).
- `src/store/cropStore.ts` is a monolithic store containing multiple feature domains.

## 1) Split `ReactImageEditor` into modules
- [ ] Create `src/editor/` folder (or similar) for editor modules
- [ ] Extract canvas rendering concerns into `EditorCanvas` (preview canvas + listeners + RAF scheduling)
- [ ] Extract crop concerns into `CropTool` (crop overlay + apply/reset)
- [ ] Extract export concerns into `ExportTool` (format/quality/download UI + download handler)
- [ ] Extract sidebar panels into dedicated components:
  - [ ] `WhiteBalancePanel`
  - [ ] `LightPanel`
  - [ ] `ColorPanel`
  - [ ] `ToneCurvePanel`
- [ ] Keep `src/ReactImageEditor.tsx` as a thin shell: layout + composition only

## 2) Introduce a panel registry (avoid everyone editing the same sidebar JSX)
- [ ] Define a `PanelDefinition` contract (e.g. `{ id, order, title, Component }`)
- [ ] Option A (simple): central `src/editor/panels/index.ts` exports ordered panel array
- [ ] Option B (best for parallel PRs): auto-discover panels via Vite `import.meta.glob`
- [ ] Render sidebar from the registry list (sorted by `order`)
- [ ] Ensure each new feature can add a panel by adding a new file only

## 3) Extract a pixel processing pipeline (avoid everyone editing `renderImageToCanvas`)
- [ ] Create `src/editor/pixel-pipeline/` module
- [ ] Define `PixelProcessor` interface (name/id, enabled check, apply function)
- [ ] Move current steps into per-feature processors:
  - [ ] White balance processor
  - [ ] Light adjustments processor
  - [ ] Tone curve processor
  - [ ] Color adjustments processor
- [ ] Implement `runPipeline()` that applies processors in a stable order
- [ ] Decide how cache/buffer reuse is owned:
  - [ ] Pipeline-level shared buffers
  - [ ] Or processor-owned caches
- [ ] Optional: auto-discover processors via `import.meta.glob` to reduce central edits

## 4) Split Zustand store by domain (avoid conflicts in `src/store/cropStore.ts`)
- [ ] Choose approach:
  - [ ] Slice composition (one store, multiple slice files)
  - [ ] Multiple stores (one store per feature domain)
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
- [ ] Keep existing tests passing after each extraction step
- [ ] Add/adjust component tests if selectors or component boundaries change
- [ ] Run `npx vitest run` and `npm run lint` after refactor milestones
