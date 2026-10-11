import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Maximize, Scan, Crosshair, Download, Compass, Eye, EyeOff, X } from 'lucide';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import source from '../audit/planetary-boundaries.source.json';
import existingAudit from '../audit/controls.json';
import climateSeed from './climate-field.generated.json';
import atlasManifest from './atlas-manifest.generated.json';
import { loadDataset } from './atlas-data.js';
import { createClimateLayer } from './climate-layer.js';
import { parseData } from './data.js';
import { spatialize, validatePosition, GPU_TOLERANCE } from './spatial.js';
import { deepFreeze, observe, wheelDistance, MIN_OBSERVATION_DISTANCE, MAX_OBSERVATION_DISTANCE } from './observation.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n === null || n === undefined ? 'NOT QUANTIFIED' : String(Number(Number(n).toPrecision(10)));
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shortNames = ['CLIMATE', 'BIOSPHERE', 'LAND SYSTEM', 'FRESHWATER', 'BIOGEOCHEMICAL', 'OCEAN', 'AEROSOLS', 'OZONE', 'NOVEL ENTITIES'];
const controlCodes = {
  co2: 'CO2', 'radiative-forcing': 'RF', hanpp: 'HANPP', 'forest-cover': 'FOREST',
  'blue-water': 'BLUE H2O', 'green-water': 'GREEN H2O', phosphorus: 'P', nitrogen: 'N',
  'aragonite-saturation': 'ARAG', 'aod-difference': 'AOD', ozone: 'O3',
};
const groups = deepFreeze(spatialize(parseData(source)));
const fixedState = JSON.stringify(groups);
const controlsData = groups.flatMap((group) => group.controls);
const quantitative = controlsData.filter((control) => control.r !== null);
for (const control of quantitative) {
  const recorded = existingAudit.controls.find((entry) => entry.chapter_id === control.groupId && entry.source_variable.id === control.id);
  if (control.r.toFixed(4) !== recorded?.existing_svg_marker?.score_text) throw new Error(`${control.id}: source score mismatch`);
}

let selected = quantitative[0];
let overview = false;
let overviewReady = false;
let overviewError = null;
const overviewLayers = new Map();
let selectedGroup = groups[0];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  // Keep the canvas background at true black regardless of browser alpha or
  // compositing behavior; the only visible lift should come from the scene.
  renderer.setClearColor(0x000000, 1);
} catch (error) {
  $('webgl-error').hidden = false;
  $('webgl-error').textContent = `WebGL unavailable: ${error.message}`;
  $('validation-status').textContent = 'RENDERER ERROR';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.setAttribute('aria-label', 'Planetary boundary quantitative points and reference shells');
$('scene').append(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.enablePan = false;
orbit.zoomToCursor = false;
orbit.minDistance = MIN_OBSERVATION_DISTANCE;
orbit.maxDistance = MAX_OBSERVATION_DISTANCE;
orbit.zoomSpeed = 1;
orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
orbit.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
orbit.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  cancelFocus();
  const current = orbit.getDistance();
  const next = wheelDistance(current, event.deltaY, event.deltaMode, renderer.domElement.clientHeight, orbit.minDistance, orbit.maxDistance);
  if (next < current) orbit.dollyIn(next / current);
  else if (next > current) orbit.dollyOut(current / next);
}, { capture: true, passive: false });
const dataRoot = new THREE.Group();
scene.add(dataRoot);
const linesRoot = new THREE.Group();
dataRoot.add(linesRoot);
let climateField = climateSeed;
let datasetFull = null;
let inspectedRecord = null;
let datasetRequest = 0;
let datasetError = null;
const datasetMemory = new Map();
const metadataById = new Map(atlasManifest.datasets.map((item) => [item.id, item]));
const climate = createClimateLayer(climateField, groups[0].direction, scene, $('labels'));
const meshes = new Map();
const lines = new Map();
const colorFor = () => 0xf4f0e9;
const lineColorFor = () => 0x77716b;
// Keep the dark observatory background while bringing the data signals closer
// to the bright, pixel-lit reference image.
const lightOpacityFor = (r) => r > 2 ? 0.82 : r > 1 ? 0.64 : 0.38;
const glyph = new THREE.SphereGeometry(0.047, 16, 12);

function rasterSignalTexture({ core, middle, outer }) {
  const size = 17;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const toRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const colors = [toRgb(core), toRgb(middle), toRgb(outer)];
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(x - 8, y - 8);
    const band = radius < 2.15 ? 0 : radius < 4.2 ? 1 : 2;
    const uneven = ((x * 3 + y * 5) % 4) === 0 ? 0.72 : 1;
    const alpha = radius < 2.15 ? 255 : radius < 4.2 ? 214 : radius < 6.7 ? Math.round(112 * uneven) : 0;
    const offset = (y * size + x) * 4;
    image.data[offset] = colors[band][0];
    image.data[offset + 1] = colors[band][1];
    image.data[offset + 2] = colors[band][2];
    image.data[offset + 3] = alpha;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}
const whiteSignal = rasterSignalTexture({ core: '#ffffff', middle: '#c9c4bc', outer: '#5b504a' });
const redSignal = rasterSignalTexture({ core: '#fff3ec', middle: '#ed4138', outer: '#681815' });
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 64;
const glowContext = glowCanvas.getContext('2d');
const glowGradient = glowContext.createRadialGradient(32, 32, 2, 32, 32, 32);
glowGradient.addColorStop(0, 'rgba(255,111,91,.76)');
glowGradient.addColorStop(.24, 'rgba(226,43,34,.36)');
glowGradient.addColorStop(1, 'rgba(226,43,34,0)');
glowContext.fillStyle = glowGradient;
glowContext.fillRect(0, 0, 64, 64);
const redGlow = new THREE.CanvasTexture(glowCanvas);

for (const control of quantitative) {
  // Keep the existing pickable node geometry, but let the raster sprite carry the visible light.
  const point = new THREE.Mesh(glyph, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  point.position.fromArray(control.position);
  point.userData.controlId = control.id;
  point.userData.baseColor = colorFor(control.r);
  const signal = new THREE.Sprite(new THREE.SpriteMaterial({
    map: whiteSignal,
    transparent: true,
    opacity: lightOpacityFor(control.r),
    depthTest: false,
    depthWrite: false,
  }));
  signal.userData.controlId = control.id;
  signal.userData.baseMap = whiteSignal;
  signal.userData.baseOpacity = lightOpacityFor(control.r);
  signal.renderOrder = 4;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: redGlow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  glow.renderOrder = 3;
  point.userData.glow = glow;
  point.userData.signal = signal;
  point.add(glow, signal);
  dataRoot.add(point);
  meshes.set(control.id, point);
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...control.position)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: lineColorFor(control.r), transparent: true, opacity: 0.3 }));
  linesRoot.add(line);
  lines.set(control.id, line);
}

