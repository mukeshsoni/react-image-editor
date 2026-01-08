# PRD: RAW File Support

## Summary
Add support for importing common camera RAW formats (CR2, NEF, DNG, ARW, RAF, ORF, RW2, etc.) so photographers can edit RAW photos in the editor.

This PRD focuses on **client-side decoding** (no server upload) and integrating the decoded image into the existing editing pipeline (zoom/pan/crop/rotation now; future tone/color controls later).

## Context
Today the editor primarily assumes browser-decodable image formats (JPEG/PNG/WebP). RAW files cannot be opened directly in the browser, which blocks professional photography workflows.

`ROADMAP.md` lists RAW support as a medium-priority backlog item and suggests libraries like `libraw-js` or `raw.js`.

## Goals
- Users can load a RAW file via the same entry points as other images (file picker / drag-drop, if present).
- RAW files decode **fully in the browser** and show up in the editor as an image.
- Decoding is responsive (runs off the main thread) with clear progress / error UI.
- Prefer correct color/orientation defaults so the initial render “looks right” without adjustments.

## Non-goals (v1)
- Full-featured RAW development controls (white balance picker, highlight recovery, camera profiles).
- Preserving/exporting RAW metadata/EXIF/ICC end-to-end.
- Exporting back to RAW.
- Lens corrections, denoise, sharpening, chromatic aberration correction.
- Perfect parity with Lightroom/Capture One rendering.

## Key product decisions
- **v1 loads the embedded preview when available**, falling back to demosaic only when necessary.
  - Rationale: preview extraction is much faster, more consistent, and reduces CPU/memory pressure.
- RAW import becomes a new “decode step” that produces an RGBA bitmap (or a JPEG blob) and then the rest of the app operates on a normal raster image.
  - This keeps the editor architecture simple and defers a fully non-destructive RAW pipeline to a later phase.

## User stories
1. As a photographer, I can open a `.CR2`/`.NEF`/`.DNG`/`.ARW` file and see it in the editor.
2. As a user, I get a clear message if a RAW file is unsupported or fails to decode.
3. As a user, the editor stays responsive while the RAW file is decoding.
4. As a user, I see a sensible default orientation (no sideways images).

## UX requirements

### Entry points
- File picker should allow RAW extensions in addition to current formats.
- If drag-and-drop exists, dropping RAW should behave like dropping JPEG.

### Loading states
- When a RAW file is selected:
  - Show a blocking “Decoding RAW…” state (spinner + optional progress %).
  - Disable edit actions until decode completes.

### Errors
- If decode fails:
  - Show a clear error with the filename and a short reason.
  - Provide an action to “Try again” or “Choose another file”.

### Optional (nice-to-have)
- A small badge in the UI that the current image came from a RAW source (e.g., `RAW`), since the rendering may differ from in-camera JPEG.

## Functional requirements

### Supported formats (target)
- At minimum: `DNG`, `CR2`, `NEF`, `ARW`.
- Stretch: `RAF`, `ORF`, `RW2`, `CR3` (if the chosen library supports it).

### Output
RAW decoding must result in one of:
- A decoded RGBA pixel buffer that can be drawn to canvas, OR
- A JPEG/PNG preview blob that can be loaded into an `<img>`.

### Orientation
- Apply EXIF orientation (or equivalent RAW metadata) so the initial display matches the camera intent.

### Size constraints / safeguards
- Establish a v1 maximum decode output dimension (e.g., longest edge <= `8000px`) to avoid tab crashes on extremely large files.
  - If exceeded, show a warning and offer “Decode at reduced resolution”.

## Technical approach

### Library choice (proposal)
Evaluate one of:
- `libraw.js` / `libraw-js` (WASM binding to LibRaw)
- `raw.js`

Selection criteria:
- Browser-only decoding (no native dependencies)
- Wide camera support and active maintenance
- Ability to extract embedded preview
- Ability to demosaic to RGB(A) when needed

### Decode pipeline
1. Detect RAW based on file extension and/or magic bytes.
2. Send the `File` (as `ArrayBuffer`) to a **Web Worker**.
3. Worker attempts:
   - Extract embedded JPEG preview (preferred)
   - Else demosaic RAW to RGBA
4. Worker returns:
   - `type: "preview"` + `blob` (JPEG) and basic metadata, OR
   - `type: "rgba"` + `width/height` + `Uint8ClampedArray` and metadata
5. Main thread:
   - If preview: create object URL and load as the current image
   - If rgba: render into an offscreen canvas and convert to a PNG/JPEG blob, then load as the current image

