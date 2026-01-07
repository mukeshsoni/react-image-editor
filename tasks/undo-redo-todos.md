# Undo / Redo + History Panel — Task Checklist

Source PRD: `prds/undo-redo-prd.md`

## Scope (v1)
- Linear undo/redo (no branching history).
- Left Lightroom-style panel with a `History` accordion.
- Undo/Redo buttons in the right panel header.
- `Revert` button at the bottom of the right panel.
- Shortcuts: `Cmd+Z` (undo), `Shift+Cmd+Z` (redo).
- Bounded history (default: last 50 steps).

## 1) State model + store
- [x] Define serializable `EditorSerializableState` snapshot shape (edits + camera: zoom/pan + crop/rotation as applicable)
- [x] Create history store (Zustand) with:
  - [x] `entries: HistoryEntry[]`
  - [x] `index: number`
  - [x] `push(entry)`
  - [x] `undo()` / `redo()`
  - [x] `jumpTo(index)` (for clicking history rows)
  - [x] `resetToBaseline(baselineState)` (used for image load + revert)
  - [x] history cap enforcement (50)
- [x] Add helpers:
  - [x] `canUndo` / `canRedo` selectors
  - [x] `currentEntry` selector

## 2) Baseline capture + lifecycle
- [x] On image load, capture baseline state as `Original`
- [x] Ensure switching images resets history + baseline
- [x] Decide whether history keeps explicit `Original` entry (recommended) and enforce consistently

## 3) Commit points (history recording)
- [x] Define “commit” semantics so high-frequency changes don’t spam history
- [x] Implement commit points for:
  - [x] Slider interactions (debounced; one entry after settle)
  - [x] Crop apply / reset crop (captured via edits snapshot change)
  - [x] Rotation changes (captured via crop settings snapshot change)
  - [x] Zoom/pan settle (debounced)
- [x] Clear redo stack when pushing a new entry after undo
- [x] Ensure history writes don’t disrupt live preview updates

## 4) Undo/Redo + Revert actions
- [ ] Wire `undo()` to restore snapshot state into editor stores
- [ ] Wire `redo()` to restore snapshot state into editor stores
- [ ] Implement `revert()`:
  - [ ] Restore baseline snapshot
  - [ ] Reset history index appropriately
  - [ ] Clear redo stack

## 5) UI — Left history panel
- [ ] Add left panel container (Lightroom-style) using existing layout patterns
- [ ] Add `History` accordion
- [ ] Render history list with current selection styling
- [ ] Clicking a row triggers `jumpTo(index)`
- [ ] Add stable selectors for tests (`data-testid`)

## 6) UI — Right panel buttons
- [ ] Add Undo/Redo buttons to the right side of the right panel header
- [ ] Disabled states follow `canUndo` / `canRedo`
- [ ] Add optional tooltips/aria-labels with shortcut hints
- [ ] Add `Revert` button to bottom of right panel

## 7) Keyboard shortcuts
- [ ] Add global shortcut handling:
  - [ ] `Cmd+Z` → undo
  - [ ] `Shift+Cmd+Z` → redo
- [ ] Do not trigger when focus is inside text inputs / editable elements
- [ ] Ensure shortcuts don’t conflict with existing bindings

## 8) Tests (Vitest)
- [ ] Unit tests for history store:
  - [ ] push/undo/redo basics
  - [ ] history cap (drops oldest)
  - [ ] new edit after undo clears redo
  - [ ] jumpTo sets correct index
- [ ] Component tests:
  - [ ] Undo/Redo buttons enable/disable correctly
  - [ ] Keyboard shortcuts invoke actions
  - [ ] History list renders and clicking an entry restores expected state

## 9) Manual QA checklist
- [ ] Undo/redo across multiple panel adjustments
- [ ] Undo/redo after crop apply
- [ ] Undo/redo after zoom/pan
- [ ] Revert restores original state and clears history as expected
- [ ] New edit after undo clears redo
- [ ] Shortcuts work and don’t fire in inputs
