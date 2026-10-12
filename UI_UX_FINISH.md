# Planetary Data Atlas — interface finish

Date: 2026-10-12 (Asia/Seoul). Before-work checkpoint: `df3652e`.

## Existing implementation established before editing

- The atlas uses 9 fixed boundary directions, 11 quantitative controls and 2
  non-quantitative control states. Reference shells are R=1 and R=2. Each
  quantitative orbit retains the original control radius. No aggregate is created.
- CSV observations use a separate local layout, with original axes and values.
  CSV selection does not change the atlas coordinates, orbit geometry or camera.
- Six boundaries have default local datasets. Ocean acidification, atmospheric
  aerosol loading and stratospheric ozone depletion have no corresponding CSVs
  in the supplied manifest; their original controls remain accessible.
- Boundary selection retains the manifest's designated default or the existing
  remembered dataset. The default is not necessarily the first menu item.
- Drag, wheel, fit, focus, group alignment and smooth focus transitions are
  implemented. No `autoRotate` or automatic scene rotation exists in this
  checkpoint. No automatic motion or idle reset was added.
- Local observations have no planetary R. Their display axes and geometric
  extent are distinct from global risk scores. Camera distance remains |C−T| in
  scene units, not physical metres or environmental risk distance.

## Implemented presentation changes

| File | Responsibility |
| --- | --- |
| `src/dataset-presentation.js` | Display names and source section/format/role metadata for all 96 datasets |
| `src/select-control.js` | Black custom comboboxes over unchanged native select values/change events |
| `index.html` | Analysis hierarchy, manual fold control, expandable source context, readout labels |
| `src/style.css` | Shared typography, thin rules, square controls, states, menus and responsive panel placement |
| `src/main.js` | Connect display metadata, structured readings, panel feedback, tab navigation and node hover |
| `src/climate-layer.js` | Small local hover feedback and reset opacity for a brief dataset fade-in |
| `scripts/ui-browser-check.mjs` | Interaction and 16:9 interface regression checks |
| `scripts/ui-preview.mjs` | Repeatable before/after captures |
| `scripts/atlas-browser-check.mjs` | Configurable local URL for existing regression suite |

Dataset prefixes identify the source section (01–05), not one of the nine
boundary IDs. The bottom panel separately identifies the active boundary.
Names derive from the audited axis definitions. History/processed datasets use
their actual indicator name; statistics names were checked against source rows.
Source selections, associations and summaries remain records, not new risk nodes.
Analysis format and source row count are secondary menu text, not part of the
title. Original filenames, CSV rows and provenance remain available in the UI.

The reference tab presents exact original values with source-specified unit
suffixes separated visually. No units are inferred when the axis has none.
Original labels, including years and mixed-year source descriptions, remain in
the original CSV row and Data tab. Display transforms never alter those values.

DATA, ENTITY and AXES support arrows, Home/End, Enter/Space, Escape, Tab and
prefix search. Menus stay inside the viewport and scroll internally. Disabled
options remain unavailable. Manual analysis folding does not change data state.
Existing REFERENCE/DISTANCE/DATA tabs now support keyboard navigation as well.

## Verification

- `npm run build`: succeeds; existing large-bundle advisory remains.
- `npm test`: 15/15 pass, including all 96 datasets and source cell retention.
- `npm run validate`: 11/11 quantitative controls pass.
- `node scripts/ui-browser-check.mjs`: passes. Covers all 9 boundary states,
  actual combobox keyboard interactions, dataset change preserving camera and
  atlas state, ENTITY, AXES, EXTENT, exact readout values/original source rows,
  tabs, folding, XY planarity, node picking, drag and wheel.
- Panel bounds and overlap checks pass at 1920×1080, 1600×900, 1440×810 and
  1280×720, including the open Readout and dropdown menus.
- `ATLAS_URL=http://127.0.0.1:5174 node scripts/atlas-browser-check.mjs`:
  existing suite passes, including 38,150-row history, source selection,
  filter-invariant positions and stale async-load protection.
- Browser JavaScript, console and shader error collections are empty.
- Before/after screenshots were visually reviewed. Artifacts are in
  `validation/ui-before-*.png`, `validation/ui-after-*.png`,
  `validation/ui-dropdown.png`, and reports in `validation/ui-check.json`.
