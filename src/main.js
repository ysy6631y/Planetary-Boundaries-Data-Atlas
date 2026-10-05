import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Maximize, Scan, Crosshair, Download, Compass, X } from 'lucide';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import source from '../audit/planetary-boundaries.source.json';
import existingAudit from '../audit/controls.json';
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

let selected = null;
let selectedGroup = groups[0];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
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
  const current = orbit.getDistance();
  const next = wheelDistance(current, event.deltaY, event.deltaMode, renderer.domElement.clientHeight, orbit.minDistance, orbit.maxDistance);
  if (next < current) orbit.dollyIn(next / current);
  else if (next > current) orbit.dollyOut(current / next);
}, { capture: true, passive: false });
const dataRoot = new THREE.Group();
scene.add(dataRoot);
const linesRoot = new THREE.Group();
dataRoot.add(linesRoot);
const meshes = new Map();
const lines = new Map();
const colorFor = () => 0xf4f0e9;
const lineColorFor = () => 0x77716b;
const lightOpacityFor = (r) => r > 2 ? 0.56 : r > 1 ? 0.42 : 0.26;
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
  point.userData.signal = signal;
  point.add(signal);
  dataRoot.add(point);
  meshes.set(control.id, point);
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...control.position)]);
  const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({
    color: control.r > 1 ? 0x6f2824 : lineColorFor(control.r), transparent: true, opacity: control.r > 1 ? 0.25 : 0.2, dashSize: 0.12, gapSize: 0.08,
  }));
  line.computeLineDistances();
  linesRoot.add(line);
  lines.set(control.id, line);
}

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
    new THREE.LineBasicMaterial({ color: control.r > 1 ? 0x6f2824 : 0x817b75, transparent: true, opacity: control.r > 1 ? 0.22 : 0.18 }),
  );
  orbitLine.userData.controlId = control.id;
  orbitLine.userData.groupId = control.groupId;
  orbitLine.userData.r = control.r;
  orbitLine.renderOrder = 1;
  riskOrbitsRoot.add(orbitLine);
  riskOrbits.set(control.id, orbitLine);
}

// These are navigation references only. They carry no environmental values.
const referencePlane = new THREE.GridHelper(60, 60, 0x484744, 0x1d1d1c);
referencePlane.position.set(0, -3.5, 0);
referencePlane.rotation.set(-0.34, 0.18, 0.12);
referencePlane.material.transparent = true;
referencePlane.material.opacity = 0.17;
referencePlane.renderOrder = 1;
scene.add(referencePlane);

let starSeed = 0x1a96;
const random = () => {
  starSeed = (starSeed * 1664525 + 1013904223) >>> 0;
  return starSeed / 0x100000000;
};
function starLayer({ count, inner, outer, size, opacity, warmChance }) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  for (let i = 0; i < count; i++) {
    const radius = inner + random() * (outer - inner);
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const spread = Math.sqrt(1 - z * z);
    positions.push(radius * spread * Math.cos(angle), radius * z, radius * spread * Math.sin(angle));
    const brightness = 0.55 + random() * 0.45;
    const warm = random() < warmChance;
    colors.push(brightness, warm ? brightness * 0.78 : brightness, warm ? brightness * 0.66 : brightness * 0.96);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity, depthWrite: false,
  }));
  points.renderOrder = -1;
  scene.add(points);
  return points;
}
const starFields = [
  starLayer({ count: 960, inner: 130, outer: 460, size: 0.18, opacity: 0.72, warmChance: 0.08 }),
  starLayer({ count: 520, inner: 40, outer: 150, size: 0.085, opacity: 0.84, warmChance: 0.12 }),
  starLayer({ count: 190, inner: 10, outer: 55, size: 0.038, opacity: 0.94, warmChance: 0.16 }),
];

