# PR Details: Details Panel — Sharpening

Branch: `sharpening`

## Summary
Adds a new "Details" panel with a "Sharpening" section (Amount/Radius/Detail/Masking) and integrates non-destructive sharpening into both the live preview pipeline and export/download.

## Product Spec
- PRD: `prds/details-sharpening-prd.md`
- Task list: `tasks/details-sharpening-todos.md`

## User-Facing Changes
- New accordion in the right sidebar: **Details**.
- New **Sharpening** section with:
  - Amount (0–150)
  - Radius (0.5–3.0)
  - Detail (0–100)
  - Masking (0–100)
  - Reset button (restores defaults)
- Sharpening is non-destructive (parameters only) and applies immediately.

## Technical Changes

### State
- Introduced `SharpeningSettings` and `DEFAULT_SHARPENING_SETTINGS` in `src/store/cropStore.ts`.
- Added Zustand store `src/store/sharpeningStore.ts`:
  - `sharpening`
  - `setSharpening(partial)`
  - `resetSharpening()`

### Edits snapshot
- Included sharpening in the edits payload so downstream consumers can observe it:
  - `src/store/edits.ts`
  - `src/store/selectEdits.ts`
  - `src/store/subscribeToEdits.ts`

### Preview pipeline
- Added a sharpening processor to the pixel pipeline:
  - `src/editor/pixel-pipeline/processors/sharpening.ts`
  - `src/editor/pixel-pipeline/processors/sharpening.processor.ts`
- Extended pipeline context with dimensions + sharpening settings:
  - `src/editor/pixel-pipeline/types.ts`
- Wired preview rendering to pass sharpening settings and keep existing rAF throttling:
  - `src/editor/EditorCanvas.tsx`

### Export
- Export/download now applies sharpening on the committed image:
  - `src/export-download.ts`
  - `src/editor/ExportTool.tsx`

### Sharpening algorithm
- New helper module: `src/lib/sharpening.ts`
- Current implementation:
  - Luma-based unsharp mask with separable Gaussian blur
  - Alpha preserved
  - Channel clamping
  - Tuned Amount scaling for more visible response

## Test Coverage
Added/updated tests:
- Unit tests for sharpening correctness & safety:
  - `src/__tests__/sharpening.test.ts`
- Deterministic small-buffer tests:
  - `src/__tests__/sharpening.golden.test.ts`
- Component tests for the Details panel UI:
  - `src/__tests__/DetailsPanel.test.tsx`
- Pipeline-level integration coverage:
  - `src/__tests__/pixel-pipeline.sharpening.test.ts`
- Render-path integration coverage (ensures the render pipeline consumes sharpening):
  - `src/__tests__/ReactImageEditor.sharpening-render.test.tsx`

## How To Test (Manual)
1. `npm run dev`
2. Load an image.
3. Open **Details** → **Sharpening**.
4. Increase **Amount** (try 50–150) with Radius ~1.0.
5. Verify preview changes immediately.
6. Click **Reset** and confirm the image returns to baseline.
7. Export via **Download** and confirm exported file matches preview.

## How To Test (Automated)
- `npm run lint`
- `npx vitest run`
- `npm run build`

## Known Limitations / Notes
- CPU-based ImageData processing; large images may be slower depending on hardware.
- Detail/Masking behavior is heuristic and may need tuning across varied photos.
- Denoising is not included in this branch.

## Files Touched (high level)
- UI:
  - `src/editor/DetailsPanel.tsx`
  - `src/editor/panels/details.panel.tsx`
- Store:
  - `src/store/sharpeningStore.ts`
  - `src/store/cropStore.ts`
  - `src/store/edits.ts`
  - `src/store/selectEdits.ts`
  - `src/store/subscribeToEdits.ts`
- Pipeline:
  - `src/editor/pixel-pipeline/types.ts`
  - `src/editor/pixel-pipeline/processor.ts`
  - `src/editor/pixel-pipeline/processors/sharpening.ts`
  - `src/editor/EditorCanvas.tsx`
- Export:
  - `src/export-download.ts`
  - `src/editor/ExportTool.tsx`
- Tests:
  - `src/__tests__/sharpening.test.ts`
  - `src/__tests__/sharpening.golden.test.ts`
  - `src/__tests__/DetailsPanel.test.tsx`
  - `src/__tests__/pixel-pipeline.sharpening.test.ts`
  - `src/__tests__/ReactImageEditor.sharpening-render.test.tsx`
