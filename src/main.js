import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Maximize, Scan, Crosshair, Download, Compass } from 'lucide';
import source from '../audit/planetary-boundaries.source.json';
import existingAudit from '../audit/controls.json';
import { parseData } from './data.js';
import { spatialize, validatePosition, GPU_TOLERANCE } from './spatial.js';
import { deepFreeze, observe, wheelDistance } from './observation.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n === null || n === undefined ? 'NOT QUANTIFIED' : String(Number(Number(n).toPrecision(10)));
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shortNames = ['CLIMATE', 'BIOSPHERE', 'LAND SYSTEM', 'FRESHWATER', 'BIOGEOCHEMICAL', 'OCEAN', 'AEROSOLS', 'OZONE', 'NOVEL ENTITIES'];
const groups = deepFreeze(spatialize(parseData(source)));
const fixedState = JSON.stringify(groups);
const controlsData = groups.flatMap((group) => group.controls);
const quantitative = controlsData.filter((control) => control.r !== null);
for (const control of quantitative) {
  const recorded = existingAudit.controls.find((entry) => entry.chapter_id === control.groupId && entry.source_variable.id === control.id);
  if (control.r.toFixed(4) !== recorded?.existing_svg_marker?.score_text) throw new Error(`${control.id}: source score mismatch`);
}

let selected = quantitative[0];
let selectedGroup = groups[0];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
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
orbit.minDistance = 0.25;
orbit.maxDistance = 90;
orbit.zoomSpeed = 1;
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
const colorFor = (r) => r <= 1 ? 0x7fdcba : r <= 2 ? 0xe2d2a3 : 0xef917f;
const glyph = new THREE.SphereGeometry(0.047, 16, 12);

for (const control of quantitative) {
  const point = new THREE.Mesh(glyph, new THREE.MeshBasicMaterial({ color: colorFor(control.r) }));
  point.position.fromArray(control.position);
  point.userData.controlId = control.id;
  dataRoot.add(point);
  meshes.set(control.id, point);
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...control.position)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: colorFor(control.r), transparent: true, opacity: 0.38 }));
  linesRoot.add(line);
  lines.set(control.id, line);
}

const origin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
scene.add(origin);
const referenceGeometry = [];
function shell(radius, color) {
  const root = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.38 });
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
const pbShell = shell(1, 0x6dd3b0);
const hrShell = shell(2, 0xd194ef);
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
    button.addEventListener('click', () => select(control, group));
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
    ])}<div class="note">No boundary aggregate. Labels are layout anchors, not observations.</div>`;
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
    ['DATA STATUS', raw.data_status],
  ])}<div id="point-check" class="check ${quantitativeState ? '' : 'nq'} ${row?.status === 'FAIL' ? 'fail' : ''}">${quantitativeState ? `WORLD |position| = ${fmt(row.length)}<br>ERROR = ${row.error.toExponential(3)}<br>${row.status} / CPU + GPU endpoint` : 'NOT QUANTIFIED<br>R / XYZ / measurement line: absent'}</div>${!quantitativeState ? `<div class="note">${raw.qualitative_position ? 'Beyond high risk is qualitative. The legacy category marker 3 is not used as a radius.' : 'Current and high-risk threshold are unresolved. No numerical position is assigned.'}</div>` : ''}<div class="sources">${raw.source_ids.map((id) => {
    const item = source.meta.sources.find((s) => s.id === id);
    return `<a href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(id)}</a>`;
  }).join('')}</div>`;
}

