# Observation Instrument UI

## Current desktop structure

- The WebGL data field is the primary interface.
- The boundary index is plain text over the field, not a separate navigation panel.
- The selection readout is hidden in the system overview and opens as a compact
  lower-right module only after a boundary or node is selected. It can be closed
  without clearing the selection.
- The module separates `REFERENCE`, `DISTANCE` and `DATA` into explicit tabs so
  the field is not permanently reduced by a dashboard column.
- `REFERENCE` reports the selected real control variable and its fixed XYZ/R values.
- `DISTANCE` is Euclidean distance in normalized XYZ data space from the selected
  quantitative node to each other quantitative node. It is not camera distance,
  kilometers or an astronomy unit.
- `RELATIONS` lists only implemented relations: origin measurement and shared
  boundary membership. Analytical relations remain explicitly not loaded.

## Interaction contract

- Hover: show a small node code and fixed R value.
- Left click: select a reference, preserve camera state, show `READING DATA...`
  for 200 ms, then update the fixed right readout.
- Double left click or the focus command: perform a short 420 ms camera/target
  transition to the selected quantitative node.
- Left or right drag: orbit the observer frame. Click selection is suppressed
  after pointer movement, so orbiting does not change the reference.
- Wheel: dolly only.

## Signal hierarchy

- Unselected nodes use faint white raster light.
- The selected node alone uses red raster light.
- Unselected measurement lines and R-orbits are faint gray.
- The selected measurement line and selected R-orbit are red.
- Red is therefore an active-reference signal, not a blanket threshold fill.

## Deferred data field

Reference stars may later use multiple non-interactive parallax layers for depth.
Actual chapter rows must appear separately as provenance-backed local-analysis
nodes near their reviewed boundary. See `NEXT_STEPS.md`; no country labels or
analysis relationships are fabricated in the current global field.
