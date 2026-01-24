# AGENTS.md (react-image-editor)

This file is for agentic coding assistants operating in this repo.
Keep changes minimal, follow existing patterns, and prefer fixing root causes.

## Project summary
- React 19 + Vite 6 + TypeScript
- Canvas-based image editor (zoom/pan/crop)
- State: Zustand (`src/store/cropStore.ts`)
- UI: Tailwind CSS v4 + shadcn/ui components (`src/components/ui/*`)
- Tests: Vitest + Testing Library (jsdom)
- Lint: ESLint 9 + typescript-eslint + react-compiler rule enabled

## Repo layout
- `src/` main app code
  - `src/App.tsx` Vite app shell
  - `src/ReactImageEditor.tsx` canvas renderer + main editor UI
  - `src/Cropper.tsx` crop overlay UI + crop options
  - `src/use-canvas-zoom-pan.ts` zoom/pan logic hook
  - `src/store/cropStore.ts` Zustand store + geometry helpers
  - `src/__tests__/` Vitest tests
  - `src/lib/utils.ts` `cn()` helper (tailwind-merge + clsx)

## Commands (npm)

### Install
- `npm ci` (preferred in CI / clean install)
- `npm install` (local dev)

### Dev / build
- `npm run dev` start Vite dev server
- `npm run build` production build
- `npm run preview` preview production build locally

### Lint
- `npm run lint` lint all files
- `npx eslint . --fix` auto-fix where possible
- `npx eslint "src/**/*.ts" "src/**/*.tsx"` lint a subset
- `npx eslint src/ReactImageEditor.tsx --fix` lint a single file

Notes:
- ESLint includes `react-compiler/react-compiler` as an **error**.
- `@typescript-eslint/no-unused-vars` is enforced (base `no-unused-vars` is off).

### Test (Vitest)
- `npm test` start Vitest in watch mode
- `npx vitest run` run tests once (CI-style)

Run a single test file:
- `npm test -- src/__tests__/Cropper.test.tsx`
- `npx vitest run src/__tests__/Cropper.test.tsx`

Run a single test by name (substring match):
- `npm test -- -t "renders crop area"`
- `npx vitest run -t "renders crop area"`

Update snapshots (if added later):
- `npx vitest -u`

## Cursor / Copilot rules
- No Cursor rules found (`.cursor/rules/` or `.cursorrules`).
- No Copilot instructions found (`.github/copilot-instructions.md`).

If any of the above appear later, incorporate them here.

## Code style & conventions

### General principles
- Match the style of the file you are editing; don’t reformat unrelated code.
- Prefer small, well-scoped PRs: keep diffs tight and intentional.
- Keep logic readable: short helpers > deeply nested blocks.

### Formatting
- ESLint is the source of truth; run `npm run lint` (or `eslint --fix`) when in doubt.
- Use trailing commas where the surrounding file uses them.
- Don’t introduce a new formatter configuration (Prettier) unless asked.

### Imports
Prefer this grouping (top to bottom), with a blank line between groups:
1. React imports (`react`) and type-only imports from React
2. External libraries (radix, zustand, etc.)
3. Internal absolute imports via `@/…`
4. Relative imports (`./…`, `../…`)

Rules of thumb:
- Use type-only imports: `import type { Bounds } from "../store/cropStore";`
- When importing both value and types, split or inline `type` as used in the repo.
- Use `@/*` alias for `src/*` (see `vite.config.ts` and `tsconfig.json`).

### Naming
- Components: `PascalCase` (files and exports), e.g. `Cropper`, `ReactImageEditor`.
- Hooks: `use-*` file name and `useXxx` export, e.g. `use-canvas-zoom-pan.ts`.
- Functions/vars: `camelCase`.
- Types: `PascalCase` (`CropRect`, `CropSettings`, `Bounds`).
- Constants: `SCREAMING_SNAKE_CASE` for true constants, or `camelCase` when local.

### TypeScript
- Avoid `any`. If you must, justify it and localize it.
- Prefer explicit types at module boundaries:
  - exported functions
  - component props
  - store state/actions
- Use discriminated unions / literal unions where appropriate (example: crop handles).
- Prefer `as const` for fixed literal arrays (example: handles list in `src/Cropper.tsx`).

### React (React 19 + React Compiler)
This repo enables the React Compiler ESLint rule:
- Keep components/hooks “compiler-friendly”:
  - don’t call hooks conditionally
  - don’t mutate props/state objects in place
  - avoid side effects during render
  - keep derived values in `useMemo` only when needed; prefer simple derivations
- Prefer `useRef` for mutable, non-render state (canvas context, animation frame ids).
- Cancel scheduled work in effects where applicable (e.g., `cancelAnimationFrame`).

### Zustand store usage
- Keep store state serializable and minimal.
- Prefer store actions for state transitions (avoid ad-hoc mutations outside the store).
- When adding store fields, update:
  - initial state
  - action interfaces
  - any reset helpers (`resetAll`, `resetCropSettings`, etc.)

### Canvas / geometry code
- Guard DOM APIs:
  - `if (!canvasRef) return;`
  - `const ctx = canvas.getContext("2d"); if (!ctx) return;`
- Prefer early returns over nested `if` ladders.
- Avoid doing expensive work on every render; use refs/effects/requestAnimationFrame.

### Error handling
- UI code: prefer graceful no-ops + clear guards (null refs, missing image, etc.).
- Parsing/user input (e.g., aspect ratio strings): validate and fall back safely.
- Don’t swallow errors silently if they indicate a real bug; prefer throwing only in
  non-UI utility boundaries or tests.

## Testing guidelines
- Test runner: Vitest.
- UI testing: `@testing-library/react`.

Patterns used in this repo:
- Prefer `describe/test/expect` from `vitest`.
- Use `data-testid` for stable selectors (`crop-region`, `crop-handle-*`).
- Mock Zustand stores with `vi.mock("../store/cropStore", () => ({ … }))`.
- Clean up after tests: `cleanup()` in `afterEach`.

When adding tests:
- Place them in `src/__tests__/`.
- Name files `*.test.ts` or `*.test.tsx`.
- Test behavior (DOM output / interactions) instead of implementation details.

## Suggested workflow for agents
1. Identify the smallest correct change.
2. Update/add tests when behavior changes.
3. Run `npm run lint` and the narrowest `vitest` command relevant.
4. Avoid unrelated refactors and formatting churn.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