function select(control, group) {
  selected = control; selectedGroup = group;
  document.querySelectorAll('[data-control]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.control === selected?.id)));
  document.querySelectorAll('[data-group]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.group === group.id)));
  for (const [id, line] of lines) line.material.opacity = id === control?.id ? 0.95 : 0.38;
  for (const [id, label] of groupLabels) label.classList.toggle('selected', id === group.id);
  $('focus').disabled = !control || control.r === null;
  $('scene-selection').textContent = control ? `${control.raw.control_label.toUpperCase()}${control.r === null ? ' / NOT QUANTIFIED' : ''}` : `${shortNames[group.order - 1]} / GROUP DIRECTION`;
  inspect();
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
    return { id: control.id, groupId: control.groupId, r: control.r, theta: control.theta, phi: control.phi, position: world.toArray(), ...cpu,
      gpuError: gpu.error, endpointError, fixedCoordinateError, gpuTolerance: gpu.tolerance,
      status: cpu.status === 'PASS' && gpu.status === 'PASS' && fixedCoordinateError < 1e-10 && start.length() < 1e-10 && endpointError <= gpu.tolerance ? 'PASS' : 'FAIL' };
  });
  return { groups: groups.length, quantitativePoints: quantitative.length, notQuantified: controlsData.length - quantitative.length,
    passed: points.filter((p) => p.status === 'PASS').length,
    failed: points.filter((p) => p.status === 'FAIL').length,
    stateUnchanged: JSON.stringify(groups) === fixedState && points.every((p) => p.r === null || p.fixedCoordinateError < 1e-10),
    observationDistance: orbit.getDistance(), points };
}

