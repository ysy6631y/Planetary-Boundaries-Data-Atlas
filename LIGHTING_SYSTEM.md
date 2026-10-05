# Node Lighting System

The node geometry is not a light source and is never enlarged. Every quantitative
node keeps its existing `SphereGeometry(0.047, 16, 12)` and its original world
position. The light is a separate camera-facing `THREE.Sprite` child at local
position zero.

## Raster signal levels

| Node state | Core / halo | Opacity |
| --- | --- | ---: |
| ordinary (`r <= 1`) | white core, pale gray middle, transparent dark outer band | 7% |
| important (`1 < r <= 2`) | white core, pale gray middle, transparent dark outer band | 28% |
| primary red (`r > 2`) | near-white core, saturated red middle, dark red outer band | 62% |
| selected | near-white/red core, saturated red middle, dark red outer band | 68% |

The texture is a 17x17 canvas raster with nearest-neighbor sampling, stepped
alpha bands and a small deterministic unevenness in the outer pixels. The sprite
scale is recalculated from camera distance and viewport height so the visible halo
stays approximately 9-16 CSS pixels rather than becoming a large sphere near the
camera. The core remains approximately 1-3 pixels.

## Dry geometry

Direct measurement lines and reference geometry use dry `LineBasicMaterial` only.
The separate navigation traces use a thin `LineDashedMaterial` so the selected
point can read like a plotted route in the Hail Mary reference. They are view
paths, not analytical edges, and have no additive material, bloom, postprocessing,
volumetric lighting or lens flare. Red line color indicates a red signal or
current selection; line opacity changes selection emphasis but does not add glow.

Each boundary also has one constant-radius partial orbit guide centered on its
stable group direction. All nine guides use the same radius and angular span;
neither value encodes risk. The selected group's guide turns red, while the actual
unified risk distance remains exclusively encoded by the control point's origin
distance and its direct measurement line.

## Data meaning

The halo is a presentation signal, not an additional risk value. The existing
`r`, XYZ positions, line endpoints and validation checks remain untouched. A red
halo means `r > 2` or selected observation; it does not mean the camera is close,
the point is physically luminous, or two points are related.
