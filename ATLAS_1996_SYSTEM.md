# Planetary Data Atlas / System Date 1996

## Premise

This is an alternative technical history, not retro styling. The interface is
treated as an experimental scientific Web3D output system that could have been
assembled from 1996-era web, workstation, NASA Earth-science and scientific
visualization practices. The source snapshot remains explicitly current; the
system date is an interface fiction, not a claim about when the data was measured.

## Output grammar

`DATA -> READ -> NORMALIZE -> COMPUTE -> XYZ GEOMETRY -> PROJECT -> OUTPUT`.
The screen labels the spatial field as output from that pipeline. The existing
world coordinates, risk radius and observer-derived readings are unchanged.
"SOURCE / 2025" stays visible beside the observation set so the visual date does
not falsify the dataset.

## Visual decisions

| System role | Rule applied |
| --- | --- |
| Background | Near-black field and dark workstation panels. |
| Primary information | Off-white numeric and textual output. |
| Secondary information | Muted warm gray, thin separators and low-opacity wireframes. |
| Red signal | Boundary shells, r>2 pressure points, selected point/line/ring, validation/system signal. Never a decorative accent. |
| Light | 17x17 canvas raster sprites with stepped alpha bands, nearest-neighbor sampling, hard core / middle / outer falloff. No bloom or postprocessing. |
| Geometry | Existing points, thin measurement lines, r=1/r=2 wire reference geometry and selection ring. No new surface, volume or invented relation edges. |
| Type | Arial/Helvetica only, compact scientific labels and tabular-style monospace readouts. No pixel, terminal, Y2K or display font. |
| Motion | User-driven orbit/dolly with damping labelled as mechanical. No automatic drift, orbit or time animation. |

## Controls as scientific operations

`SYSTEM`, `REFERENCE`, `READ POINT`, `ALIGN AXIS`, `OUTPUT` are actual view/
output commands. They replace decorative icon-only controls. State and Observer
remain separate panels; there is no invented control console.

## Explicit non-goals

No outer-space texture, star asset, Earth model, cinematic glow, fake scanline,
CRT distortion, pixel font, false historic date in data fields, or invented
analysis relation is added. The field may initially suggest astronomical viewing,
but its source, boundary labels, r reference geometry, measurement lines and data
inspector identify it as Earth-system data.