// The origin remains a mathematical anchor for validation, never a visible node.
const origin = new THREE.Object3D();
scene.add(origin);
const referenceGeometry = [];
function shell(radius, color) {
  const root = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.26 });
  function addCircle(points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    root.add(new THREE.LineLoop(geometry, material));
    referenceGeometry.push({ radius, geometry });
  }
  // A single great-circle section communicates the threshold without turning
  // the origin into a decorative wire sphere.
  addCircle(Array.from({ length: 160 }, (_, i) => {
    const a = i / 160 * Math.PI * 2;
    return new THREE.Vector3(radius * Math.sin(a), 0, radius * Math.cos(a));
  }));
  scene.add(root);
  return root;
}
const pbShell = shell(1, 0x756e67);
const hrShell = shell(2, 0x7f2925);
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
  title.addEventListener('click', () => select(null, group));
  wrapper.append(title);
  for (const control of group.controls) {
    const button = document.createElement('button');
    button.className = `control ${control.r === null ? 'nq' : ''}`;
    button.dataset.control = control.id;
    button.innerHTML = `<span class="name">${escape(control.raw.control_label)}</span><span class="value">${control.r === null ? 'NQ' : control.r.toFixed(4)}</span>`;
    button.addEventListener('click', () => select(control, group, { focus: control.r !== null }));
    wrapper.append(button);
  }
  $('group-list').append(wrapper);
  const label = document.createElement('button');
  const nq = group.controls.filter((control) => control.r === null).length;
  label.className = `group-label ${nq ? 'nq' : ''}`;
  label.title = 'Boundary direction label; layout anchor only, no representative data radius';
  label.innerHTML = `${String(group.order).padStart(2, '0')} ${shortNames[index]}${nq ? `<small>${nq} NOT QUANTIFIED</small>` : ''}`;
  label.addEventListener('click', () => select(null, group));
  $('labels').append(label);
  groupLabels.set(group.id, label);
}
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