- Source payloads, generated manifest, risk/parser code and spatial calculations
  have no changes from the before-work checkpoint.

## Limits

Automatic motion could not be tested because it does not exist in the current
code. Three boundary CSV connections cannot be tested because their source
datasets are absent; the unavailable states were tested. Validation uses local
Chrome; exhibition hardware, other browser engines and screen readers were not
tested. Desktop 16:9 screens are the verified target; smaller layouts have CSS
fallbacks but are not claimed to have the same exhibition validation.

## Layout polish after checkpoint 83e0c90

- Saved the preceding UI implementation as commit `83e0c90`.
- Updated `index.html` and `src/style.css`: consistent left vertical datum for
  fixed UI, smaller observation distance without CAMERA TO TARGET, separated
  toolbar and layer legend, restrained layer indicators, and header/control/meta
  grouping in the bottom panel.
- Kept all tool IDs and handlers. BOUNDARY, ALIGN AXIS and SAVE PNG are now in
  READOUT; VIEW and FOCUS remain in the upper toolbar.
- Preserved the distance output's accessible description as camera-to-target
  distance in scene units.
- Repeated the production build and UI browser regression suite successfully.
  All four desktop sizes passed bounds/overlap checks, including open READOUT.
  Browser error collection remains empty.
- Reviewed the updated 1920×1080 capture in `validation/ui-layout-record.png`;
  overview and analysis captures use the same `ui-layout-` prefix.
- This layout polish is a separate, uncommitted change after the checkpoint.

## Line hierarchy after checkpoint 324188a

- Committed the previous layout polish as `324188a`.
- Kept structural left rules on ANALYSIS CONTROL, LOCAL ANALYSIS and the
  expanded READOUT panel; removed them from the toolbar, legend, readout trigger,
  floating labels and outer risk block. The actual R scale is retained.
- Reduced the distance anchor to a faint rule.
- Replaced the eye icon with UI ON / UI OFF text; VIEW and FOCUS now use text.
  Existing button IDs, camera handlers and interface shortcut remain unchanged.
- Changed files: `index.html`, `src/style.css`, `src/main.js`, this report.
- Production build and UI browser regression pass; all four desktop sizes have
  no panel clipping/overlap and browser errors are empty. Captures use
  `validation/ui-lines-` prefix. These latest changes remain uncommitted.

## Final surface and toolbar pass after checkpoint 336ffd5

- Saved the selected-label rule and preceding changes as `336ffd5`.
- Compared black opacity pairs 90%/92%, 92%/94%, and 94%/96% on the same
  1920×1080 selected-observation view. Chose 92% bottom and 94% right: faint
  underlying orbits remain visible without becoming competing rules under text.
  No blur, gradients, rounded panels or shadows were added.
- Unified VIEW, FOCUS and UI into one 30px-high text toolbar. Camera commands use
  `aria-current` for current framing, while the existing UI toggle retains
  `aria-pressed`; white thin underlines distinguish states without risk red.
- Reduced legend typography from 10px to 8px and line samples from 15px to 12px.
  Kept 28px-high click rows, original layer inputs and handlers; removed duplicate
  R values. Removed the distance anchor while preserving its numeric output.
- Kept left rules on both analysis panels and the selected floating analysis
  label. Standardized analysis input heights at 32px.
- Files: `index.html`, `src/style.css`, `src/main.js`,
  `scripts/ui-surface-check.mjs`, this report. No camera mathematics, CSV data,
  spatial positions or orbit geometry were changed.
- Production build, full UI browser regression and the added surface/toolbar
  check pass. Four desktop 16:9 sizes pass panel bounds/overlap checks. Dropdown
  keyboard, ENTITY, AXES, EXTENT, source readout, folding, node picking, drag and
  wheel pass; console error list is empty. Toolbar alignment, layer toggles and
  UI hide/restore were additionally checked. Existing bundle-size warning remains.
- Reviewed comparison captures `validation/ui-surface-{lighter,balanced,denser}.png`.
  Final captures use `validation/ui-final-` prefix.
