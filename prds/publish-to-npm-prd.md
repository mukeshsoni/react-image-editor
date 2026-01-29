# Publish @mukeshsoni/react-image-editor to npm

## Goal
Publish this repo as a reusable React component library on npm under `@mukeshsoni/react-image-editor`.

Constraints / decisions already made:
- ESM-only build
- Tailwind is required in the consuming app (no precompiled CSS bundle)
- Public API: component-only
- License: MIT

## Current Gaps (from repo exploration)
- `package.json` is app-shaped: `private: true`, `version: 0.0.0`, missing `exports`, `types`, `files`, `publishConfig`, etc.
- No library entrypoint (`src/index.ts`) for consumers.
- Vite config builds a demo app only; no library-mode build output.
- TS config uses `noEmit: true`; no `.d.ts` generation.
- `src/ReactImageEditor.tsx` uses `import("@/...")` types in exported props; this will leak Vite path aliases into generated `.d.ts`.
- Missing `LICENSE` file.
- README install/import instructions target unscoped `react-image-editor` and claim “prebuilt CSS bundle shipped”, which conflicts with the chosen CSS strategy.

## Open Decision
Resolved: ship `styles.css` (Tailwind directives + theme tokens) and document `import "@mukeshsoni/react-image-editor/styles.css";` at app entry.

## Plan

### 1) Define package public API
- Add `src/index.ts` as the ONLY supported entrypoint.
- Export:
  - `ReactImageEditor`
  - Types required by the component signature (at minimum `ImageEditorEdits`; likely also `ThemeMode` since it appears in props)
- Do not export internal stores, panels, hooks, or shadcn primitives.

Files:
- Add: `src/index.ts`

### 2) Make exported types alias-free
- Update `src/ReactImageEditor.tsx` props type definitions to use real `import type ... from "./..."` (relative imports), not `import("@/...")`.
- Goal: generated `dist/index.d.ts` must not contain `@/` path aliases.

Files:
- Update: `src/ReactImageEditor.tsx`

### 3) Add a library build (Vite lib mode)
- Create a dedicated library Vite config to avoid breaking the demo app build.
- Configure:
  - entry: `src/index.ts`
  - formats: `es`
  - output dir: `dist/`
  - externalize: `react`, `react-dom`, `react/jsx-runtime`
  - generate sourcemaps

Files:
- Add: `vite.lib.config.ts` (or modify `vite.config.ts` with a `mode === "lib"` branch)

### 4) Generate TypeScript declarations
- Add `tsconfig.lib.json` that:
  - `emitDeclarationOnly: true`, `declaration: true`
  - `outDir: "dist"`, `rootDir: "src"`
  - excludes: demo entrypoints (`src/main.tsx`, `src/App.tsx`), tests (`src/__tests__/**`)
- Add an npm script to run this for packaging.

Files:
- Add: `tsconfig.lib.json`

### 5) Package metadata for npm publish
- Update `package.json` for library publishing:
  - `name`: `@mukeshsoni/react-image-editor`
  - remove `private: true`
  - set a real `version` (e.g. `0.1.0` for first publish)
  - add `license: "MIT"`
  - add `description`, `keywords`, and optionally `repository/homepage/bugs`
  - `peerDependencies`: `react`, `react-dom`, `tailwindcss`
  - keep `react` + `react-dom` also in `devDependencies` for local dev
  - move `tailwindcss` from `dependencies` to `peerDependencies` (and keep it in `devDependencies`)
  - move `@types/testing-library__jest-dom` to `devDependencies`
  - add `exports` map (ESM-only) and `types`
  - add `files` allowlist to control what is published
  - add `publishConfig.access = "public"` (required for scoped public packages)
  - add scripts:
    - `build:lib` (vite lib build)
    - `build:types` (tsc dts build)
    - `prepack` (runs `build:lib` + `build:types` so `npm pack`/publish always produces dist)

Files:
- Update: `package.json`

### 6) Add license
- Add MIT license file at repo root.

Files:
- Add: `LICENSE`

### 7) README updates for consumer setup
- Update install/import examples:
  - `npm install @mukeshsoni/react-image-editor`
  - `import { ReactImageEditor } from "@mukeshsoni/react-image-editor";`
- Document Tailwind requirement and host setup:
  - Ensure Tailwind scans package output in `node_modules/@mukeshsoni/react-image-editor/dist/**/*.js`
  - Provide a snippet for `tailwind.config.{js,ts}` `content` (or Tailwind v4 equivalent)
- Replace the “prebuilt CSS bundle shipped” guidance with the chosen strategy (see Open Decision).
- Add explicit one-liner style import:
  - `import "@mukeshsoni/react-image-editor/styles.css";`

Files:
- Update: `README.md`

## Recommended `exports` shape (ESM-only)
- In `package.json`:
  - `exports["."]` => `dist/index.js` + `dist/index.d.ts`
  - Stylesheet: `exports["./styles.css"]` => `./styles.css`

## Verification

### Local quality gates
- `npm run lint`
- `npx vitest run`

### Package correctness
- `npm run build:lib` and `npm run build:types`
- Confirm `dist/index.d.ts` contains no `@/` specifiers.
- `npm pack` and inspect tarball contents:
  - only `dist/`, `README.md`, `LICENSE`, and (optionally) `styles.css`
  - Ensure `styles.css` is present

### Real consumer test (most important)
- Create a fresh Vite React + TS app.
- Configure Tailwind.
- Install the packed tarball.
- Add Tailwind scanning for `node_modules/@mukeshsoni/react-image-editor/dist/**/*.js`.
- Import and render `ReactImageEditor`.
- Confirm styling renders as expected (tokens + dark mode behavior).

## Publish
- Ensure you are logged in: `npm login`
- Publish scoped public package:
  - `npm publish --access public`