const relatedLinks = new Map();
for (const group of groups) {
  const members = group.controls.filter((control) => control.position);
  if (members.length < 2) continue;
  const geometry = new THREE.BufferGeometry().setFromPoints(members.map((control) => new THREE.Vector3(...control.position)));
  const link = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xf05a4d, transparent: true, opacity: .82, depthWrite: false }));
  link.visible = false;
  link.renderOrder = 5;
  scene.add(link);
  relatedLinks.set(group.id, link);
}
const climateMembers = groups[0].controls.filter((control) => control.position);
const climateMidpoint = climateMembers.reduce((sum, control) => sum.add(new THREE.Vector3(...control.position)), new THREE.Vector3()).divideScalar(climateMembers.length);
const climateChapterLink = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([climateMidpoint, climate.root.position]),
  new THREE.LineDashedMaterial({ color: 0xd4473e, transparent: true, opacity: .48, dashSize: .075, gapSize: .055, depthWrite: false }),
);
climateChapterLink.computeLineDistances();
climateChapterLink.visible = false;
scene.add(climateChapterLink);

// Each quantitative control gets an origin-centered circle whose radius is its
// actual unified distance. Angle zero is the node itself, so the circle passes
// exactly through the rendered data position.
const riskOrbitsRoot = new THREE.Group();
scene.add(riskOrbitsRoot);
const riskOrbits = new Map();
for (const control of quantitative) {
  const direction = new THREE.Vector3(...control.position).normalize();
  const referenceAxis = Math.abs(direction.y) > 0.88 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(referenceAxis, direction).normalize();
  const points = Array.from({ length: 128 }, (_, index) => {
    const angle = index / 128 * Math.PI * 2;
    return direction.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent, Math.sin(angle)).multiplyScalar(control.r);
  });
  const orbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    // Orbit guides carry most of the central volume. Keep them crisp enough
    // to read through overlaps while preserving the dark negative space.
    new THREE.LineBasicMaterial({ color: 0x9a3b34, transparent: true, opacity: 0.34 }),
  );
  orbitLine.userData.controlId = control.id;
  orbitLine.userData.groupId = control.groupId;
  orbitLine.userData.r = control.r;
  orbitLine.renderOrder = 1;
  riskOrbitsRoot.add(orbitLine);
  riskOrbits.set(control.id, orbitLine);
}

// These are navigation references only. They carry no environmental values.
const referencePlane = new THREE.GridHelper(7, 14, 0x4b3935, 0x241816);
referencePlane.position.set(0, -1.05, 0);
referencePlane.rotation.set(-0.34, 0.18, 0.12);
referencePlane.material.transparent = true;
referencePlane.material.opacity = 0.32;
referencePlane.renderOrder = 1;
scene.add(referencePlane);

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];
const starColors = [];
let starSeed = 0x1a96;
const random = () => {
  starSeed = (starSeed * 1664525 + 1013904223) >>> 0;
  return starSeed / 0x100000000;
};
for (let i = 0; i < 420; i++) {
  const radius = 11 + random() * 44;
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const spread = Math.sqrt(1 - z * z);
  starPositions.push(radius * spread * Math.cos(angle), radius * z, radius * spread * Math.sin(angle));
  const brightness = 0.55 + random() * 0.45;
  const warm = random() > 0.84;
  starColors.push(brightness, warm ? brightness * 0.78 : brightness, warm ? brightness * 0.68 : brightness * 0.96);
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
const starField = new THREE.Points(starGeometry, new THREE.PointsMaterial({
  size: 0.034,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.94,
  depthWrite: false,
}));
starField.renderOrder = -1;
scene.add(starField);

// The origin remains a mathematical anchor for validation, never a visible node.
const origin = new THREE.Object3D();
scene.add(origin);
const referenceGeometry = [];
function shell(radius, color) {
  const root = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.66 });
  function addCircle(points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    root.add(new THREE.LineLoop(geometry, material));
    referenceGeometry.push({ radius, geometry });
  }
  for (let meridian = 0; meridian < 6; meridian++) {
    const azimuth = meridian * Math.PI / 6;
    addCircle(Array.from({ length: 160 }, (_, i) => {
      const a = i / 160 * Math.PI * 2;
      return new THREE.Vector3(radius * Math.sin(a) * Math.sin(azimuth), radius * Math.cos(a), radius * Math.sin(a) * Math.cos(azimuth));
    }));
  }
  for (const latitude of [-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3]) {
    addCircle(Array.from({ length: 160 }, (_, i) => {
      const a = i / 160 * Math.PI * 2;
      return new THREE.Vector3(radius * Math.cos(latitude) * Math.sin(a), radius * Math.sin(latitude), radius * Math.cos(latitude) * Math.cos(a));
    }));
  }
  scene.add(root);
  return root;
}
const pbShell = shell(1, 0xb0a79b);
const hrShell = shell(2, 0xe34a3d);
const selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.078, 0.087, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false }));
selectionRing.renderOrder = 10;
scene.add(selectionRing);

const groupLabels = new Map();
for (const [index, group] of groups.entries()) {
  const wrapper = document.createElement('section');
  wrapper.className = 'group';
  const title = document.createElement('button');
  title.className = 'group-title';
  title.dataset.group = group.id;
  title.innerHTML = `<span class="number">${String(group.order).padStart(2, '0')}</span><span>${escape(group.name)}</span>`;
  title.addEventListener('click', () => { select(null, group); focusGroup(group); });
  wrapper.append(title);
  for (const control of group.controls) {
    const button = document.createElement('button');
    button.className = `control ${control.r === null ? 'nq' : ''}`;
    button.dataset.control = control.id;
    button.innerHTML = `<span class="name">${escape(control.raw.control_label)}</span><span class="value">${control.r === null ? 'NQ' : control.r.toFixed(4)}</span>`;
    button.addEventListener('click', () => { select(control, group); focusSelected(); closeIndex(); });
    wrapper.append(button);
  }
  $('group-list').append(wrapper);
  const label = document.createElement('button');
  const nq = group.controls.filter((control) => control.r === null).length;
  label.className = `group-label ${nq ? 'nq' : ''}`;
  label.title = 'Boundary direction label; layout anchor only, no representative data radius';
  label.innerHTML = `${String(group.order).padStart(2, '0')} ${shortNames[index]}${nq ? `<small>${nq} NOT QUANTIFIED</small>` : ''}`;
  label.addEventListener('click', () => { select(null, group); focusGroup(group); });
  $('labels').append(label);
  groupLabels.set(group.id, label);
}
const indexNav = $('boundaries');
const indexTrigger = $('index-trigger');
function closeIndex() {
  indexNav.classList.remove('open');
  indexTrigger.setAttribute('aria-expanded', 'false');
  if (indexNav.contains(document.activeElement)) document.activeElement.blur();
}
indexTrigger.addEventListener('click', () => {
  const open = !indexNav.classList.contains('open');
  indexNav.classList.toggle('open', open);
  indexTrigger.setAttribute('aria-expanded', String(open));
});
document.addEventListener('pointerdown', (event) => {
  if (!indexNav.contains(event.target)) closeIndex();
});
indexNav.addEventListener('mouseleave', () => {
  if (!indexNav.matches(':focus-within')) closeIndex();
});
document.querySelectorAll('.group-title').forEach((button) => button.addEventListener('click', closeIndex));
const readoutTrigger = $('readout-trigger');
readoutTrigger.addEventListener('click', () => {
  const open = $('observer-controls').hidden;
  $('observer-controls').hidden = !open;
  readoutTrigger.setAttribute('aria-expanded', String(open));
});
const pointLabel = document.createElement('div');
pointLabel.className = 'point-label';
$('labels').append(pointLabel);

