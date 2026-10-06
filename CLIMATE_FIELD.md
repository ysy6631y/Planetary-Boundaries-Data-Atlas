# Climate field prototype

Recovery checkpoint: `c826b9e` (before local-field work).

## Source and scope

120 country records from
`04_atmospheric_pressure.zip/04_atmospheric_pressure/section_04_analysis/csv/section04_optional_xyz_energy_co2_n2o.csv`.
The CSV has `x,y,z,label`; each original value and complete label is preserved.
Its metadata identifies X as fossil electricity share, Y as consumption-based CO2
per capita, and Z as N2O per capita. Years differ by variable/country and are retained
in the original label under DATA. This is the supplied analysis, not a new statistical
calculation or an independently verified replacement of its source data.

The red/final-reading bundle uses a different 89-country intersection and a different
CO2 source. Those red points and correlations are not transferred to this 120-row field.
There are no supplied country-to-country edges. No such edges are created.

Rebuild the generated JSON using `node scripts/build-climate-field.mjs`.
The script reads the ZIP without changing it, checks columns, numeric values and row
count, and records its SHA-256. Generated records retain source order (CSV row=index+2).

## Display coordinates

PB control points retain their original unified risk distances and world XYZ.
The country field is LOCAL ANALYSIS, with no assigned PB risk distance.

- Default: X linear, Y and Z log10 (all supplied emission values are positive).
- LINEAR selects untransformed axes. Neither mode changes the original values.
- Each display axis is affinely mapped to an extent of 8 x 6 x 8 scene units.
- The field has a single fixed atlas anchor at climate direction x 18. This is a
  layout location, not a boundary aggregate, scientific distance or country risk.
- CO2 and RF open the same contextual chapter field at the same anchor. The field
  does not claim country emissions directly determine either global control value.
- No random positions, jitter, synthetic observations or statistical edges.
- Changing the observer never changes country coordinates. Only the explicit axis
  mode changes display coordinates. Both transforms are invertible and tested.

The log mode exposes multiplicative emission differences and reduces the compression
caused by large observations. Distances in this display must not be read as PB risk,
correlation, or a validated country similarity metric.

## Light and navigation

The camera travels to the fixed field in 1.5 seconds. Nodes fade in at fixed positions;
they do not expand from the selected point. Wheel/drag can interrupt camera travel.
Each country is a camera-facing raster light, with a small core and a screen-size cap.
Brightness depends on view depth, not environmental importance. Selection alone adds
red light. Labels are limited and culled to avoid the inspector and other labels.

Hover reads a country code and its original CO2 value. Click selects and shows original
XYZ/units and source row. Double-click approaches that observation. The overview icon
returns to the global PB system. The left ruler reads the selected PB control r on a
fixed 24-pixel-per-risk-unit scale; the camera distance remains a separate readout.

## Optional surface

EXTENT is off by default. Three.js `ConvexGeometry` constructs a faint convex envelope
from the currently displayed country points. It is an outer extent, not a relation
network, interpolation, density field, risk surface, or occupied volume. The envelope
includes empty space and depends on the chosen axis transform. Its facet edges are
geometric edges only, never supplied country relations. It is intentionally neutral.

Implementation: official Three.js ConvexGeometry/ConvexHull, MIT license, already
preserved in `public/licenses/three.txt`.
Source: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/geometries/ConvexGeometry.js

## Verification

`npm test`, `npm run validate`, `npm run build`.
`node scripts/climate-browser-check.mjs` checks 120 visible raster lights, country
picking, scale changes, optional envelope, invariant coordinates through orbit/wheel,
unchanged 11 PB radii, overview exit, JS/shader errors and 1440/1920 desktop captures.
Mobile is intentionally deferred.
