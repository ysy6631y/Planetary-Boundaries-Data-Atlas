# Planetary Boundaries: Phase 1 spatial prototype

9 boundary groups, 11 quantitative control points, 2 non-quantitative states. No boundary aggregation, fabricated missing values, data radius clipping or UI-pixel normalization.

## Atlas system date

The current visual output is `PLANETARY DATA ATLAS / SYSTEM DATE 1996`: an
alternative historical scientific Web3D system, not a retro-styled modern site.
`SYSTEM DATE / 1996` is interface fiction only; `SOURCE / 2025` remains visible
in the app and the supplied data is not historically relabelled. See
`ATLAS_1996_SYSTEM.md` for the color, light, geometry, interaction and explicit
non-goal rules. The red signal is reserved for boundary/pressure/selection/system
status; it is not decorative.

## Run

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173/ . If occupied by another project, use another port. WebGL2-capable browser required. Node 22.12+ or the validated Node 24 environment is suitable for the installed Vite version.

```sh
npm test
npm run validate
node scripts/browser-check.mjs
node scripts/observer-browser-check.mjs
npm run build
```

Browser check expects the dev server on 5173 and installed Google Chrome. For a machine without Chrome, install a Playwright browser and adjust its channel option. Build output is in dist/ with license notices; serve via a static HTTP server, not file://.

## Review

- Left list selects any of 9 groups or 13 controls, including non-quantified controls.
- Quantitative glyphs in the canvas can be selected directly.
- Drag orbits; wheel down moves inward, wheel up retreats. Small exponential steps slow in absolute distance near the target. Observation distance is camera-to-target distance, not risk.
- Toolbar icons: fit all data, frame r=1/r=2 shells, focus quantitative point, align selected group direction, export validation JSON. Hover exposes titles.
- Shells and measurement lines can be toggled. Focus is disabled for groups/NQ states because no numeric target exists.
- Every quantitative inspector shows raw input, thresholds, direction, unified score, r, angles, XYZ and world-space radius validation.
- Gold/dashed group labels preserve non-quantitative states without creating data points or measurement segments.
- State and Observer tabs separate environmental values from camera/projection readings. Observer offers a selected-group or world +Y reference axis.
- Bearing/elevation, screen distance and projected center proximity change with camera motion. Axis-relative angle does not change merely by orbiting.
- Group-direction alignment keeps the pivot at origin, including for NQ. Only quantitative focus uses a data point as pivot. No group average is computed.

## Files

- src/data.js: structured parser and original numeric riskScore branches with strict input checks.
- src/spatial.js: fixed group IDs, Fibonacci directions, pair offsets, XYZ, validation.
- src/main.js: Three.js geometry, official OrbitControls, UI, world/GPU validation.
- src/observation.js: immutable state, orthonormal axis frame, camera-local/projected metrics and wheel response.
- audit/planetary-boundaries.source.json: byte-identical source snapshot from the prior audit, not modified.
- tests/spatial.test.js: original-generator parity, thresholds, malformed input, layout independence and radius tests.
- validation/mathematical.json: all controls and calculated XYZ.
- validation/browser-check.json: browser checks and rendering statistics.
- validation/observer-browser-check.json: observer interaction, invariance, axis selection and responsive checks.
- OBSERVATION_SYSTEM.md: source concepts, three alternatives and selected three-layer model.
- research/astronomy-review.md: entire-text/static-diagram review and sampled-animation coverage.
- checkpoints/phase1-before-observer-20261005/: previous working source and built dist, preserved before edits.
- validation/desktop.png, validation/mobile.png: reviewed screenshots.
- DATA_AUDIT.md, SPATIAL_LOGIC.md, RESEARCH.md, VALIDATION.md, NEXT_STEPS.md: decisions and evidence.

## Limits

Angles are layout parameters, not geographical or causal variables. Group labels are HTML layout anchors, not observations. Perspective makes screen lengths unsuitable for exact risk comparison; inspect the numbers. No time series, interpolated surface or Earth model. Numeric distance expresses the supplied piecewise threshold scale, not an independently calibrated probability or additive total risk.

Reference-shell framing deliberately allows distant points to leave the viewport; fit-all restores the complete field. NQ remains accessible in the boundary list and labels. Camera focus is immediate in Phase 1; smooth transitions are Phase 2.

THIRD_PARTY_NOTICES.md and public/licenses/ document dependencies. NASA/Hail Mary/Interstellarmap assets and app code are not bundled.

Observation is not additional environmental evidence. These 11 scalar values do not intrinsically require 3D; the instrument makes viewpoint/projection changes inspectable. Local chapter XY/XYZ analyses remain a separate metric space, not yet connected or rendered. Integration requires explicit provenance and reviewed boundary mappings. No analytical edges or time animation were invented.
