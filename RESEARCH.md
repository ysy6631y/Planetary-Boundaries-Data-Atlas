# Reference and source research

2026-10-04. Continued from completed local audit. Source archives unchanged.

## NASA Eyes: actual Chrome interaction

Visited https://eyes.nasa.gov/apps/exo/ using Playwright with Chrome. Dismissed welcome dialog, wheeled and dragged, searched TRAPPIST, selected TRAPPIST-1, wheeled in System View, then selected Planet View.

| Item | Actual observation | Limits of conclusion |
| --- | --- | --- |
| Wheel | deltaY=-700 changed field readout 3,020 to 1,153 light-years; projection expanded | NASA FOV versus dolly not independently established |
| Target/orbit | Drag changed field orientation; Sun retained central visual reference | Internal target object not inspected |
| Target transition | TRAPPIST-1 selection traveled into system; screenshots after 700ms and another 5s | Easing implementation unknown |
| Field/detail | Stellar field/filter UI changed to orbit rings/habitable zone; Planet View showed hypothetical planet/comparison UI | Specific LOD algorithm not established |
| Left distance | Explicitly says from Earth; remained 41 light-years in TRAPPIST-1 System View even after wheel zoom | NOT a verified camera-target distance readout |
| Information | Selection changed title, summary, views, comparison controls and bottom rate control | Screen-space UI distinct from moving scene |
| Depth | Parallax, marker size/brightness, orbit rings, shaded habitable zone | No assets reused |
| Min/max | Exact bounds not established | No NASA numeric limits claimed |
| Damping | Movement/transition visible; passive scene animation confounds inertia measurement | Coefficients/implementation unverified |
| Visibility | Different labels/context controls in field/system/planet views | Internal thresholds, culling/resource LOD unknown |

Official tutorial visited and transcript read: https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/ . It corroborates search, target selection, System/Star/Planet views, comparison and Learn More, not undocumented camera mechanics.

Evidence: research/screenshots/nasa-{initial,field,wheel,orbit,transition,system,system-wheel,planet}.png; research/nasa-system-text.txt; research/nasa-planet-text.txt. Screenshots are research evidence, not production assets.

## Official NASA source search

**공개 source를 찾지 못했다.** This describes this search, not proof that no repository exists.

Visited/searched:
- https://www.nasa.gov/nasa-open-source-development/
- https://github.com/nasa-jpl
- https://github.com/nasa/Open-Source-Catalog
- https://raw.githubusercontent.com/nasa/Open-Source-Catalog/master/catalog.json
- https://api.github.com/search/repositories?q=eyes%20org%3Anasa (0 results)
- https://api.github.com/search/repositories?q=eyes%20org%3Anasa-jpl (0 results)
- https://api.github.com/search/repositories?q=exoplanets%20org%3Anasa-jpl (0 results)
- Web queries: NASA Eyes exoplanets source code github NASA JPL open source license; site:github.com/nasa eyes; site:github.com/NASA-JPL eyes exoplanets; "Eyes on Exoplanets" "source code"; "NASA Eyes" "github" "source"; site:eyes.nasa.gov license github.

No matching Eyes project in the inspected catalog using "eyes on" / "eyes visualization". Official tutorial credits NASA/JPL-Caltech; open-source interaction maintainer/license not established. Unverified third-party MIT/public-domain claims were not accepted. No production bundle was copied or reverse-engineered for reuse. Browser loading was solely for operating the reference. No WorldWind inference.

## Hail Mary: actual Chrome interaction

Visited https://valhovey.github.io/gaia-mary/ . Catalog loaded successfully after initial loading screen. Operated wheel, drag, Tau Ceti, Sol System and Galactic buttons.

- Initial range 17.72 pc / 57.8 ly; near-field count 53,836.
- Wheel deltaY=-600: range 12.44 pc / 40.6 ly; count unchanged; projection/visible labels changed.
- Drag rotated the reference grid and relative point positions.
- Tau Ceti: local centered orbital-ring view, sampled range 2.907 ly.
- Sol System: Solar neighborhood, sampled range 2.927 ly.
- Galactic: large-field view, sampled range 178 pc / 581 ly. Samples are not claimed preset constants.
- Depth cues: perspective plane grid, vertical drop lines, foreground labeled points, dense backdrop, distinct red dashed trajectory.
- Lines remained visually thin across views; rendering implementation/physical thickness unverified.
- Label/foreground visibility changes observed; fixed catalog count does not prove all points were drawn at every scale.

Evidence: research/screenshots/hail-*.png and research/hail-galactic-text.txt.
Supplementary page visited: https://gigazine.net/gsc_news/en/20260522-project-hail-mary-star-map/ . Behavioral claims above come from actual app operation.
Guessed repository https://api.github.com/repos/valhovey/gaia-mary returned 404. Source/license not established; no app code/assets reused.

## Interstellarmap source inspected

