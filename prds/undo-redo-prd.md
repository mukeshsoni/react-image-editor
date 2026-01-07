# PRD: Undo / Redo + History Panel

## Summary
Add a non-destructive **Undo/Redo** system with a Lightroom-style **History** panel.

- A new **left panel** displays a `History` accordion listing past edits.
- The existing **right panel header** gets **Undo** and **Redo** buttons.
- The bottom of the right panel gets a **Revert** button to restore the original image condition.
- Keyboard shortcuts:
  - `Cmd+Z` = Undo
  - `Shift+Cmd+Z` = Redo

## Goals
- Allow users to safely experiment and recover from mistakes.
- Provide visible, understandable edit history.
- Ensure undo/redo affects the actual editor state (not just UI).
- Keep history bounded to avoid unbounded memory growth.

## Non-goals (v1)
- Branching history timelines (no “multiple futures”).
- Persisting history across page reloads.
- Storing full pixel snapshots per step (prefer serializable edit state).
- Collaborative editing.

## User Stories
1. As a user, I can undo my last change.
2. As a user, I can redo an undone change.
3. As a user, I can see a list of my edits and understand what changed.
4. As a user, I can revert the editor back to the original image.

## UX / UI Requirements

### Left panel (History)
- Add a left-side panel similar to Lightroom.
- Include a `History` accordion:
  - Shows a vertical list of history entries (most recent at top or bottom; see Open Questions).
  - The “current” entry is visually highlighted.
  - Each row shows:
    - Edit label (e.g., `Crop Applied`, `Zoom`, `Vibrance +12`).
    - Optional value summary (e.g., `+12`, `1.25x`).
- Clicking a history item jumps to that state (time-travel).

### Right panel header
- Add **Undo** and **Redo** icon buttons on the right side of the right panel header.
- Disabled states:
  - Undo disabled when there’s nothing to undo.
  - Redo disabled when there’s nothing to redo.
- Tooltips (nice-to-have): show shortcut hints.

### Right panel footer
- Add a **Revert** button at the bottom of the right panel.
- Revert restores the editor to the original image condition:
  - Clears all edits and resets sliders to defaults.
  - Resets crop/rotation/zoom/pan to initial defaults.
  - Clears history (or keeps a single “Original” entry; see Open Questions).

### Keyboard shortcuts
- Support:
  - `Cmd+Z` → Undo
  - `Shift+Cmd+Z` → Redo
- Shortcuts should not fire when typing in inputs (text fields, select search, etc.).

## Definitions

### Original image condition
The initial editor state immediately after an image is loaded (before any edits).

### History entry
A single user-visible step representing an edit or edit group.

## Functional Requirements

### What should be recorded
History should include (at minimum):
- Crop apply / reset crop
- Rotation changes (if present)
- Zoom and pan changes
- All non-destructive panel adjustments (white balance, light, color, details, tone curve, etc.)

### Grouping / granularity
- Drag-based interactions should not create a history item per mouse move.
- Each “meaningful change” should create one entry, for example:
  - Slider drag → one entry when drag ends
  - Crop apply → one entry
  - Zoom wheel burst → one entry when interaction settles

### Bounded history
- Keep last `N` steps (default: `50`).
- When the limit is exceeded, drop the oldest entries.

### Time travel behavior
- If the user undoes some steps and then performs a new edit:
  - Redo stack is cleared.
  - A new linear history is created from the current state.

## Technical Requirements

### State model (suggested)
Maintain a dedicated history store that records snapshots of the editor’s serializable edit state.

Suggested types:
- `HistoryEntry = { id: string; label: string; timestamp: number; state: EditorSerializableState }`
- `HistoryState = {
  entries: HistoryEntry[];
  index: number; // points to current entry
  canUndo: boolean;
  canRedo: boolean;
}`

### Integration points
- Centralize “commit points” for history recording (e.g., on slider commit, crop apply, zoom settle).
- Ensure history updates do not fight real-time preview updates.

### Revert implementation
- Revert sets the editor’s edit state to the initial defaults captured when the image first loads.
- Revert should reset the history index accordingly.

### Performance / memory
- Prefer storing serializable edit settings and view transforms instead of image pixels.
- Avoid deep copies of large objects unnecessarily.

## Edge Cases
- Switching images should reset history and set a new “Original” baseline.
- Undo/redo while a modal is open should still work, unless focus is in a text input.
- Undo/redo should be no-ops when disabled.

## Acceptance Criteria
- Left panel shows a `History` accordion with entries.
- Undo and redo buttons exist in the right panel header and enable/disable correctly.
- Revert button exists in the right panel footer and restores original state.
- `Cmd+Z` and `Shift+Cmd+Z` work across the editor without interfering with text inputs.
- History is limited to the last 50 steps.
- Performing a new edit after undo clears the redo stack.

## Test Plan
- Unit tests:
  - History stack push/undo/redo logic.
  - Limit to `N` entries drops oldest.
  - New edit after undo clears redo.
- Component tests:
  - Undo/Redo buttons disabled/enabled based on state.
  - Keyboard shortcuts trigger undo/redo.
  - Clicking a history entry jumps to expected state.

## Open Questions
- Should history list show most recent at the top or bottom?
- Should “Revert” clear history entirely or keep an `Original` entry plus one `Reverted` entry?
- Should zoom/pan be part of history by default, or only “edit” operations?
- Do we need a “pause recording” flag for very high-frequency interactions?
