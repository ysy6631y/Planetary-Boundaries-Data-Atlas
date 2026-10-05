import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { deepFreeze, axisFrame, observe, wheelDistance } from '../src/observation.js';

function fixture() {
  const camera = new PerspectiveCamera(50, 1, .01, 100);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  return { camera, target: new Vector3(), axis: [0, 1, 0], width: 800, height: 800,
    points: deepFreeze([
      { id: 'a', r: 1, position: [0, 0, 1] },
      { id: 'b', r: 2, position: [0, 0, 2] },
      { id: 'nq', r: null, position: null },
    ]) };
}

test('state is deeply immutable; axis basis is orthonormal including pole fallback', () => {
  const data = fixture();
  assert.throws(() => { data.points[0].position[0] = 2; }, TypeError);
  for (const axis of [[0, 1, 0], [0, -1, 0], [1, 2, 3]]) {
    const basis = axisFrame(axis);
    const [x, y, z] = [basis.x, basis.y, basis.z].map((v) => new Vector3(...v));
    for (const u of [x, y, z]) assert.ok(Math.abs(u.length() - 1) < 1e-14);
    assert.ok(Math.abs(x.dot(y)) + Math.abs(y.dot(z)) + Math.abs(x.dot(z)) < 1e-14);
    assert.ok(x.clone().cross(y).distanceTo(z) < 1e-14);
  }
  assert.throws(() => axisFrame([0, 0, 0]));
});

test('observer motion changes projection/overlap, not state or reference-relative angles', () => {
  const data = fixture(), beforeState = JSON.stringify(data.points);
  const before = observe(data);
  assert.deepEqual(before.points[0].overlapIds, ['b']);
  assert.equal(before.points[0].screenOriginDistance, 0);
  data.camera.position.set(10, 0, 0); data.camera.lookAt(0, 0, 0);
  const after = observe(data);
  assert.deepEqual(after.points[0].overlapIds, []);
  assert.notEqual(after.points[0].bearing, before.points[0].bearing);
  assert.notDeepEqual(after.points[0].projection.screen, before.points[0].projection.screen);
  assert.equal(after.points[0].axisAngle, before.points[0].axisAngle);
  assert.deepEqual(after.points[0].axisCoordinates, before.points[0].axisCoordinates);
  assert.equal(JSON.stringify(data.points), beforeState);
  assert.equal(after.points[2].projection, null);
  assert.equal(after.points[2].axisCoordinates, null);
});

test('changing reference axis changes only reference-relative output; basis transform preserves norm', () => {
  const data = fixture();
  const before = observe(data);
  data.axis = [0, 0, 1];
  const after = observe(data);
  assert.equal(after.points[0].axisAngle, 0);
  assert.notEqual(before.points[0].axisAngle, after.points[0].axisAngle);
  assert.deepEqual(before.points[0].projection, after.points[0].projection);
  for (const point of after.points.filter((p) => p.projection)) {
    const raw = data.points.find((p) => p.id === point.id);
    assert.ok(Math.abs(Math.hypot(...point.axisCoordinates) - raw.r) < 1e-14);
  }
});

test('behind-camera, at-camera and vertical sightline values do not fabricate screen positions or bearings', () => {
  const data = fixture();
  data.points = [
    { id: 'behind', position: [0, 0, 12] },
    { id: 'at', position: [0, 0, 10] },
    { id: 'up', position: [0, 2, 10] },
  ];
  const [behind, at, up] = observe(data).points;
  assert.equal(behind.projection.inFrustum, false);
  assert.equal(behind.projection.screen, null);
  assert.equal(behind.screenOriginDistance, null);
  assert.equal(at.bearing, null); assert.equal(at.elevation, null);
  assert.equal(up.bearing, null); assert.equal(up.elevation, 90);
});

test('CSS-pixel projection scales with viewport, never with data state', () => {
  const data = fixture(); data.points = [{ id: 'offset', position: [1, 1, 0] }];
  const before = observe(data);
  data.width *= 2; data.height *= 2;
  const after = observe(data);
  assert.equal(after.points[0].screenOriginDistance, before.points[0].screenOriginDistance * 2);
  assert.equal(after.points[0].bearing, before.points[0].bearing);
});

test('wheel down is inward; fine exponential dolly has smaller absolute steps nearby and hard bounds', () => {
  assert.ok(wheelDistance(40, 100, 0, 800) < 40);
  assert.ok(wheelDistance(40, -100, 0, 800) > 40);
  assert.ok(40 - wheelDistance(40, 100, 0, 800) > 1 - wheelDistance(1, 100, 0, 800));
  assert.equal(wheelDistance(40, 1, 1, 800), wheelDistance(40, 16, 0, 800));
  assert.equal(wheelDistance(40, 1, 2, 800), wheelDistance(40, 800, 0, 800));
  assert.equal(wheelDistance(40, 1e6, 0, 800), .25);
  assert.equal(wheelDistance(1, -1e6, 0, 800), 90);
  assert.ok(Math.abs(wheelDistance(wheelDistance(40, 50, 0, 800), 50, 0, 800) - wheelDistance(40, 100, 0, 800)) < 1e-12);
});