function updateInstrument() {
  $('read-status').textContent = 'SYSTEM / ACTIVE';
  $('read-status-top').textContent = 'SYSTEM / ACTIVE';
  $('read-status').classList.remove('reading');
  if (!selected || selected.r === null) {
    const code = selected ? codeFor(selected) : shortNames[selectedGroup.order - 1];
    $('panel-reference').textContent = `REFERENCE / ${code}`;
    $('reference-content').innerHTML = `<div class="reference-code">${escape(code)}</div><div class="reference-name">${escape(selected?.raw.control_label ?? selectedGroup.name)}</div><div class="reference-vector">X / UNDEFINED<br>Y / UNDEFINED<br>Z / UNDEFINED<br>R / ${selected ? 'NOT QUANTIFIED' : 'NO GROUP AGGREGATE'}</div>`;
    $('distance-list').innerHTML = '<div class="distance-row"><span class="distance-code">NO NUMERIC REFERENCE</span><span class="distance-value">--</span></div>';
    $('distance-count').textContent = '0 DISTANCES / REFERENCE HAS NO XYZ';
    $('relation-content').innerHTML = `<div class="relation-row"><span>GROUP</span><span>${escape(selectedGroup.name.toUpperCase())}</span></div><div class="relation-row"><span>ANALYTICAL</span><span>NOT LOADED</span></div>`;
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
  $('relation-content').innerHTML = `<div class="relation-row"><span>MEASURE</span><span>ORIGIN -> ${escape(codeFor(selected))} / R ${instrumentNumber(selected.r)}</span></div><div class="relation-row"><span>CONTROL</span><span>${escape(selectedGroup.name.toUpperCase())}</span></div><div class="relation-row"><span>PEER</span><span>${escape(peers.join(', ') || 'NONE')}</span></div><div class="relation-row"><span>ANALYTICAL</span><span>NOT LOADED</span></div>`;
  inspect();
}

let readTimer = null;
function scheduleInstrumentRead() {
  clearTimeout(readTimer);
  $('read-status').textContent = 'READING DATA...';
  $('read-status-top').textContent = 'READING DATA...';
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

let activeReveal = false;
let orbitRevealStartedAt = null;
function select(control, group, { openPanel = true, focus = false, reveal = true } = {}) {
  selected = control; selectedGroup = group;
  activeReveal = Boolean(control?.r !== null && reveal);
  orbitRevealStartedAt = null;
  if (openPanel) $('inspector').hidden = false;
  if (openPanel && control) {
    $('boundaries').hidden = true;
    $('index-toggle').setAttribute('aria-expanded', 'false');
    $('index-toggle').textContent = 'INDEX / 09';
  }
  document.querySelectorAll('[data-control]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.control === selected?.id)));
  document.querySelectorAll('[data-group]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.group === group.id)));
  for (const [id, line] of lines) {
    const active = id === control?.id;
    const lineControl = quantitative.find((item) => item.id === id);
    line.material.color.setHex(active && control.r > 1 ? 0xa83530 : lineControl.r > 1 ? 0x6f2824 : 0x77716b);
    line.material.opacity = active ? 0.46 : lineControl.r > 1 ? 0.25 : 0.2;
    line.visible = true;
  }
  for (const [id, orbitLine] of riskOrbits) {
    const active = id === control?.id;
    orbitLine.material.color.setHex(active && control.r > 1 ? 0xa83530 : 0xc9c7c1);
    orbitLine.material.opacity = active ? 0.44 : orbitLine.userData.r > 1 ? 0.22 : 0.18;
    orbitLine.geometry.setDrawRange(0, Infinity);
    orbitLine.visible = true;
  }
  for (const [id, point] of meshes) {
    const active = id === control?.id;
    point.material.color.setHex(active ? 0xf0443a : point.userData.baseColor);
    const signal = point.userData.signal;
    signal.material.map = active ? redSignal : signal.userData.baseMap;
    signal.material.opacity = active ? 0.78 : signal.userData.baseOpacity;
    signal.material.needsUpdate = true;
  }
  for (const [id, label] of groupLabels) label.classList.toggle('selected', id === group.id);
  $('focus').disabled = !control || control.r === null;
  $('scene-selection').textContent = control ? `${control.raw.control_label.toUpperCase()}${control.r === null ? ' / NOT QUANTIFIED' : ''}` : `${shortNames[group.order - 1]} / GROUP DIRECTION`;
  scheduleInstrumentRead();
  if (focus && control?.r !== null) focusSelected();
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
  if (radius === maxRadius) distance = 32;
  camera.position.copy(overviewDirection).multiplyScalar(Math.min(120, distance));
  orbit.update(); orbit.enableDamping = $('damping-toggle').checked;
}
$('fit').addEventListener('click', () => fit());
$('reference-view').addEventListener('click', () => fit(2.7));
function focusSelected() {
  if (!selected || selected.r === null) return;
  const direction = camera.position.clone().sub(orbit.target).normalize();
  const point = new THREE.Vector3(...selected.position);
  const target = point.clone().multiplyScalar(0.32);
  const framingDistance = Math.max(7.2, selected.r * 3.05);
  focusTransition = {
    startedAt: performance.now(),
    duration: 760,
    fromPosition: camera.position.clone(),
    fromTarget: orbit.target.clone(),
    toPosition: target.clone().addScaledVector(direction, framingDistance),
    toTarget: target,
  };
  orbit.enabled = false;
}
$('focus').addEventListener('click', focusSelected);
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
function controlAtPointer(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects([...meshes.values()], true)[0];
  const id = hit?.object.userData.controlId ?? hit?.object.parent?.userData.controlId;
  return id ? controlsData.find((control) => control.id === id) : null;
}
renderer.domElement.addEventListener('pointerdown', (event) => { down = { x: event.clientX, y: event.clientY, button: event.button }; });
renderer.domElement.addEventListener('pointerup', (event) => {
  const press = down;
  down = null;
  if (!press || press.button !== 0 || event.button !== 0 || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) return;
  const control = controlAtPointer(event);
  if (control) {
    select(control, groups.find((g) => g.id === control.groupId), { focus: true });
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.buttons) { $('hover-label').hidden = true; return; }
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
  const control = controlAtPointer(event);
  if (!control) return;
  select(control, groups.find((group) => group.id === control.groupId), { focus: true });
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
$('index-toggle').addEventListener('click', () => {
  const open = $('boundaries').hidden;
  $('boundaries').hidden = !open;
  $('index-toggle').setAttribute('aria-expanded', String(open));
  $('index-toggle').textContent = open ? 'CLOSE / INDEX' : 'INDEX / 09';
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $('inspector').hidden = true;
});
resize(); fit(); select(null, selectedGroup, { openPanel: false, reveal: false });
$('scene-selection').textContent = 'EARTH-SYSTEM FIELD';
createIcons({ icons: { Maximize, Scan, Crosshair, Download, Compass, X } });

function observationReport() {
  const axisId = selectedGroup.id;
  return { selectedId: selected?.id ?? null, selectedGroup: selectedGroup.id, referenceAxisId: axisId,
    ...observe({ points: controlsData, camera, target: orbit.target,
      axis: selectedGroup.direction, width, height }) };
}

// HTML labels use a fixed layout anchor only. No corresponding 3D object exists.
function positionLabels() {
  const occupied = [];
  selectionRing.visible = false;
  pointLabel.hidden = true;
  if (selectionRing.visible) {
    selectionRing.position.fromArray(selected.position); selectionRing.quaternion.copy(camera.quaternion);
    const p = new THREE.Vector3(...selected.position).project(camera);
    if (p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.86 && Math.abs(p.y) < 0.65) {
      pointLabel.hidden = false;
      const x = (p.x * .5 + .5) * width, y = (-p.y * .5 + .5) * height;
      pointLabel.style.left = `${x}px`; pointLabel.style.top = `${y}px`;
      pointLabel.textContent = `r = ${selected.r.toFixed(4)}`;
      occupied.push({ x, y: y + 18, w: pointLabel.offsetWidth, h: pointLabel.offsetHeight + 12 });
    }
  }
  const observationDistance = orbit.getDistance();
  for (const group of [selectedGroup, ...groups.filter((g) => g.id !== selectedGroup.id)]) {
    const label = groupLabels.get(group.id);
    const selectedLabel = group.id === selectedGroup.id;
    label.hidden = !$('labels-toggle').checked || observationDistance > 26 || (observationDistance > 13 && !selectedLabel);
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
    const targetPixels = active ? 15 : baseOpacity >= 0.5 ? 11 : baseOpacity >= 0.35 ? 9 : 7;
    const worldSize = distance * targetPixels / pixelsPerUnitAtDepth;
    signal.scale.set(worldSize, worldSize, 1);
  }
}

window.__PB_DEBUG__ = {
  observation: observationReport,
  snapshot: () => ({ ...liveValidation(), selectedId: selected?.id ?? null, selectedGroup: selectedGroup.id,
    camera: { position: camera.position.toArray(), target: orbit.target.toArray(), fov: camera.fov, minDistance: orbit.minDistance, maxDistance: orbit.maxDistance },
    groupDirections: groups.map((g) => ({ id: g.id, direction: g.direction })),
    meshCount: meshes.size, measurementLineCount: lines.size, riskOrbitCount: riskOrbits.size,
    visibleMeasurementLines: [...lines.values()].filter((line) => line.visible).length,
    visibleRiskOrbits: [...riskOrbits.values()].filter((line) => line.visible).length,
    referenceShellsVisible: { planetaryBoundary: pbShell.visible, highRisk: hrShell.visible },
    viewStage: document.body.dataset.viewStage,
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
  const eased = t * t * (3 - 2 * t);
  const step = t === 1 ? 1 : Math.floor(eased * 24) / 24;
  camera.position.lerpVectors(focusTransition.fromPosition, focusTransition.toPosition, step);
  orbit.target.lerpVectors(focusTransition.fromTarget, focusTransition.toTarget, step);
  if (t === 1) {
    focusTransition = null;
    orbit.enabled = true;
    orbit.enableDamping = $('damping-toggle').checked;
  }
}
function updateObservationLOD(now) {
  const distance = orbit.getDistance();
  const boundaryGate = activeReveal ? Math.max(10, selected.r * 3.2) : 10;
  const stage = distance > 26 ? 'SYSTEM' : distance > boundaryGate ? 'APPROACH' : distance > 3.2 ? 'BOUNDARY' : 'CONTROL';
  $('view-stage').textContent = `VIEW / ${stage}`;
  document.body.dataset.viewStage = stage.toLowerCase();

  pbShell.visible = $('pb-toggle').checked;
  hrShell.visible = $('hr-toggle').checked;
  referencePlane.material.opacity = stage === 'SYSTEM' ? 0.1 : stage === 'APPROACH' ? 0.15 : 0.2;

  for (const [id, line] of lines) {
    const control = quantitative.find((item) => item.id === id);
    const active = activeReveal && id === selected?.id;
    line.visible = $('lines-toggle').checked;
    line.material.color.setHex(active ? (selected.r > 1 ? 0xa83530 : 0xd4d1ca) : control.r > 1 ? 0x6f2824 : 0x77716b);
    line.material.opacity = active ? (selected.r > 1 ? 0.46 : 0.42) : control.r > 1 ? 0.25 : 0.2;
  }
  for (const [id, orbitLine] of riskOrbits) {
    const active = activeReveal && id === selected?.id;
    orbitLine.visible = $('guides-toggle').checked;
    orbitLine.geometry.setDrawRange(0, Infinity);
    orbitLine.material.color.setHex(active ? (selected.r > 1 ? 0xa83530 : 0xd4d1ca) : orbitLine.userData.r > 1 ? 0x6f2824 : 0x817b75);
    orbitLine.material.opacity = active ? (selected.r > 1 ? 0.44 : 0.48) : orbitLine.userData.r > 1 ? 0.22 : 0.18;
  }
}
renderer.setAnimationLoop((now) => {
  updateFocusTransition(now); orbit.update(); updateObservationLOD(now); positionSignalLights(); positionLabels(); renderer.render(scene, camera);
  $('camera-distance').textContent = orbit.getDistance().toFixed(3);
  if (now - lastValidation > 500) {
    const report = liveValidation();
    $('validation-status').textContent = report.failed || !report.stateUnchanged ? 'DATA VALIDATION ERROR' : `${report.passed}/11 RADIUS CHECKS PASS`;
    $('validation-status').classList.toggle('fail', report.failed > 0 || !report.stateUnchanged);
    $('runtime-status').textContent = `CPU + GPU / ${report.notQuantified} NQ / ${report.stateUnchanged ? 'STATE UNCHANGED' : 'STATE ERROR'}`;
    if (report.failed) inspect();
    lastValidation = now;
  }
});
