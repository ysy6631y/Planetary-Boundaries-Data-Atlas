COMPLETED
- Saved git checkpoint `0401a75` before the observation-depth redesign.
- Removed the full-width header and moved the instrument identity/validation to sparse edge UI.
- Added deterministic far/mid/near reference-star layers and a larger layout-only reference plane; data XYZ and unified risk radii remain unchanged.
- Preserved all origin-to-point measurement lines, true-r control circles and r=1/r=2 references in the default system view; selection changes emphasis rather than existence.
- Changed point selection to a stepped measurement-framing transition that keeps the selected node and its complete origin-centered r circle visible, including r=7.4.
- Made the boundary index request-driven rather than permanently visible; the inspector remains contextual.
- Preserved pre-observer working source, tests, audit, lockfile and dist in checkpoints/phase1-before-observer-20261005/ before edits.
- Reread the entire supplied astronomy text and all 30 unique static images; inspected temporal samples of the four embedded animations.
- Saved OBSERVATION_SYSTEM.md: 12 requested sections, A/B/C classification, three alternatives, selected B (dual-frame observation instrument).
- Added immutable state, camera-local/projected metrics, selected-axis coordinates, State/Observer tabs and direction alignment without a representative point.
- Added fixed XYZ identity validation alongside radius checks; wheel down moves inward with small exponential steps.
- Passed 11 total unit tests and both browser suites. Original archives/parser/layout/audited scores match preservation hashes.
- Continued the existing audit; original 7 ZIP archives and source CSVs were not modified.
- Applied approved 9 boundary groups / 11 quantitative points / 2 non-quantified states; no aggregation or imputation.
- Actually operated NASA Eyes and Hail Mary in Chrome; saved interaction screenshots and observations.
- Searched NASA/JPL official repositories and NASA catalog; no official Eyes interaction source found in this search.
- Inspected Interstellarmap source and official OrbitControls; checked installed licenses and preserved notices.
- Chose fixed Fibonacci group directions with deterministic +/-3 degree paired-control offsets.
- Saved runnable Three.js/Vite source, original-data parser, spatial logic, inspector, reference shells, measurement lines, orbit/wheel/focus and validation export.
- Verified full-precision numeric riskScore against original generator and 4-decimal SVG scores.
- Passed the original 5 mathematical test groups; 11/11 CPU/GPU radius checks; 2 states correctly remain NOT QUANTIFIED.
- Passed browser checks for wheel, orbit, focus, picking, distance clamps, export, reference radii, nonblank canvas, data immutability and desktop/mobile layout.
- Saved research, data audit, final spatial logic, license notices, validation reports and screenshots.

PARTIALLY COMPLETED
- Current LOD covers SYSTEM / APPROACH / BOUNDARY / CONTROL presentation states, but LOCAL ANALYSIS still awaits provenance-backed chapter data.
- Multi-scale non-data reference-star layers are rendered and remain non-interactive; actual chapter CSV rows still need to become provenance-backed LOCAL ANALYSIS nodes revealed only near their boundary.
- Planned node provenance requires source row, boundary/chapter, entity, observation value/unit, XYZ derivation and edge type. Do not scatter chapter rows globally or present reference stars as data.
- Local analysis integration is designed with separate units/provenance/metric spaces; not rendered. Metadata confirms mixed units/years and explicit XY preferences.
- LOD hierarchy is specified; only SYSTEM/BOUNDARY/CONTROL have current inspection behavior, no automatic distance-driven analysis activation.
- Animation review used temporal samples, not every frame of continuous playback.
- NASA visual behavior is observed, but FOV/dolly implementation, exact bounds, damping coefficients and internal LOD cannot be confirmed without authoritative implementation evidence.

NOT STARTED
- Reviewed many-to-many chapter/boundary crosswalk and evidence-backed local analytical edge records.
- Exact glyph/edge occlusion, stored observer comparisons and projection-mode comparison.
- Phase 2 local-analysis travel transitions and the deeper LOCAL ANALYSIS / RAW OBSERVATION hierarchy.
- Chapter detail visualization and advanced target navigation.
- Surface topology and scientific interpretation (outside Phase 1).
- Touch-device hardware and non-Chrome browser testing.

BLOCKERS
- Global ppm/Tg scores and local per-capita/kg-per-ha/country analyses are not interchangeable. Semantic review is required before integration, not before using the current prototype.
- No Phase 1 implementation blocker remains.
- No exact numerical Genetic Diversity or Novel Entities radius is supplied; this is faithfully represented, not a rendering failure.
- No reusable official NASA Eyes source/license established; no NASA production code copied.

NEXT ACTION
- Review the new system and selected-boundary checkpoints at http://127.0.0.1:4174/; tune brightness only after comparing both distances.
- After the desktop observation-instrument UI, build foreground/background reference-star parallax and one reviewed local-analysis cluster without inventing coordinates or relations.
- Read OBSERVATION_SYSTEM.md sections 8-11 and compare State/Observer tabs before/after orbit and axis selection.
- Reproduce checks with npm test, npm run validate, node scripts/browser-check.mjs, node scripts/observer-browser-check.mjs, npm run build (run separately).
- Phase 2: start with one reviewed local analysis dataset with original units, then cancellable target travel/LOD, not visual polish or global renormalization.
- Decide surface semantics/topology only if a future surface is requested; never treat layout-derived volume as a scientific aggregate.
