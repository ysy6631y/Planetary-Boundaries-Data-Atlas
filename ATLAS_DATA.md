# Boundary data integration

Implementation date: 2026-10-07 (Asia/Seoul).
Baseline: `77c44c0`, preserving the user's later climate navigation/lighting changes.

## Coverage

All 133 CSV files in the five chapter archives, final CSV archive and red/final-reading
archive were read using Python's CSV parser. The generated manifest accounts for each:
96 unique datasets, 34 duplicate files retained as provenance aliases, and 3 ALL_ union
indexes whose section records are already included. 257,474 rows across unique files
are available. This is NOT an independent observation count: raw historical records,
processed records, projections and statistics overlap by subject.

`src/atlas-manifest.generated.json` records the exact columns, source paths, hashes,
row counts, coverage status, dataset roles, shared boundary memberships and reasons.
`public/atlas-data/` contains compact, lazy-loaded copies of original CSV cell strings.
Every original record retains its CSV row number. No statistical estimates are created.
All seven inspected ZIP files retain their SHA-256 before/after generation. The unit
distance archive and existing PB source/parser/risk values are not modified.

## Boundary correspondence

| Boundary | Available datasets | Main local view | Interpretation |
| --- | ---: | --- | --- |
| Climate change | 29 | Fossil electricity / consumption CO2 / N2O | Energy/emission context; includes source series and response analyses |
| Biosphere integrity | 23 | Forest / freshwater / RLI | Shared maintaining-systems analysis; terrestrial/marine protection and KBA response |
| Land-system change | 39 | Agriculture / yield / forest change | Land transformation, forest cover, sustainable agriculture and protection |
| Freshwater change | 23 | Forest / freshwater / RLI | Water resources, water stress and their supplied shared analyses |
| Biogeochemical flows | 15 | Nitrogen / phosphate / pesticide | Fertilizer inputs and nutrient/chemical analysis |
| Novel entities | 15 | Nitrogen / phosphate / pesticide | Pesticide pressure context; no invented quantitative global boundary |
| Ocean acidification | 0 | Existing PB control | No acidification analysis; marine protection is classified as biosphere response |
| Atmospheric aerosol loading | 0 | Existing PB control | No aerosol dataset; greenhouse emissions are not relabeled as aerosols |
| Stratospheric ozone depletion | 0 | Existing PB control | No ozone dataset; N2O emissions are not ozone concentration |

The counts overlap because shared datasets have a single ID referenced by several
boundaries. They must not be summed as unique datasets. Chapter-wide statistics are
marked shared context. Material consumption is explicitly contextual to supplied
water/material and material/pesticide analyses, not a direct novel-entities measure.
Response indicators are not environmental risk scores or proxies for missing controls.

## Interaction and spatial semantics

- Boundary/control selection opens its available DATA menu and keeps the existing
  click-to-focus behavior. Novel Entities can open local pesticide data while its
  global r and XYZ remain null.
- Default XYZ views retain the existing small-point visual style and per-boundary
  anchor at direction x 3.5, scale 0.36. These are layout parameters only.
- Supplied XY data uses a display plane with Z=0; source Z remains null. No volume
  envelope is available for planar or degenerate observations.
- Source time series uses actual Year and original value. No synthetic animation.
  Source regions/aggregates are retained with their original entity/code labels.
- `processed.csv` uses sorted entity categories on X and the original value on Y.
  Category spacing is labeled as layout, not a scientific distance.
- Statistics, red records, correlations and summaries are source-reading records.
  They are not disguised as country nodes or assigned invented XYZ. CSV ROW exposes
  every record through its original column names and values.
- Entity filtering preserves the full dataset's axis domains, so displayed points
  do not move when the filter changes. Zero, negative and missing values are distinct.
  Invalid coordinate rows stay available through CSV ROW but are not plotted.
- Climate keeps its prior log default. Other sources default to linear; log Y/Z is
  only enabled when all measured Y/Z values are positive. Original values never change.
- EXTENT is a geometric convex envelope, never a data relation; available only for
  nondegenerate 3D observations. There are no invented country relationship edges.

All six supported boundaries expose analysis, processed, history, and applicable
statistics/RED/summary sources. The active dataset loads on demand; mutually incompatible
cohorts and units are not combined into one cloud. Existing global PB radius validation
continues to evaluate only the 11 quantitative control points.

## Cohorts and RED

The 120-country climate analysis and the 89-country atmospheric final-reading data
remain separate source datasets. Likewise section03 analysis and processed red-point
cohorts remain separate. A RED classification or variable correlation is never copied
onto a different dataset merely because a country or variable name matches.
Source-defined red points/edges are accessible in their original records; this change
does not implement a new relation network renderer.

## Reproduction and checks

`npm run data:atlas` regenerates the manifest/payloads from local read-only ZIPs.
Generated files are retained with the source, so `npm run build` does not need ZIPs.

`npm test`: all 96 datasets, all source rows, missing/negative values, planar layout,
shared identities, unsupported-boundary states, filter invariance and existing PB tests.
`npm run validate`: original 11 PB radii.
`node scripts/atlas-browser-check.mjs`: 9 boundary menus, source picking, XY geometry,
38,150-row historical source, entity filtering, RED readout, immutable PB state and
desktop 1440/1920 screenshots. JavaScript and shader errors are collected.
No mobile work was performed.
