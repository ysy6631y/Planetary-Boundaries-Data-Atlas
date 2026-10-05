# Validation results

Phase 1: 9 groups, 11 quantitative controls, 2 NOT QUANTIFIED states. Original source score semantics preserved. Reports are reproducible with the commands in README.md.

## Mathematical checks

The original five spatial test groups pass (node:test):

1. Group/control/state counts and absence of boundary aggregate r.
2. Full-precision equality with the actual supplied generator loaded in an isolated VM without main() or filesystem writes; parity with existing SVG 4-decimal score; baseline/PB/high-risk and beyond-risk branches.
3. Unit directions, exact intended offsets, unchanged layout under chapter reorder and changed current value.
4. CPU radial identity, Float32 endpoint tolerance, theta/phi-to-XYZ round trip.
5. Invalid/missing numeric values, unknown direction, degenerate thresholds, unknown group, malformed coordinates and deliberately wrong geometry fail.

| Control | Unified r (display rounded) | CPU radius | GPU endpoint |
| --- | ---: | --- | --- |
| CO2 | 1.7300000000 | PASS | PASS |
| Radiative forcing | 4.9400000000 | PASS | PASS |
| HANPP | 3.0000000000 | PASS | PASS |
| Forest cover | 1.7619047619 | PASS | PASS |
| Blue water | 1.1428571429 | PASS | PASS |
| Green water | 1.0904255319 | PASS | PASS |
| Phosphorus | 3.4000000000 | PASS | PASS |
| Nitrogen | 7.4000000000 | PASS | PASS |
| Aragonite saturation | 1.0555555556 | PASS | PASS |
| AOD difference | 0.3833333333 | PASS | PASS |
| Ozone | 0.4315068493 | PASS | PASS |
| Genetic diversity | null | NOT QUANTIFIED | No endpoint |
| Novel entities | null | NOT QUANTIFIED | No endpoint |

Maximum observed CPU radius error: 8.881784197001252e-16. Maximum Float32 endpoint radial error: approximately 1.320e-7. Double tolerance is 1e-10*max(1,r); GPU endpoint tolerance is 2e-7*max(1,r). No data is rescaled to satisfy tests. Actual scene Mesh world centers and line world endpoints are checked against the origin at runtime every 500ms. Bad geometry produces FAIL and a visible header error count.

Source: validation/mathematical.json; browser world/GPU result in validation/browser-check.json. NQ is never counted as a quantitative PASS.

## Browser and visual checks

Chrome + Playwright at 1440x1000, 1920x1080 and 390x844:

- 9 group sections, 13 control selectors, 11 data meshes and 11 origin measurement lines.
- All reference-circle buffer vertices meet r=1/r=2 within Float32 tolerance.
- Wheel changes camera distance with fixed FOV/target and unchanged data XYZ.
- Drag changes camera and rendered pixels, not risk radii.
- All controls are selectable with all requested inspector fields; NQ has no position/focus point.
- Focus changes camera/target only; raycasting selects the actual quantitative glyph.
- Very large wheel inputs clamp at .25 and 90.
- JSON validation download works.
- Canvas-only PNG pixel checks establish nonblank rendering and changed images after wheel/orbit; screenshot inspection confirms reference shells, states and labels.
- No label-label overlap, horizontal page overflow or overflowing button/field text in checked default viewports. Dense projections under arbitrary camera angles still warrant continued Phase 2 label design.
- No browser page errors recorded. Mobile-width pointer orbit checked; physical touch-device and Safari/Firefox checks not performed.

Screenshots: validation/desktop.png, validation/desktop-references.png, validation/desktop-not-quantified.png, validation/wide.png, validation/mobile.png. Canvas-only companions exclude HTML overlays from nonblank tests.

## Build and source preservation

Vite production build succeeds. Bundle-size warning is advisory: Three.js is intentionally retained; no final performance optimization is claimed for Phase 1. Exact packages are pinned in package-lock.json. License notices accompany dist/.

Original archive integrity is verified against the hashes recorded in the existing audit inventory, without rerunning the audit or changing source files.

## Observer extension / 2026-10-05

All 11 unit test groups pass: five existing spatial tests plus six observation tests.
New coverage: deep immutability, orthonormal axis basis/polar fallback,
camera projection/overlap changes without state changes, axis changes without camera
changes, local norm invariance, behind/at-camera and vertical singularities,
CSS-pixel scaling, exponential dolly direction/unit conversion/clamps.

`validation/observer-browser-check.json` passes in Chrome/Playwright:
- Downward 100px wheel reduces camera-pivot distance by 1.587%; FOV and pivot unchanged. Limits are 0.25 and 240.
- Orbit changes bearing/screen coordinates, not world XYZ/r or angle to an unchanged axis.
- Reference-axis changes preserve transformed norms and the camera.
- NQ controls have null projected/axis coordinates; direction alignment uses origin pivot.
- Separate tabs, keyboard navigation, numeric focus and group direction alignment work.
- 1440x1000, 1920x1080, 390x844 screenshots/canvas pixels are nonblank; no checked text overflow.
- Canvas wheel does not scroll the page; outside wheel scrolls the mobile page without camera movement.
- No page errors; 11/11 radii and fixed world-coordinate identity pass after interaction.

The axis-switch browser test stops residual damping before isolating the axis change.
Continuing inertia is observer motion, not an axis-selection side effect.
Exact glyph occlusion is not claimed: proximity means <10 CSS px between visible-volume
point centers. Center-frustum status does not guarantee an unoccluded glyph.

`validation/observer-source-integrity.json`: seven original archives unchanged;
data.js, spatial.js, source JSON and control audit match the pre-change checkpoint.
Runtime also compares world coordinates to frozen XYZ: norm alone cannot detect an
unwanted data-space rotation. No normalization or layout changes.

Screenshots: observer-desktop.png, observer-not-quantified.png, observer-1920.png,
observer-390.png. Both browser suites and production build were rerun.
Local analysis rendering/edges, smooth travel, LOD and physical touch/non-Chrome
checks remain outside this minimum extension.