function fields(rows) {
  return `<dl class="fields">${rows.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value ?? 'NOT QUANTIFIED')}</dd></div>`).join('')}</dl>`;
}

const codeFor = (control) => controlCodes[control?.id] ?? control?.id?.toUpperCase() ?? shortNames[selectedGroup.order - 1];
const instrumentNumber = (value) => {
  const fixed = Number(value).toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed.startsWith('-0.') ? `-${fixed.slice(2)}` : fixed;
};
const angleNumber = (value) => value === null || value === undefined ? '--' : `${instrumentNumber(value)} DEG`;
const observerValue = (value) => value === null || value === undefined ? '--' : instrumentNumber(value);

function selectedObservation() {
  const report = observationReport();
  const point = report.points.find((entry) => entry.id === selected?.id) ?? null;
  return { report, point };
}

function observerRows({ point, report }) {
  const axis = report.basis.z;
  const frameName = selectedGroup ? shortNames[selectedGroup.order - 1] : 'GROUP AXIS';
  if (!selected || selected.r === null || !point) {
    return `<div class="observer-grid">
      <div class="observer-row fixed"><span>STATE</span><span>${selected ? 'NOT QUANTIFIED / NO XYZ' : 'GROUP DIRECTION ONLY'}</span></div>
      <div class="observer-row derived"><span>FRAME</span><span>${escape(frameName)} / AXIS ${axis.map(observerValue).join(' ')}</span></div>
      <div class="observer-row derived"><span>PROJECTED</span><span>NO POINT PROJECTION</span></div>
    </div>`;
  }
  const [lx, ly, lz] = point.axisCoordinates;
  const screen = point.projection?.screen;
  return `<div class="observer-grid">
    <div class="observer-row fixed"><span>DATA STATE</span><span>R ${instrumentNumber(selected.r)} / WORLD XYZ FIXED</span></div>
    <div class="observer-row derived"><span>LOCAL FRAME</span><span>${escape(frameName)} / X ${instrumentNumber(lx)} Y ${instrumentNumber(ly)} Z ${instrumentNumber(lz)}</span></div>
    <div class="observer-row derived"><span>AXIS ANGLE</span><span>${angleNumber(point.axisAngle)} / CHANGES WITH REFERENCE AXIS</span></div>
    <div class="observer-row derived"><span>SIGHTLINE</span><span>BEARING ${angleNumber(point.bearing)} / ELEV ${angleNumber(point.elevation)}</span></div>
    <div class="observer-row derived"><span>DEPTH</span><span>${observerValue(point.projection?.depth)} / CAMERA IMAGE PLANE</span></div>
    <div class="observer-row derived"><span>SCREEN</span><span>${screen ? `X ${observerValue(screen[0])} Y ${observerValue(screen[1])}` : 'OUT OF VIEW'} / CSS PX</span></div>
    <div class="observer-row derived"><span>OVERLAP</span><span>${point.overlapIds.length ? point.overlapIds.map((id) => codeFor(controlsData.find((control) => control.id === id))).join(', ') : 'NONE'}</span></div>
  </div>`;
}

function updateInstrument() {
  $('read-status').textContent = 'DATA READY';
  $('read-status').classList.remove('reading');
  if (inspectedRecord) { inspectCountry(inspectedRecord); return; }
  const localStatus = hasLocalData(selectedGroup) ? `${atlasManifest.boundaries[selectedGroup.id].datasets.length} SOURCE DATASETS` : 'NO LOCAL SOURCE';
  if (!selected || selected.r === null) {
    const code = selected ? codeFor(selected) : shortNames[selectedGroup.order - 1];
    $('panel-reference').textContent = `REFERENCE / ${code}`;
    $('reference-content').innerHTML = `<div class="reference-code">${escape(code)}</div><div class="reference-name">${escape(selected?.raw.control_label ?? selectedGroup.name)}</div><div class="reference-vector">X / UNDEFINED<br>Y / UNDEFINED<br>Z / UNDEFINED<br>R / ${selected ? 'NOT QUANTIFIED' : 'NO GROUP AGGREGATE'}</div>`;
    $('distance-list').innerHTML = '<div class="distance-row"><span class="distance-code">NO NUMERIC REFERENCE</span><span class="distance-value">--</span></div>';
    $('distance-count').textContent = '0 DISTANCES / REFERENCE HAS NO XYZ';
    $('relation-content').innerHTML = `<div class="relation-row"><span>GROUP</span><span>${escape(selectedGroup.name.toUpperCase())}</span></div><div class="relation-row"><span>ANALYTICAL</span><span>${localStatus}</span></div>`;
    $('observer-content').innerHTML = observerRows(selectedObservation());
    inspect();
    return;
  }

  const [x, y, z] = selected.position;
  $('panel-reference').textContent = `REFERENCE / ${codeFor(selected)}`;
  $('reference-content').innerHTML = `<div class="reference-code">${escape(codeFor(selected))}</div><div class="reference-name">${escape(selected.raw.control_label)} / ${escape(selectedGroup.name)}</div><div class="reference-vector">X / ${instrumentNumber(x)}<br>Y / ${instrumentNumber(y)}<br>Z / ${instrumentNumber(z)}<br>R / ${instrumentNumber(selected.r)}</div>`;
  const distances = quantitative
    .filter((control) => control.id !== selected.id)
    .map((control) => ({ control, distance: new THREE.Vector3(...control.position).distanceTo(new THREE.Vector3(...selected.position)) }))
    .sort((a, b) => a.distance - b.distance);
  $('distance-list').innerHTML = distances.map(({ control, distance }) => `<div class="distance-row ${control.groupId === selected.groupId ? 'same-group' : ''}"><span class="distance-code">${escape(codeFor(control))}</span><span class="distance-value">DIST ${instrumentNumber(distance)}</span></div>`).join('');
  $('distance-count').textContent = `${distances.length} OBSERVATIONS / SELECTED NODE EXCLUDED`;
  const peers = controlsData.filter((control) => control.groupId === selected.groupId && control.id !== selected.id).map(codeFor);
  $('relation-content').innerHTML = `<div class="relation-row"><span>MEASURE</span><span>ORIGIN -> ${escape(codeFor(selected))} / R ${instrumentNumber(selected.r)}</span></div><div class="relation-row"><span>CONTROL</span><span>${escape(selectedGroup.name.toUpperCase())}</span></div><div class="relation-row"><span>PEER</span><span>${escape(peers.join(', ') || 'NONE')}</span></div><div class="relation-row"><span>ANALYTICAL</span><span>${localStatus}</span></div>`;
  $('observer-content').innerHTML = observerRows(selectedObservation());
  inspect();
}

let readTimer = null;
function scheduleInstrumentRead() {
  clearTimeout(readTimer);
  $('read-status').textContent = 'READING DATA...';
  $('read-status').classList.remove('reading');
  void $('read-status').offsetWidth;
  $('read-status').classList.add('reading');
  readTimer = setTimeout(updateInstrument, 200);
}

function inspect() {
  if (!selected) {
    const nq = selectedGroup.controls.filter((c) => c.r === null).length;
    $('inspect-content').innerHTML = `<div class="state ${nq ? 'nq' : ''}">BOUNDARY GROUP${nq ? ' / NOT QUANTIFIED STATE PRESENT' : ''}</div><h3>${escape(selectedGroup.name)}</h3>${fields([
      ['BOUNDARY', selectedGroup.nameKo], ['CONTROL VARIABLES', selectedGroup.controls.length],
      ['QUANTITATIVE POINTS', selectedGroup.controls.length - nq], ['NOT QUANTIFIED', nq],
      ['REPRESENTATIVE R', 'NOT ASSIGNED'], ['GROUP THETA (rad)', fmt(selectedGroup.theta)],
      ['GROUP PHI (rad)', fmt(selectedGroup.phi)], ['DIRECTION X', fmt(selectedGroup.direction[0])],
      ['DIRECTION Y', fmt(selectedGroup.direction[1])], ['DIRECTION Z', fmt(selectedGroup.direction[2])],
      ['DIRECTION LENGTH', fmt(Math.hypot(...selectedGroup.direction))], ['ANGLE MEANING', 'SPATIAL LAYOUT ONLY'],
      ['R ORBITS', 'ONE PER QUANTIFIED CONTROL'],
    ])}<div class="note">No boundary aggregate. Every orbit radius comes from its control variable; not-quantified controls have no orbit.</div>`;
    return;
  }
  const raw = selected.raw;
  const quantitativeState = selected.r !== null;
  const row = liveValidation().points.find((p) => p.id === selected.id);
  $('inspect-content').innerHTML = `<div class="state ${quantitativeState ? '' : 'nq'}">${escape(selected.state)}</div><h3>${escape(raw.control_label)}</h3><div class="big-value ${quantitativeState ? '' : 'nq'}">${quantitativeState ? selected.r.toFixed(6) : 'NOT QUANTIFIED'}</div><div class="value-caption">${quantitativeState ? 'DATA DISTANCE / UNIFIED RISK SCORE' : escape(raw.label)}</div>${fields([
    ['BOUNDARY', selectedGroup.name], ['INDICATOR', raw.control_label], ['RAW VALUE', raw.current],
    ['UNIT', raw.unit], ['BASELINE', raw.baseline], ['PLANETARY BOUNDARY', raw.boundary], ['HIGH RISK', raw.high_risk],
    ['RISK DIRECTION', raw.direction === 'higher_is_worse' ? 'increase-is-risk' : 'decrease-is-risk'],
    ['UNIFIED DISTANCE', fmt(selected.r)], ['R', fmt(selected.r)], ['THETA (rad)', fmt(selected.theta)],
    ['PHI (rad)', fmt(selected.phi)], ['X', fmt(selected.position?.[0])], ['Y', fmt(selected.position?.[1])], ['Z', fmt(selected.position?.[2])],
    ['ANGLE MEANING', 'SPATIAL LAYOUT ONLY'], ['OFFSET (degrees)', (selected.offset * 180 / Math.PI).toFixed(1)],
    ['R ORBIT RADIUS', quantitativeState ? fmt(selected.r) : 'NOT QUANTIFIED / ABSENT'],
    ['DATA STATUS', raw.data_status],
  ])}<div id="point-check" class="check ${quantitativeState ? '' : 'nq'} ${row?.status === 'FAIL' ? 'fail' : ''}">${quantitativeState ? `WORLD |position| = ${fmt(row.length)}<br>POINT ERROR = ${row.error.toExponential(3)}<br>ORBIT RADIUS ERROR = ${row.orbitRadiusError.toExponential(3)}<br>ORBIT/NODE ERROR = ${row.orbitNodeError.toExponential(3)}<br>${row.status} / POINT + LINE + ORBIT` : 'NOT QUANTIFIED<br>R / XYZ / measurement line / orbit: absent'}</div>${!quantitativeState ? `<div class="note">${raw.qualitative_position ? 'Beyond high risk is qualitative. The legacy category marker 3 is not used as a radius.' : 'Current and high-risk threshold are unresolved. No numerical position is assigned.'}</div>` : ''}<div class="sources">${raw.source_ids.map((id) => {
    const item = source.meta.sources.find((s) => s.id === id);
    return `<a href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(id)}</a>`;
  }).join('')}</div>`;
}

function hasLocalData(group) { return Boolean(atlasManifest.boundaries[group.id]?.datasets.length); }

function refreshField(data) {
  climateField = data;
  climate.setData(data, selectedGroup.direction, shortNames[selectedGroup.order - 1]);
  climate.root.visible = data.observations.length > 0;
  climate.activate(data.observations.length > 0);
  $('climate-scale').value = data.defaultMode;
  $('climate-scale').disabled = !data.observations.length;
  $('climate-scale').querySelector('[value="log"]').disabled = !data.logAvailable;
  $('climate-surface').disabled = !climate.canSurface;
  $('climate-surface').checked = false;
  climate.setSurface(false);
  $('local-count').textContent = `${data.observations.length.toLocaleString('en')} OBSERVATIONS / ${data.records.length.toLocaleString('en')} SOURCE ROWS${data.kind === 'records' ? ' / READING RECORDS' : data.omittedCount ? ` / ${data.omittedCount} WITHOUT COORDINATES` : ''}`;
  $('local-axes').textContent = data.axes.length ? data.axes.map((axis, i) => `${'XYZ'[i]} / ${axis}`).join('  |  ') : data.mappingReason;
  $('local-shared').textContent = data.boundaries.length > 1 ? `SHARED / ${data.boundaries.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(' / ')}` : data.mappingReason;
  const members = selectedGroup.controls.filter((control) => control.position);
  if (members.length && data.observations.length) {
    const start = members.reduce((sum, control) => sum.add(new THREE.Vector3(...control.position)), new THREE.Vector3()).divideScalar(members.length);
    climateChapterLink.geometry.dispose();
    climateChapterLink.geometry = new THREE.BufferGeometry().setFromPoints([start, climate.root.position]);
    climateChapterLink.computeLineDistances();
  }
  climateChapterLink.visible = Boolean(members.length && data.observations.length);
}

async function openDataset(id) {
  const request = ++datasetRequest;
  const groupId = selectedGroup.id;
  inspectedRecord = null; datasetError = null; datasetFull = null;
  climate.activate(false); climate.root.visible = false; climateChapterLink.visible = false;
  $('local-count').textContent = 'READING DATA...';
  $('local-axes').textContent = ''; $('local-shared').textContent = '';
  $('entity-filter').disabled = true; $('source-record').disabled = true;
  $('climate-scale').disabled = true; $('climate-surface').disabled = true;
  $('inspector').hidden = true;
  try {
    const data = await loadDataset(metadataById.get(id));
    if (request !== datasetRequest || selectedGroup.id !== groupId) return;
    datasetFull = data;
    datasetMemory.set(groupId, id);
    $('entity-filter').replaceChildren(new Option('ALL ENTITIES', ''));
    if (data.kind !== 'records') for (const entity of data.entities) $('entity-filter').add(new Option(entity, entity));
    $('entity-filter').disabled = data.kind === 'records';
    $('source-record').disabled = !data.records.length;
    $('source-record').min = '2'; $('source-record').max = String(data.records.length + 1); $('source-record').value = '2';
    refreshField(data);
    if (data.kind === 'records' && data.records.length) {
      clearTimeout(readTimer);
      inspectedRecord = data.records[0]; $('inspector').hidden = false; inspectCountry(inspectedRecord);
    }
  } catch (error) {
    if (request !== datasetRequest) return;
    datasetError = error.message;
    $('local-count').textContent = `LOAD FAILED / ${error.message}`;
  }
}

function openBoundary(group) {
  ++datasetRequest;
  datasetFull = null; inspectedRecord = null; datasetError = null;
  climate.activate(false); climate.root.visible = false; climate.root.position.fromArray(group.direction).multiplyScalar(3.5);
  climateChapterLink.visible = false;
  $('local-field').hidden = false;
  $('local-title').textContent = `${shortNames[group.order - 1]} / LOCAL ANALYSIS`;
  const boundary = atlasManifest.boundaries[group.id];
  $('dataset-select').replaceChildren();
  $('local-count').textContent = boundary.datasets.length ? 'READING DATA...' : 'NO CORRESPONDING LOCAL DATA';
  $('local-axes').textContent = boundary.reason ?? '';
  $('local-shared').textContent = '';
  $('dataset-select').disabled = !boundary.datasets.length;
  $('entity-filter').replaceChildren(new Option('ALL ENTITIES', ''));
  for (const id of ['entity-filter', 'source-record', 'climate-scale', 'climate-surface']) $(id).disabled = true;
  const roles = ['analysis', 'processed', 'history', 'statistics', 'red-points', 'relations', 'summary'];
  for (const role of roles) {
    const entries = boundary.datasets.map((id) => metadataById.get(id)).filter((item) => item.role === role);
    if (!entries.length) continue;
    const optgroup = document.createElement('optgroup'); optgroup.label = role.toUpperCase();
    for (const item of entries) optgroup.append(new Option(`${item.title} / ${item.rowCount.toLocaleString('en')}`, item.id));
    $('dataset-select').append(optgroup);
  }
  if (boundary.datasets.length) {
    const id = datasetMemory.get(group.id) ?? boundary.default;
    $('dataset-select').value = id;
    void openDataset(id);
  }
}

function select(control, group, { openPanel = true } = {}) {
  overview = false;
  for (const layer of overviewLayers.values()) layer.root.visible = false;
  $('align-group').disabled = false;
  selected = control; selectedGroup = group;
  if (openPanel) openBoundary(group);
  climate.select(-1);
  $('risk-ruler').hidden = !hasLocalData(group) || control?.r == null;
  if (hasLocalData(group) && control?.r != null) {
    $('risk-value').textContent = `${codeFor(control)} / R ${control.r.toFixed(3)}`;
    $('risk-mark').style.bottom = `${control.r * 24}px`;
    $('risk-stem').style.height = `${control.r * 24}px`;
    document.querySelector('.risk-scale').style.height = `${Math.max(120, control.r * 24)}px`;
  }
  if (openPanel) $('inspector').hidden = hasLocalData(group);
  $('hover-label').hidden = true;
  document.querySelectorAll('[data-control]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.control === selected?.id)));
  document.querySelectorAll('[data-group]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.group === group.id)));
  for (const [id, line] of lines) {
    const active = id === control?.id;
    line.material.color.setHex(active ? 0xdf3d35 : lineColorFor());
    line.material.opacity = active ? 0.82 : 0.3;
  }
  for (const [id, orbitLine] of riskOrbits) {
    const active = id === control?.id;
    const groupActive = orbitLine.userData.groupId === group.id;
    orbitLine.material.color.setHex(active ? 0xdf3d35 : groupActive ? 0xb5afa8 : 0x817b75);
    orbitLine.material.opacity = active ? 0.86 : groupActive ? 0.5 : 0.34;
  }
  for (const [id, point] of meshes) {
    const active = id === control?.id;
    const related = group.controls.some((entry) => entry.id === id);
    point.material.color.setHex(active ? 0xf0443a : point.userData.baseColor);
    const signal = point.userData.signal;
    signal.material.map = related ? redSignal : signal.userData.baseMap;
    signal.material.opacity = active ? .82 : related ? .58 : signal.userData.baseOpacity;
    signal.material.needsUpdate = true;
    point.userData.glow.material.opacity = active ? .82 : related ? .5 : 0;
  }
  for (const [id, link] of relatedLinks) link.visible = id === group.id;
  climateChapterLink.visible = climate.active;
  for (const [id, label] of groupLabels) label.classList.toggle('selected', id === group.id);
  $('focus').disabled = !hasLocalData(group) && (!control || control.r === null);
  $('scene-selection').textContent = control ? `${control.raw.control_label.toUpperCase()}${control.r === null ? ' / NOT QUANTIFIED' : ''}` : `${shortNames[group.order - 1]} / GROUP DIRECTION`;
  scheduleInstrumentRead();
}

function liveValidation() {
  scene.updateMatrixWorld(true);
  const originPosition = origin.getWorldPosition(new THREE.Vector3());
  const points = controlsData.map((control) => {
    if (control.r === null) return { id: control.id, groupId: control.groupId, r: null, position: null, status: 'NOT QUANTIFIED' };
    const world = meshes.get(control.id).getWorldPosition(new THREE.Vector3()).sub(originPosition);
    const cpu = validatePosition(world.toArray(), control.r);
    const fixedCoordinateError = world.distanceTo(new THREE.Vector3(...control.position));
    const line = lines.get(control.id);
    const attribute = line.geometry.getAttribute('position');
    const start = new THREE.Vector3().fromBufferAttribute(attribute, 0).applyMatrix4(line.matrixWorld).sub(originPosition);
    const endpoint = new THREE.Vector3().fromBufferAttribute(attribute, 1).applyMatrix4(line.matrixWorld).sub(originPosition);
    const gpu = validatePosition(endpoint.toArray(), control.r, GPU_TOLERANCE);
    const endpointError = endpoint.distanceTo(world);
    const orbitLine = riskOrbits.get(control.id);
    const orbitAttribute = orbitLine.geometry.getAttribute('position');
    let orbitRadiusError = 0;
    let orbitNodeError = Infinity;
    for (let i = 0; i < orbitAttribute.count; i++) {
      const orbitPoint = new THREE.Vector3().fromBufferAttribute(orbitAttribute, i).applyMatrix4(orbitLine.matrixWorld).sub(originPosition);
      orbitRadiusError = Math.max(orbitRadiusError, Math.abs(orbitPoint.length() - control.r));
      if (i === 0) orbitNodeError = orbitPoint.distanceTo(world);
    }
    return { id: control.id, groupId: control.groupId, r: control.r, theta: control.theta, phi: control.phi, position: world.toArray(), ...cpu,
      gpuError: gpu.error, endpointError, fixedCoordinateError, orbitRadiusError, orbitNodeError, gpuTolerance: gpu.tolerance,
      status: cpu.status === 'PASS' && gpu.status === 'PASS' && fixedCoordinateError < 1e-10 && start.length() < 1e-10 && endpointError <= gpu.tolerance && orbitRadiusError <= gpu.tolerance && orbitNodeError <= gpu.tolerance ? 'PASS' : 'FAIL' };
  });
  return { groups: groups.length, quantitativePoints: quantitative.length, notQuantified: controlsData.length - quantitative.length,
    passed: points.filter((p) => p.status === 'PASS').length,
    failed: points.filter((p) => p.status === 'FAIL').length,
    stateUnchanged: JSON.stringify(groups) === fixedState && points.every((p) => p.r === null || p.fixedCoordinateError < 1e-10),
    observationDistance: orbit.getDistance(), points };
}

const maxRadius = Math.max(...quantitative.map((c) => c.r));
const overviewDirection = new THREE.Vector3(1.3, 0.8, 1.2).normalize();
let focusTransition = null;
function fit(radius = maxRadius) {
  if (climate.active) $('inspector').hidden = true;
  focusTransition = null;
  orbit.enabled = true;
  orbit.enableDamping = false; orbit.update();
  orbit.target.set(0, 0, 0);
  const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  let distance = radius / Math.sin(halfFov) * 1.18;
  if (radius === maxRadius) {
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), overviewDirection).normalize();
    const up = new THREE.Vector3().crossVectors(overviewDirection, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    distance = Math.max(2.5 / Math.sin(halfFov), ...quantitative.map((c) => {
      const p = new THREE.Vector3(...c.position);
      return p.dot(overviewDirection) + Math.max(Math.abs(p.dot(right)) / (tanH * 0.78), Math.abs(p.dot(up)) / (tanV * 0.66)) + 0.8;
    }));
  }
  camera.position.copy(overviewDirection).multiplyScalar(Math.min(85, distance));
  orbit.update(); orbit.enableDamping = $('damping-toggle').checked;
}
async function enterOverview() {
  overview = true; selected = null;
  ++datasetRequest; clearTimeout(readTimer);
  datasetFull = null; inspectedRecord = null;
  climate.activate(false); climate.root.visible = false; climateChapterLink.visible = false;
  for (const id of ['inspector', 'local-field', 'risk-ruler', 'hover-label']) $(id).hidden = true;
  closeIndex();
  $('focus').disabled = true; $('align-group').disabled = true;
  $('scene-selection').textContent = 'SYSTEM OVERVIEW';
  document.querySelectorAll('[data-control], [data-group]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
  for (const label of groupLabels.values()) label.classList.remove('selected');
  for (const link of relatedLinks.values()) link.visible = false;
  for (const line of lines.values()) { line.material.color.setHex(lineColorFor()); line.material.opacity = .3; }
  for (const line of riskOrbits.values()) {
    const exceeded = line.userData.r > 1;
    line.material.color.setHex(exceeded ? 0xdf5148 : 0xc9c4bc);
    line.material.opacity = exceeded ? .56 : .48;
  }
  for (const [id, point] of meshes) {
    const exceeded = quantitative.find(control => control.id === id).r > 1;
    point.material.color.setHex(point.userData.baseColor);
    point.userData.signal.material.map = exceeded ? redSignal : whiteSignal;
    point.userData.signal.material.opacity = exceeded ? .86 : .52;
    point.userData.signal.material.needsUpdate = true;
    point.userData.glow.material.opacity = 0;
  }
  fit();
  try {
    for (const group of groups) {
      const id = atlasManifest.boundaries[group.id].default;
      if (!id) continue;
      if (!overviewLayers.has(group.id)) {
        const data = await loadDataset(metadataById.get(id));
        if (!overviewLayers.has(group.id)) {
          const layer = createClimateLayer(data, group.direction, scene, document.createDocumentFragment());
          layer.setData(data, group.direction, shortNames[group.order - 1]);
          layer.overview = true; layer.activate(true);
          overviewLayers.set(group.id, layer);
        }
      }
      overviewLayers.get(group.id).root.visible = overview;
    }
    overviewReady = true; overviewError = null;
  } catch (error) {
    overviewError = error.message;
    if (overview) $('scene-selection').textContent = `OVERVIEW LOAD FAILED / ${error.message}`;
  }
}
$('fit').addEventListener('click', () => void enterOverview());
$('save-image').addEventListener('click', () => {
  const ratio = renderer.getPixelRatio();
  const exportRatio = 3840 / width;
  try {
    renderer.setPixelRatio(exportRatio);
    climate.update(performance.now(), camera, width, height, exportRatio, width);
    for (const layer of overviewLayers.values()) layer.update(performance.now(), camera, width, height, exportRatio, width);
    positionSignalLights(); renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = 'planetary-data-atlas-4k.png';
    link.href = renderer.domElement.toDataURL('image/png'); link.click();
  } finally {
    renderer.setPixelRatio(ratio);
    climate.update(performance.now(), camera, width, height, ratio, width);
    for (const layer of overviewLayers.values()) layer.update(performance.now(), camera, width, height, ratio, width);
  }
});
$('reference-view').addEventListener('click', () => fit(2.7));
function focusSelected() {
  if (hasLocalData(selectedGroup)) { focusAt(climate.root.position.clone(), 6.8); return; }
  if (!selected || selected.r === null) return;
  if (climate.active) { focusAt(climate.root.position.clone(), 6.8); return; }
  focusAt(new THREE.Vector3(...selected.position));
}
function focusGroup(group) {
  if (hasLocalData(group)) { focusAt(climate.root.position.clone(), 6.8); return; }
  const points = group.controls.filter((control) => control.position);
  if (!points.length) return;
  const center = points.reduce((sum, control) => sum.add(new THREE.Vector3(...control.position)), new THREE.Vector3()).divideScalar(points.length);
  focusAt(center, Math.max(3.2, ...points.map((control) => new THREE.Vector3(...control.position).distanceTo(center) * 3.2)));
}
function focusAt(target, distance = 2.5) {
  orbit.enableDamping = false;
  orbit.update();
  const direction = camera.position.clone().sub(orbit.target).normalize();
  focusTransition = {
    startedAt: performance.now(),
    duration: 950,
    fromPosition: camera.position.clone(),
    fromTarget: orbit.target.clone(),
    toPosition: target.clone().addScaledVector(direction, distance),
    toTarget: target,
  };
  orbit.enabled = false;
}
$('focus').addEventListener('click', focusSelected);
$('climate-scale').addEventListener('change', (event) => {
  climate.setMode(event.target.value);
  if (climate.selectedIndex >= 0) inspectCountry();
});
$('climate-surface').addEventListener('change', (event) => climate.setSurface(event.target.checked));
$('dataset-select').addEventListener('change', (event) => void openDataset(event.target.value));
$('entity-filter').addEventListener('change', (event) => {
  if (!datasetFull) return;
  inspectedRecord = null; $('inspector').hidden = true;
  refreshField({ ...datasetFull, observations: datasetFull.observations.filter((row) => !event.target.value || row.entity === event.target.value), domainObservations: datasetFull.observations });
});
$('source-record').addEventListener('change', (event) => {
  const row = datasetFull?.records.find((row) => row.sourceRow === Number(event.target.value));
  if (!row) return;
  clearTimeout(readTimer);
  inspectedRecord = row;
  climate.select(climateField.observations.findIndex((entry) => entry.sourceRow === row.sourceRow));
  $('inspector').hidden = false; inspectCountry(row);
});
$('align-group').addEventListener('click', () => {
  const distance = orbit.getDistance();
  orbit.enableDamping = false; orbit.update();
  orbit.target.set(0, 0, 0);
  camera.position.fromArray(selectedGroup.direction).multiplyScalar(distance);
  orbit.update(); orbit.enableDamping = $('damping-toggle').checked;
});
$('pb-toggle').addEventListener('change', (e) => { pbShell.visible = e.target.checked; });
$('hr-toggle').addEventListener('change', (e) => { hrShell.visible = e.target.checked; });
$('lines-toggle').addEventListener('change', (e) => { linesRoot.visible = e.target.checked; });
$('guides-toggle').addEventListener('change', (e) => { riskOrbitsRoot.visible = e.target.checked; });
$('damping-toggle').addEventListener('change', (e) => { orbit.enableDamping = e.target.checked; });
$('export').addEventListener('click', () => {
  const report = { createdAt: new Date().toISOString(), normalization: 'Original numeric riskScore, full precision; SVG rounding parity checked', layout: 'Fixed Fibonacci group directions; paired controls +/-3 degrees', ...liveValidation(), observer: observationReport() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'planetary-boundaries-validation.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const raycaster = new THREE.Raycaster();
let down = null;
function cancelFocus() {
  if (!focusTransition) return;
  focusTransition = null;
  orbit.enabled = true;
  orbit.enableDamping = $('damping-toggle').checked;
}
function climateAtPointer(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  return climate.pick(event.clientX - bounds.left, event.clientY - bounds.top, camera, bounds.width, bounds.height);
}
function inspectCountry(record = null) {
  const row = record ?? climateField.observations[climate.selectedIndex];
  if (!row) return;
  inspectedRecord = row;
  $('source-record').value = String(row.sourceRow);
  $('panel-reference').textContent = `SOURCE ROW / ${row.sourceRow}`;
  $('read-status').textContent = 'LOCAL ANALYSIS';
  $('reference-content').innerHTML = `<div class="reference-code">${escape(row.code.length < 16 ? row.code : `ROW ${row.sourceRow}`)}</div><div class="reference-name">${escape(row.label)}</div>${fields(climateField.columns.map((column, i) => [column, row.raw[i] === '' ? '(empty)' : row.raw[i]]))}`;
  $('observer-content').innerHTML = `<div class="note">${row.plotted ? `${escape(climate.mode.toUpperCase())} / ${climateField.axes.length} DATA AXES` : 'SOURCE RECORD / NO PLOTTED COORDINATES'}<br>LOCAL DATA / NO PLANETARY R</div>`;
  $('relation-content').innerHTML = `<div class="note">${escape(climateField.mappingReason)}<br>${escape(climateField.boundaries.join(' / '))}</div>`;
  $('distance-list').innerHTML = '<div class="note">LOCAL DISPLAY AXES HAVE DIFFERENT UNITS. NO RISK DISTANCE ASSIGNED.</div>';
  $('distance-count').textContent = `${climateField.records.length.toLocaleString('en')} SOURCE ROWS`;
  $('inspect-content').innerHTML = `${fields([['SOURCE ROW', row.sourceRow], ['ORIGINAL LABEL', row.label], ['ARCHIVE / FILE', climateField.source], ['MAPPING', climateField.mappingReason], ['DISPLAY TRANSFORM', row.plotted ? climate.mode === 'log' ? 'X linear; positive Y/Z log10; local extent' : 'Linear local extent; categorical X is layout only where labeled' : 'NOT SPATIALIZED'], ['XY PLANE', climateField.axes.length === 2 ? 'Display Z=0 only; no third measured variable' : 'N/A'], ['ATLAS ANCHOR', 'Layout only; not a risk distance'], ['EXTENT', 'Convex envelope; not a correlation or risk surface']])}`;
}
function controlAtPointer(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects([...meshes.values()])[0];
  return hit ? controlsData.find((control) => control.id === hit.object.userData.controlId) : null;
}
renderer.domElement.addEventListener('pointerdown', cancelFocus, { capture: true });
renderer.domElement.addEventListener('pointerdown', (event) => { down = { x: event.clientX, y: event.clientY, button: event.button }; });
renderer.domElement.addEventListener('pointerup', (event) => {
  const press = down;
  down = null;
  if (!press || press.button !== 0 || event.button !== 0 || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) return;
  const local = climateAtPointer(event);
  if (local) {
    clearTimeout(readTimer);
    climate.select(local.index);
    $('inspector').hidden = false;
    showReadoutTab('reference'); inspectCountry();
    return;
  }
  const control = controlAtPointer(event);
  if (control) {
    select(control, groups.find((g) => g.id === control.groupId));
    focusSelected();
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.buttons) { $('hover-label').hidden = true; return; }
  const local = climateAtPointer(event);
  if (local) {
    const row = climateField.observations[local.index];
    $('hover-label').hidden = false;
    $('hover-label').style.left = `${Math.min(event.clientX + 12, width - 230)}px`;
    $('hover-label').style.top = `${event.clientY - 22}px`;
    $('hover-label').textContent = `${row.code} / ${climateField.axes[1]} ${fmt(row.xyz[1])}`;
    renderer.domElement.style.cursor = 'pointer';
    return;
  }
  renderer.domElement.style.cursor = 'default';
  const control = controlAtPointer(event);
  if (!control) { $('hover-label').hidden = true; return; }
  const bounds = renderer.domElement.getBoundingClientRect();
  $('hover-label').hidden = false;
  $('hover-label').style.left = `${event.clientX - bounds.left + 10}px`;
  $('hover-label').style.top = `${event.clientY - bounds.top + 10}px`;
  $('hover-label').textContent = `${codeFor(control)} / R ${instrumentNumber(control.r)}`;
});
renderer.domElement.addEventListener('pointerleave', () => { $('hover-label').hidden = true; });
renderer.domElement.addEventListener('dblclick', (event) => {
  if (event.button !== 0) return;
  const local = climateAtPointer(event);
  if (local) { focusAt(climate.worldPosition(local.index), 5); return; }
  const control = controlAtPointer(event);
  if (!control) return;
  select(control, groups.find((group) => group.id === control.groupId));
  focusSelected();
});

let width = 1, height = 1;
function resize() {
  width = $('viewport').clientWidth; height = $('viewport').clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('viewport'));
function showReadoutTab(id) {
  document.querySelectorAll('[data-readout-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.readoutTab === id));
  });
  for (const view of ['reference', 'distance', 'data']) $(`${view}-readout`).hidden = view !== id;
}
document.querySelectorAll('[data-readout-tab]').forEach((button) => {
  button.addEventListener('click', () => showReadoutTab(button.dataset.readoutTab));
});
$('close-inspector').addEventListener('click', () => { $('inspector').hidden = true; });
const uiToggle = $('ui-toggle');
function setUiHidden(hidden) {
  document.body.classList.toggle('ui-hidden', hidden);
  uiToggle.setAttribute('aria-pressed', String(hidden));
  uiToggle.setAttribute('aria-label', hidden ? 'Show interface' : 'Hide interface');
  uiToggle.title = hidden ? 'Show interface' : 'Hide interface';
  if (hidden) closeIndex();
}
uiToggle.addEventListener('click', () => setUiHidden(!document.body.classList.contains('ui-hidden')));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $('inspector').hidden = true;
  if (event.key.toLowerCase() === 'h' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) setUiHidden(!document.body.classList.contains('ui-hidden'));
});
resize(); void enterOverview();
createIcons({ icons: { Maximize, Scan, Crosshair, Download, Compass, Eye, EyeOff, X } });

function observationReport() {
  const axisId = selectedGroup.id;
  return { selectedId: selected?.id ?? null, selectedGroup: selectedGroup.id, referenceAxisId: axisId,
    ...observe({ points: controlsData, camera, target: orbit.target,
      axis: selectedGroup.direction, width, height }) };
}

// HTML labels use a fixed layout anchor only. No corresponding 3D object exists.
function positionLabels() {
  const occupied = [];
  for (const element of [document.querySelector('.legend'), $('local-field'), $('inspector')]) {
    if (element.hidden || !element.getClientRects().length) continue;
    const rect = element.getBoundingClientRect();
    occupied.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height });
  }
  selectionRing.visible = false;
  pointLabel.hidden = true;
  if (selected?.r !== null && selected?.position) {
    selectionRing.position.fromArray(selected.position); selectionRing.quaternion.copy(camera.quaternion);
    const p = new THREE.Vector3(...selected.position).project(camera);
    if (p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.86 && Math.abs(p.y) < 0.65) {
      pointLabel.hidden = false;
      const x = (p.x * .5 + .5) * width, y = (-p.y * .5 + .5) * height;
      pointLabel.style.left = `${x}px`; pointLabel.style.top = `${y}px`;
      pointLabel.textContent = `DATA R / ${selected.r.toFixed(4)}`;
      occupied.push({ x, y: y + 18, w: pointLabel.offsetWidth, h: pointLabel.offsetHeight + 12 });
    }
  }
  for (const group of [selectedGroup, ...groups.filter((g) => g.id !== selectedGroup.id)]) {
    const label = groupLabels.get(group.id);
    label.hidden = !$('labels-toggle').checked || climate.active;
    if (label.hidden) continue;
    const v = new THREE.Vector3(...group.direction).multiplyScalar(3.25).project(camera);
    if (v.z < -1 || v.z > 1) { label.hidden = true; continue; }
    const labelWidth = label.offsetWidth, labelHeight = label.offsetHeight;
    let x = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * width, labelWidth / 2 + 10, width - labelWidth / 2 - 10);
    let y = THREE.MathUtils.clamp((-v.y * 0.5 + 0.5) * height, 150, height - 115);
    const collides = (cx, cy) => occupied.some((box) => Math.abs(cx - box.x) < (labelWidth + box.w) / 2 + 7 && Math.abs(cy - box.y) < (labelHeight + box.h) / 2 + 5);
    if (collides(x, y)) {
      const candidates = [];
      for (let cy = 155; cy <= height - 115; cy += 40) {
        for (let cx = labelWidth / 2 + 10; cx <= width - labelWidth / 2 - 10; cx += 24) {
          if (!collides(cx, cy)) candidates.push({ x: cx, y: cy, score: (cx - x) ** 2 + (cy - y) ** 2 });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      if (candidates[0]) { x = candidates[0].x; y = candidates[0].y; }
    }
    label.style.left = `${x}px`; label.style.top = `${y}px`;
    occupied.push({ x, y, w: labelWidth, h: labelHeight });
  }
}

function positionSignalLights() {
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
  const pixelsPerUnitAtDepth = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  for (const [id, point] of meshes) {
    const signal = point.userData.signal;
    const distance = Math.max(0.01, point.getWorldPosition(new THREE.Vector3()).distanceTo(cameraPosition));
    const active = id === selected?.id;
    const baseOpacity = signal.userData.baseOpacity;
    const targetPixels = active ? 16 : overview ? 16 : baseOpacity >= 0.6 ? 14 : baseOpacity >= 0.2 ? 11 : 9;
    const worldSize = distance * targetPixels / pixelsPerUnitAtDepth;
    signal.scale.set(worldSize, worldSize, 1);
    point.userData.glow.scale.set(worldSize * 4.5, worldSize * 4.5, 1);
  }
}

function updateProjectionReadout() {
  if (overview) { $('observer-frame').textContent = 'SYSTEM'; return; }
  const { point } = selectedObservation();
  $('observer-frame').textContent = shortNames[selectedGroup.order - 1];
  $('observer-bearing').textContent = angleNumber(point?.bearing);
  $('observer-elevation').textContent = angleNumber(point?.elevation);
  $('observer-depth').textContent = observerValue(point?.projection?.depth);
  if (!$('inspector').hidden && !inspectedRecord) $('observer-content').innerHTML = observerRows({ point, report: observationReport() });
}

window.__PB_DEBUG__ = {
  overview: () => ({ active: overview, ready: overviewReady, error: overviewError, fields: [...overviewLayers].map(([boundary, layer]) => ({ boundary, dataset: layer.data.id, observations: layer.data.observations.length, visible: layer.root.visible, sources: layer.data.sources })) }),
  atlas: () => ({ dataset: datasetFull?.id ?? null, error: datasetError, sourceRows: datasetFull?.records.length ?? 0, displayed: datasetFull ? climateField.observations.length : 0, boundary: selectedGroup.id, available: atlasManifest.boundaries[selectedGroup.id].datasets, canSurface: climate.canSurface, kind: datasetFull?.kind ?? null }),
  climate: () => ({ active: climate.active, mode: climate.mode, selected: climate.selectedIndex, positions: climate.positions, projected: climate.projected(camera, width, height) }),
  observation: observationReport,
  snapshot: () => ({ ...liveValidation(), selectedId: selected?.id ?? null, selectedGroup: overview ? null : selectedGroup.id,
    camera: { position: camera.position.toArray(), target: orbit.target.toArray(), fov: camera.fov, minDistance: orbit.minDistance, maxDistance: orbit.maxDistance },
    groupDirections: groups.map((g) => ({ id: g.id, direction: g.direction })),
    meshCount: meshes.size, measurementLineCount: lines.size, riskOrbitCount: riskOrbits.size,
  }),
  referenceCheck: () => referenceGeometry.map(({ radius, geometry }) => {
    const a = geometry.getAttribute('position'); let maxError = 0;
    for (let i = 0; i < a.count; i++) maxError = Math.max(maxError, Math.abs(Math.hypot(a.getX(i), a.getY(i), a.getZ(i)) - radius));
    return { radius, maxError, pass: maxError <= GPU_TOLERANCE * radius };
  }),
  project: (id) => {
    const p = meshes.get(id).getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (p.x * .5 + .5) * width, y: rect.top + (-p.y * .5 + .5) * height };
  },
};

let lastValidation = -Infinity;
function updateFocusTransition(now) {
  if (!focusTransition) return;
  const t = Math.min(1, (now - focusTransition.startedAt) / focusTransition.duration);
  const step = t * t * (3 - 2 * t);
  camera.position.lerpVectors(focusTransition.fromPosition, focusTransition.toPosition, step);
  orbit.target.lerpVectors(focusTransition.fromTarget, focusTransition.toTarget, step);
  if (t === 1) {
    focusTransition = null;
    orbit.enabled = true;
    orbit.enableDamping = $('damping-toggle').checked;
  }
}
renderer.setAnimationLoop((now) => {
  for (const layer of overviewLayers.values()) if (layer.root.visible) layer.update(now, camera, width, height, renderer.getPixelRatio(), width);
  climate.update(now, camera, width, height, renderer.getPixelRatio(), $('inspector').hidden ? width - 30 : width - 380);
  updateFocusTransition(now); orbit.update(); renderer.render(scene, camera); positionSignalLights(); positionLabels(); updateProjectionReadout();
  $('camera-distance').textContent = orbit.getDistance().toFixed(3);
  if (now - lastValidation > 500) {
    const report = liveValidation();
    $('validation-status').textContent = report.failed || !report.stateUnchanged ? 'DATA VALIDATION ERROR' : `${report.passed}/11 RADIUS CHECKS PASS`;
    $('validation-status').classList.toggle('fail', report.failed > 0 || !report.stateUnchanged);
    if (report.failed) inspect();
    lastValidation = now;
  }
});