- Automatic orbiting is absent from the inspected baseline, so cannot be
  verified; no motion was added. Exhibition hardware and other browsers remain
  untested. This final pass is uncommitted after the requested checkpoint.

## Observation motion implementation

This pass adds observation motion explicitly requested after the UI finish.
The earlier baseline had no automatic rotation. The new overview rotation moves
the observer camera around the fixed atlas; node coordinates, radii and orbit
geometry remain unchanged. Source CSVs and display transforms remain unchanged.

### Behavior

- Overview rotates at OrbitControls speed 0.12, with delta-time updates. Drag or
  wheel stops automatic rotation until the user explicitly returns with VIEW.
  Active analysis, focus transitions, hidden documents and reduced motion do not
  auto-rotate. There is no inactivity timer or automatic selection reset.
- One primary node per 7-second interval receives at most 0.08 additional
  opacity; each overview observation layer has one staggered brief white scan.
  Scan changes brightness only and adds no risk interpretation or new values.
- Existing immediate target/related-line emphasis and 950ms camera interpolation
  are preserved. Manual canvas input interrupts focus. Repeated focus requests
  restart from the actual current camera pose.
- Dataset replacement fades the old points over 120ms and reveals the new
  points by source observation index over 640ms. Only opacity and screen-space
  point size change. All source observations remain in the geometry. Hidden
  observations cannot be picked; explicit source-row selections appear at once.
- Actual fetch state uses READING DATA. Once the fetch resolves, DATASET LOADED
  replaces it even if the remaining visual fade is still running; exact counts
  and axes appear with the newly bound data. No live-data claims/counters added.
- Existing request tokens guard both fetch and visual wait completion. Dataset
  replacement never calls camera focus. Record-only and absent-CSV states retain
  their existing behavior.
- Panel rules, headings and content fade in over short overlapping 140–360ms
  intervals. Available controls are never hidden by a fake loading sequence.
  Folding uses a 160ms height/opacity transition; overview return uses a 750ms
  camera transition and a 100ms panel exit, with outgoing controls inert.
- Dropdown opening uses a 120ms fade/3px translation. Hover feedback remains
  restrained. Existing layer checkboxes still directly control their 3D layers.
- Reduced motion removes automatic rotation/scans, sequential projection, menu
  and panel effects; focus reaches its destination immediately. Preference
  changes cancel current panel effects and finish camera interpolation.

### Files and validation

Motion changes: `src/main.js`, `src/climate-layer.js`, `src/style.css`.
Regression updates: `scripts/ui-browser-check.mjs`; new coverage:
`scripts/ui-motion-check.mjs`. Earlier uncommitted toolbar/legend work remains
in place. No animation library was added.

- `npm test`: 15/15 pass; `npm run validate`: 11/11 pass.
- Production build passes with the preexisting bundle-size warning.
- UI browser suite passes at all four 16:9 desktop sizes, including original
  dropdown keyboard, filtering, axes/extent, folding, picking and camera input.
- Existing atlas browser suite passes all nine boundaries, 38,150-row history,
  original source readout and stale asynchronous request protection.
- Motion suite covers normal/reduced environments, idle camera rotation,
  manual suspension, sequential projection, exact point counts, camera retention,
  latest-request precedence, focus interruption/overview return during a dataset
  switch, and unchanged planetary coordinates/radii.
- Latest serial headless Chrome measurement on the 1920×1080 analysis view:
  median frame interval 16.7ms, p95 16.8ms (68 sampled intervals); reduced motion
  median 16.7ms, p95 33.2ms (65 intervals). Earlier
  concurrent browser runs measured about 33ms; these are short local samples,
  not an exhibition-hardware performance guarantee.
- Browser JavaScript/shader error collection is empty. Source payload, manifest,
  data parser, spatial mapping and observation math show no changes from
  checkpoint `336ffd5`.
- Captures: `validation/ui-observation-*.png`, `validation/ui-motion-*.png`.
  Machine-readable report: `validation/ui-motion-check.json`.

Exhibition hardware, prolonged GPU performance and other browser engines have
not been tested. Existing three boundaries without source CSVs remain accurately
unavailable. Changes are uncommitted.
