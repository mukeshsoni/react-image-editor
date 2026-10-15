# React Image Editor

A non-destructive Canvas 2D image editor for React 18.2 and React 19.

## Features

- Pointer-centered zoom, drag/inertial pan, native pinch, and double-tap fit.
- Eight-handle cropping, preset/custom ratios, rotation, and auto-straighten.
- White balance, exposure/tone, vibrance/saturation, HSL mixer, and point color.
- RGB/channel curves, parametric curves, presets, sharpening, and denoise.
- Perspective, distortion, chromatic-aberration correction, vignette, grain, and dehaze.
- Spot, heal, and clone tools with adjustable brushes and movable sample pins.
- Undo/redo and a 50-entry history that always preserves the original.
- Full-resolution PNG/JPEG export, alpha preservation, and JPEG quality.
- Resizable desktop panels, mobile tool trays, and local light/dark/system themes.

Each editor owns its session. Image-space processing is shared between preview and
export; camera changes do not change the exported image.

## Embed

```tsx
import { ReactImageEditor, type ImageEditorEdits } from "@mukeshsoni/react-image-editor";
import "@mukeshsoni/react-image-editor/styles.css";

export function PhotoEditor({ imageSrc }: { imageSrc: string }) {
  function save(edits: ImageEditorEdits) {
    console.log(edits);
  }
  return (
    <div style={{ height: "80dvh" }}>
      <ReactImageEditor imageSrc={imageSrc} themeMode="system" onEditsChange={save} />
    </div>
  );
}
```

### Styles

Import the stylesheet once, as in the example above, or from your own CSS:

```css
@import "@mukeshsoni/react-image-editor/styles.css";
```

The package ships fully compiled CSS. No Tailwind installation, compiler/plugin,
or `@source` scan is needed. It works with a regular CSS-capable bundler, or you can
serve `styles.css` directly with a stylesheet link. Resets, theme variables, and
utilities are scoped to `.react-image-editor` and `.rie-overlay`, including portal
menus, dialogs, and their backdrops, so unrelated host elements keep their styles.

For package development, edit `styles.source.css` and run `npm run build:css` to
regenerate `styles.css`. `npm run dev` also watches CSS and component class changes;
demo/library builds and `npm pack` regenerate the stylesheet automatically.
Tailwind CSS v4 and PostCSS are build-time development dependencies only.

Run `npm run test:css` for stylesheet regressions. `npm run test:css:package` uses
`agent-browser` with Chromium to check packed React 18/19 consumers without
Tailwind; set `RIE_CSS_ARTIFACTS` to an existing directory for its temporary sites
and screenshots (defaults to the system temporary directory).

React and React DOM are peer dependencies. URLs for remote images must allow
CORS. Callers own any object URLs passed as `imageSrc` and should revoke them
when no longer needed.

| Prop | Type | Default |
| --- | --- | --- |
| `imageSrc` | URL, data URL, or object URL string | required |
| `onEditsChange` | `(edits: ImageEditorEdits) => void` | — |
| `themeMode` | `"light" \| "dark" \| "system"` | `"dark"` |
| `themeScope` | `"local" \| "global"` | `"local"` |

Edit snapshots are detached, serializable version-one values. Crop and repair
coordinates are original-image pixels. A new source resets the session; a parent
rerender preserves it.

## Keyboard

- Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z: undo/redo.
- Cmd/Ctrl +/−/0: zoom in/out/fit.
- Crop: `[` / `]` rotates 1° (Shift: 5°); R resets rotation.
- Escape cancels picking. Sliders support Home/End/arrows and double-click reset.
- Healing: Alt/Option-click selects a clone source; Space-drag pans; Delete removes
  the selected spot. A source-picking button also supports touch.
- Curve points can be added/selected with buttons and moved with arrow keys.

## Develop and test

```sh
npm ci
npm run dev
npm run lint
npx tsc -p tsconfig.app.json
npm run typecheck:e2e
npx vitest run
npm run build
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:package
```

The demo build is written to `demo-dist/`. Library and declaration builds write to
`dist/`. See [`e2e/README.md`](e2e/README.md) for focused Chromium runs, traces, and
packed React 18/19 consumer tests.

Additional review regressions:

```sh
npm run test:review
npm run typecheck:review
npm run test:css
npm run test:css:package
```

The no-Tailwind package check requires `agent-browser` with Chromium. Review findings,
fixes, and verification results are recorded in [the independent review](docs/review-findings.md).

## Rebuild baseline

The original editor, E2E suite, and related fixes were committed on `redo-everything`
as `57cb7b2` **before this implementation began**. The rebuild started with an empty
application tree and retains that commit's E2E harness. Its first commit uses the
saved baseline as its parent so it can be reviewed against `main`.
See the [feature and UI/UX requirements](docs/rebuild-requirements.md).

The requirements document distinguishes working features from the original
Auto/B&W/HDR, Profile, and Guided Upright placeholders. RAW decoding and metadata/
color-profile preservation remain future scope.