https://github.com/kevinsutjijadi/interstellarmap ; maintainer kevinsutjijadi; inspected commit 1ac9a630956c60fdb9b5b6043652ce119694b412.
License read: https://raw.githubusercontent.com/kevinsutjijadi/interstellarmap/master/LICENSE (MIT). Permits reuse with notice retention; no code copied. Star data is a separate resource and not imported.

Files opened:
- components/canvas/InterstellarScene.tsx: R3F, Drei OrbitControls, damping .06, min/max .5/1e7, distance-dependent zoom speed, optional auto-rotation, grid modes.
- components/canvas/StarsInstanced.tsx: InstancedMesh, picking, physical/display coordinates separated, HTML label projection, bounding-sphere updates.
- components/canvas/useStarData.ts: HYG Cartesian input, parsec/light-year conversion, Y-up mapping, Float32 buffers.
- components/canvas/CameraPositionReporter.tsx: per-frame camera XYZ HUD.
- package.json: Next.js/React Three Fiber/Three.js.

Adopted architectural ideas: coordinate provenance, screen-space labels, explicit picking and coordinate conventions. Not copied: dataset, custom CSV parsing, physical/display coordinate blending, star glyph scaling, travel calculations, full React/Next stack or instancing for 11 points. Its wheel-delta comment was not assumed true for current official controls; current source uses delta magnitude.

## Official APIs and adopted libraries

Documentation: https://threejs.org/docs/pages/OrbitControls.html
Source: https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/OrbitControls.js
License: https://raw.githubusercontent.com/mrdoob/three.js/master/LICENSE

Read upstream and actual installed Three.js 0.186.1 source:
- target is orbit center; getDistance() is camera.position.distanceTo(target).
- dollyIn(scale)/dollyOut(scale) are public wrappers in this installed version.
- Perspective wheel changes radius/camera position; orthographic handling changes zoom.
- Wheel factor: pow(.95, zoomSpeed * abs(delta * .01)); controls also normalize deltaMode.
- minDistance/maxDistance clamp radius. Prototype: .25/90 scene units.
- enableDamping/dampingFactor damp angular/pan deltas; update() required. No separate wheel-inertia claim.
- Prototype: fixed perspective FOV 50, enablePan=false, zoomToCursor=false, dampingFactor=.07.

| Package/source | Pinned version | License | Use |
| --- | --- | --- | --- |
| https://github.com/mrdoob/three.js | 0.186.1 | MIT | Scene, Mesh point glyphs, BufferGeometry/Line, reference rings, Raycaster, Vector3.project, official OrbitControls |
| https://github.com/lucide-icons/lucide | 1.52.0 | ISC + MIT notices for specified Feather-derived icons | Tool icons |
| https://github.com/vitejs/vite | 8.3.2 | MIT | Dev server/build |
| https://github.com/microsoft/playwright | 1.63.0 | Apache-2.0 | Reference operation/browser tests only |
| https://github.com/pngjs/pngjs | 7.0.0 | MIT | Screenshot pixel validation only |

Installed license originals read and saved in public/licenses/; production build includes dist/licenses/. Exact versions/integrity are in package-lock.json. See THIRD_PARTY_NOTICES.md. No external app logic copied. Numeric riskScore comes from user-supplied code; strict input checks added while valid numeric results are compared with original generator.

## Decision and Phase 2

Plain JavaScript + Three.js + official OrbitControls; 11 Mesh glyphs for explicit identity/picking, BufferGeometry measurement segments. No performance need for instancing/custom controller. Screen labels are HTML, not numeric data points. Phase 1 offers immediate focus, fit-all and reference views.

Phase 2: cancellable camera+target interpolation, projected label separation, information visibility thresholds, multi-scale navigation. Apply NASA field/target/detail hierarchy and Hail Mary presets with independently measured observation distance. Do not claim NASA's unverified FOV, limits, damping or LOD as known.
# Observation-system follow-up / 2026-10-05

The entire supplied astronomy text was reread from the previously retrieved PC
PostView HTML. All 30 unique static diagrams were inspected again. Four embedded
video/GIF sources were loaded and reviewed via temporal samples, not exhaustive
frame-by-frame viewing. See research/astronomy-review.md and astronomy-motion-review.json.

- https://m.blog.naver.com/guhwang/220669127979
- https://blog.naver.com/PostView.naver?blogId=guhwang&logNo=220669127979&redirect=Dlog&widgetTypeCall=true&directAccess=false
- https://docs.astropy.org/en/stable/coordinates/transforming.html
- https://docs.astropy.org/en/stable/api/astropy.coordinates.AltAz.html

Astropy official documentation was checked for frames/representations and actual
AltAz observer attributes. No Astropy code is used. The blog supplies concepts,
not a verified environmental/astronomical implementation specification. No article
text/images or animation assets are bundled in the app.

Decision: immutable state + observer frame + derived projected view, detailed in
OBSERVATION_SYSTEM.md. Existing Three.js MIT APIs (Vector3, camera matrices, official
OrbitControls dollyIn/dollyOut) implement it. No new dependency/copied third-party
logic, no NASA bundle copying. NASA observations above remain the prior actual
interaction record; no additional NASA behavior is claimed this turn.
