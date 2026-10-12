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
