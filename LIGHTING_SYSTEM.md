# Node Lighting System

The node geometry is not a light source and is never enlarged. Every quantitative
node keeps its existing `SphereGeometry(0.047, 16, 12)` and its original world
position. The light is a separate camera-facing `THREE.Sprite` child at local
position zero.

## Raster signal levels

| Node state | Core / halo | Opacity |
| --- | --- | ---: |
| ordinary (`r <= 1`) | white core, pale gray middle, transparent dark outer band | 13% |
| important (`1 < r <= 2`) | white core, pale gray middle, transparent dark outer band | 32% |
| high risk (`r > 2`) | white core, pale gray middle, transparent dark outer band | 46% |
| selected | near-white/red core, saturated red middle, dark red outer band | 68% |

The texture is a 17x17 canvas raster with nearest-neighbor sampling, stepped
alpha bands and a small deterministic unevenness in the outer pixels. The sprite
scale is recalculated from camera distance and viewport height so the visible halo
stays approximately 9-16 CSS pixels rather than becoming a large sphere near the
camera. The core remains approximately 1-3 pixels.

## Dry geometry

Direct measurement lines and reference geometry use dry `LineBasicMaterial` only.
The redundant curved navigation traces were removed. Unselected measurement lines
remain faint gray; only the selected point's measurement relation turns red. No
line uses additive material, bloom, postprocessing, volumetric lighting or lens
flare.

Each quantitative control also has one origin-centered orbit circle. Its radius is
the control's actual unified risk distance `r`, and the circle's plane is oriented
so the corresponding node lies exactly on its circumference. Unselected circles
remain gray; the selected circle turns red as the active reference. Boundaries
with two quantitative controls therefore have two circles. Qualitative and
not-quantified controls have no circle because they have no valid numerical radius.

## Data meaning

The halo is a presentation signal, not an additional risk value. The existing
`r`, XYZ positions, line endpoints and validation checks remain untouched. A red
halo means selected observation only; it does not mean the camera is close, the
point is physically luminous, or two points are related.