const maxRadius = Math.max(...quantitative.map((c) => c.r));
const overviewDirection = new THREE.Vector3(1.3, 0.8, 1.2).normalize();
function fit(radius = maxRadius) {
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
$('fit').addEventListener('click', () => fit());
$('reference-view').addEventListener('click', () => fit(2.7));
$('focus').addEventListener('click', () => {
  if (!selected || selected.r === null) return;
  const direction = camera.position.clone().sub(orbit.target).normalize();
  orbit.enableDamping = false; orbit.update();
  orbit.target.fromArray(selected.position);
  camera.position.copy(orbit.target).addScaledVector(direction, 2.5);
  orbit.update(); orbit.enableDamping = $('damping-toggle').checked;
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
$('damping-toggle').addEventListener('change', (e) => { orbit.enableDamping = e.target.checked; });
$('export').addEventListener('click', () => {
  const report = { createdAt: new Date().toISOString(), normalization: 'Original numeric riskScore, full precision; SVG rounding parity checked', layout: 'Fixed Fibonacci group directions; paired controls +/-3 degrees', ...liveValidation(), observer: observationReport() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'planetary-boundaries-validation.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (event) => { down = [event.clientX, event.clientY]; });
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
  down = null;
  const bounds = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects([...meshes.values()])[0];
  if (hit) {
    const control = controlsData.find((c) => c.id === hit.object.userData.controlId);
    select(control, groups.find((g) => g.id === control.groupId));
  }
});

let width = 1, height = 1;
function resize() {
  width = $('viewport').clientWidth; height = $('viewport').clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('viewport'));
resize(); fit(); select(selected, selectedGroup);
createIcons({ icons: { Maximize, Scan, Crosshair, Download, Compass } });

function observationReport() {
  const axisId = $('reference-axis').value === 'group' ? selectedGroup.id : 'world-y';
  return { selectedId: selected?.id ?? null, selectedGroup: selectedGroup.id, referenceAxisId: axisId,
    ...observe({ points: controlsData, camera, target: orbit.target,
      axis: axisId === 'world-y' ? [0, 1, 0] : selectedGroup.direction, width, height }) };
}

const obsNumber = (n) => n === null || n === undefined ? 'UNDEFINED' : Number(n.toFixed(4)).toString();
const obsVector = (v) => v ? v.map(obsNumber).join(', ') : 'UNDEFINED';
function inspectObserver() {
  if ($('observer-panel').hidden) return;
  const report = observationReport();
  const point = report.points.find((p) => p.id === selected?.id);
  const projection = point?.projection;
  $('observer-content').innerHTML = `<div class="state">${liveValidation().stateUnchanged ? 'DATA STATE UNCHANGED' : 'ERROR: DATA STATE CHANGED'}</div>${fields([
    ['SEMANTIC TARGET', selected?.raw.control_label ?? selectedGroup.name],
    ['CAMERA XYZ', obsVector(report.camera.position)], ['ORBIT PIVOT XYZ', obsVector(report.camera.target)],
    ['CAMERA TO PIVOT', obsNumber(report.camera.observationDistance)],
    ['VIEW DIRECTION', obsVector(report.camera.forward)], ['FOV (degrees)', camera.fov],
    ['REFERENCE AXIS', report.referenceAxisId], ['AXIS VECTOR', obsVector(report.basis.z)],
  ])}<h2 class="subheading">PROJECTED VIEW</h2>${fields([
    ['POINT STATUS', point?.status ?? 'GROUP DIRECTION ONLY'],
    ['CAMERA LOCAL XYZ', obsVector(projection?.cameraLocal)],
    ['BEARING (degrees)', obsNumber(point?.bearing)], ['ELEVATION (degrees)', obsNumber(point?.elevation)],
    ['CAMERA DEPTH', obsNumber(projection?.depth)],
    ['POINT CENTER', !projection ? 'NO POSITION' : projection.inFrustum ? 'IN FRUSTUM' : projection.depth <= 0 ? 'BEHIND CAMERA' : 'OUTSIDE FRUSTUM'],
    ['SCREEN XY (px)', obsVector(projection?.screen)],
    ['SCREEN TO ORIGIN (px)', obsNumber(point?.screenOriginDistance)],
    ['NEAR CENTERS (<10px)', !projection ? 'NOT APPLICABLE' : point.overlapIds.join(', ') || 'NONE'],
    ['PROJECTION PLANE', report.projectionPlane],
  ])}<h2 class="subheading">REFERENCE-RELATIVE / LAYOUT</h2>${fields([
    ['AXIS LOCAL XYZ', obsVector(point?.axisCoordinates)],
    ['AXIS ANGLE (degrees)', obsNumber(point?.axisAngle)],
    ['DATA R (FIXED)', !selected ? 'NO REPRESENTATIVE R' : selected.r === null ? 'NOT QUANTIFIED' : fmt(selected.r)],
  ])}`;
}
function showInspectorTab(id) {
  for (const tab of ['state', 'observer']) {
    const active = tab === id;
    $(`${tab}-tab`).setAttribute('aria-selected', String(active));
    $(`${tab}-tab`).tabIndex = active ? 0 : -1;
    $(`${tab}-panel`).hidden = !active;
  }
  inspectObserver();
}
for (const id of ['state', 'observer']) {
  $(`${id}-tab`).addEventListener('click', () => showInspectorTab(id));
  $(`${id}-tab`).addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'state' : event.key === 'End' ? 'observer' : id === 'state' ? 'observer' : 'state';
    showInspectorTab(next); $(`${next}-tab`).focus();
  });
}
$('reference-axis').addEventListener('change', inspectObserver);

// HTML labels use a fixed layout anchor only. No corresponding 3D object exists.
function positionLabels() {
  const occupied = [];
  selectionRing.visible = selected?.r !== null && !!selected;
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
  for (const group of [selectedGroup, ...groups.filter((g) => g.id !== selectedGroup.id)]) {
    const label = groupLabels.get(group.id);
    label.hidden = !$('labels-toggle').checked;
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

window.__PB_DEBUG__ = {
  observation: observationReport,
  snapshot: () => ({ ...liveValidation(), selectedId: selected?.id ?? null, selectedGroup: selectedGroup.id,
    camera: { position: camera.position.toArray(), target: orbit.target.toArray(), fov: camera.fov, minDistance: orbit.minDistance, maxDistance: orbit.maxDistance },
    groupDirections: groups.map((g) => ({ id: g.id, direction: g.direction })),
    meshCount: meshes.size, measurementLineCount: lines.size,
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
let lastObservation = -Infinity;
renderer.setAnimationLoop((now) => {
  orbit.update(); renderer.render(scene, camera); positionLabels();
  $('camera-distance').textContent = orbit.getDistance().toFixed(3);
  if (now - lastObservation > 100) { inspectObserver(); lastObservation = now; }
  if (now - lastValidation > 500) {
    const report = liveValidation();
    $('validation-status').textContent = report.failed || !report.stateUnchanged ? 'DATA VALIDATION ERROR' : `${report.passed}/11 RADIUS CHECKS PASS`;
    $('validation-status').classList.toggle('fail', report.failed > 0 || !report.stateUnchanged);
    $('runtime-status').textContent = `CPU + GPU / ${report.notQuantified} NQ / ${report.stateUnchanged ? 'STATE UNCHANGED' : 'STATE ERROR'}`;
    if (report.failed) inspect();
    lastValidation = now;
  }
});
