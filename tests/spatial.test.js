import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Vector3 } from 'three';
import { parseData, riskScore } from '../src/data.js';
import { spatialize, groupDirection, validatePosition, OFFSET, GPU_TOLERANCE } from '../src/spatial.js';

const source = JSON.parse(readFileSync(new URL('../audit/planetary-boundaries.source.json', import.meta.url)));
const audit = JSON.parse(readFileSync(new URL('../audit/controls.json', import.meta.url)));
const original = readFileSync(new URL('../audit/generate.source.js.txt', import.meta.url), 'utf8');
// Load the original functions without invoking main() or allowing file writes.
const originalContext = { require: () => ({ resolve: () => '/', join: () => '/' }), __dirname: '/' };
vm.createContext(originalContext);
vm.runInContext(original.replace(/main\(\);\s*$/, ''), originalContext);
const legacyScore = vm.runInContext('riskScore', originalContext);
const groups = spatialize(parseData(source));
const controls = groups.flatMap((g) => g.controls);

test('9 groups, 11 numeric points and 2 non-numeric records, no aggregates', () => {
  assert.equal(groups.length, 9);
  assert.equal(controls.filter((c) => c.r !== null).length, 11);
  assert.equal(controls.filter((c) => c.r === null).length, 2);
  for (const g of groups) assert.equal('r' in g, false);
  for (const id of ['genetic-diversity', 'untested-chemicals']) {
    const c = controls.find((v) => v.id === id);
    assert.equal(c.r, null); assert.equal(c.position, null);
    assert.equal(c.validation.status, 'NOT QUANTIFIED');
  }
});

test('full-precision scores equal original generator, including threshold and beyond-risk cases', () => {
  for (const c of controls.filter((v) => v.r !== null)) {
    assert.equal(c.r, legacyScore(c.raw));
    const recorded = audit.controls.find((a) => a.source_variable.id === c.id);
    assert.equal(c.r.toFixed(4), recorded.existing_svg_marker.score_text);
    for (const current of [c.raw.baseline, c.raw.boundary, c.raw.high_risk, c.raw.current, c.raw.baseline + 10, c.raw.high_risk - 10]) {
      const variable = { ...c.raw, current };
      assert.equal(riskScore(variable), legacyScore(variable), c.id);
    }
    assert.equal(riskScore({ ...c.raw, current: c.raw.baseline }), 0);
    assert.equal(riskScore({ ...c.raw, current: c.raw.boundary }), 1);
    assert.equal(riskScore({ ...c.raw, current: c.raw.high_risk }), 2);
  }
  assert.equal(controls.find((c) => c.id === 'nitrogen').r, 7.4);
});

test('directions and pairing offsets are unit length and data-independent', () => {
  for (const group of groups) {
    const d = new Vector3(...group.direction);
    assert.ok(Math.abs(d.length() - 1) < 1e-14);
    for (const c of group.controls) {
      const unit = new Vector3(...c.direction);
      assert.ok(Math.abs(unit.length() - 1) < 1e-14);
      assert.ok(Math.abs(d.angleTo(unit) - (group.controls.length === 2 ? OFFSET : 0)) < 1e-7);
    }
  }
  const changed = structuredClone(source);
  changed.chapters.reverse();
  changed.chapters.find((c) => c.id === 'climate-change').variables[0].current = 440;
  const updated = spatialize(parseData(changed));
  assert.deepEqual(updated.map((g) => g.direction), groups.map((g) => g.direction));
  assert.deepEqual(updated.flatMap((g) => g.controls.map((c) => c.direction)), controls.map((c) => c.direction));
});

test('CPU radius, Float32 endpoint and spherical round trip are correct', () => {
  for (const c of controls.filter((v) => v.r !== null)) {
    assert.equal(c.validation.status, 'PASS');
    const gpu = Array.from(new Float32Array(c.position));
    assert.equal(validatePosition(gpu, c.r, GPU_TOLERANCE).status, 'PASS');
    const reconstructed = new Vector3().setFromSphericalCoords(c.r, c.phi, c.theta);
    assert.ok(reconstructed.distanceTo(new Vector3(...c.position)) < 1e-12);
  }
});

test('bad numeric data and incorrect geometry cannot pass silently', () => {
  const v = source.chapters[0].variables[0];
  for (const current of [null, NaN, Infinity, '423']) assert.throws(() => riskScore({ ...v, current }));
  assert.throws(() => riskScore({ ...v, boundary: v.baseline }));
  assert.throws(() => riskScore({ ...v, direction: 'unknown' }));
  assert.throws(() => groupDirection('invented-boundary'));
  assert.equal(validatePosition([2, 0, 0], 1).status, 'FAIL');
  assert.equal(validatePosition([NaN, 0, 0], 1).status, 'FAIL');
  assert.equal(validatePosition([0, 0, 0], null).status, 'FAIL');
  assert.equal(validatePosition([1, 0, 0], -1).status, 'FAIL');
  assert.equal(validatePosition([], 0).status, 'FAIL');
  assert.equal(validatePosition([1, 0], 1).status, 'FAIL');
});