### Worker + memory considerations
- Use transferable objects (`ArrayBuffer`) between main thread and worker.
- Avoid duplicating full pixel buffers when possible.
- Consider chunked progress updates if the library supports it (otherwise an indeterminate spinner).

### Integration points (proposal)
- Add a small import layer (e.g., `src/lib/import-image.ts`) that normalizes:
  - Browser-supported images → current code path
  - RAW images → decode pipeline → normalized raster result

### Color management (v1)
- Use sRGB output by default.
- If the library exposes camera color matrices/profiles, defer to v2 unless there’s a low-effort “reasonable default”.

## Security & privacy
- RAW files are processed locally in the browser only.
- No network upload is performed.

## Acceptance criteria
- Selecting a supported RAW file successfully displays the image in the editor.
- Decoding runs off the main thread (no sustained UI freeze).
- Unsupported RAW files show a clear error state.
- Orientation is applied correctly for common rotated images.
- Existing editing actions (zoom/pan/crop/rotation) work on decoded RAW images.

## Testing plan
- Unit tests:
  - RAW file detection (extension/magic) and dispatch to decode pipeline.
  - Worker message contract: success/error shapes.
- Component/integration tests (Vitest + Testing Library):
  - Mock the worker to return a preview blob and assert the editor loads an image.
  - Mock the worker to return RGBA and assert the editor generates a blob and loads it.
  - Error path renders the correct message and allows retry.

## Rollout plan (phased)
- Phase 1 (v1): embedded preview extraction + worker integration + UI states.
- Phase 2 (v1.5): demosaic fallback (only when preview missing) and size safeguards.
- Phase 3 (v2): true RAW development controls (WB/exposure/highlight/shadow), camera profiles, better color.

## Open questions
- Do we want to treat preview extraction as “good enough” for v1, or require demosaic support from day one?
- What’s the desired max supported RAW file size / output resolution for the web app?
- Should RAW decoding settings be user-configurable (e.g., “use camera WB”) in v1, or hard-coded defaults?
- Do we need to surface basic metadata (camera model, ISO, shutter, aperture) alongside the image?


### Extra info about RAW processing

RAW “editing” in the browser is possible, but the browser can’t decode RAWs natively. You need a decoder (usually WASM) plus an image pipeline for tone/color work.
What’s possible in-browser (realistically)
- Fast path (common v1): extract and display the embedded JPEG preview from the RAW. This is quick and looks like the camera’s JPEG, but it’s not true RAW development.
- True RAW path (heavier): parse + demosaic the sensor data into RGB, then apply WB/exposure/tone curve in (ideally) linear/high bit depth.
Libraries that help
RAW decoding / demosaic
- LibRaw via WebAssembly (often exposed as libraw.js / libraw-wasm / similar community wrappers): most capable option; supports many camera formats.
- raw.js: exists, but tends to be narrower / less full-featured than LibRaw-based approaches (worth evaluating, but LibRaw is usually the serious path).
Metadata / orientation helpers
- exifr (or similar): reads EXIF, including orientation, dates, camera info; can also help locate embedded previews in some cases (format-dependent).
Things you need to worry about (the big gotchas)
- Performance & UI freezing: demosaic is CPU-heavy; do it in a Web Worker (or WASM worker). For big files, decoding on the main thread will feel broken.
- Memory pressure: RAWs are huge. A 6000×4000 RGBA buffer is ~96MB uncompressed (plus working buffers). It’s easy to crash tabs, especially on mobile.
- Bit depth and quality: Canvas 2D is effectively 8-bit for many operations. “Real” RAW development wants 16-bit or float processing (WebGL/WebGPU helps a lot here).
- Color management: “Why doesn’t it match Lightroom?” is mainly:
  - camera color matrices/profiles
  - tone curves and highlight handling
  - working space (linear vs gamma)
  - display color management (ICC)
- White balance & exposure math: RAW needs WB/exposure before/while demosaicing (or at least in linear space), otherwise results look off.
- Orientation & metadata quirks: EXIF orientation, maker notes, different preview locations per vendor.
- Threads / SIMD / SharedArrayBuffer: high-perf WASM often benefits from threads; that may require cross-origin isolation headers (COOP/COEP).
- Format coverage: DNG is usually best-supported; CR2/NEF/ARW often OK; CR3 can be tricky depending on decoder support.
- Licensing/compliance: LibRaw is copyleft (LGPL-style). Using it via WASM still has obligations—worth checking before committing.
