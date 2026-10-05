import { Vector3, MathUtils } from 'three';

export const DOLLY_RATE = 0.00016;
export const MIN_OBSERVATION_DISTANCE = 0.25;
export const MAX_OBSERVATION_DISTANCE = 240;

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function axisFrame(direction) {
  const z = new Vector3(...direction);
  if (!Number.isFinite(z.length()) || z.length() < 1e-12) throw new Error('Reference axis must be nonzero and finite');
  z.normalize();
  const up = Math.abs(z.y) > .99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const x = up.cross(z).normalize();
  const y = z.clone().cross(x).normalize();
  return { x: x.toArray(), y: y.toArray(), z: z.toArray(), origin: [0, 0, 0] };
}

export function wheelDistance(distance, deltaY, deltaMode, height, min = MIN_OBSERVATION_DISTANCE, max = MAX_OBSERVATION_DISTANCE) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
  // Bound the exponent, not the data or the accumulated input distance.
  return MathUtils.clamp(distance * Math.exp(MathUtils.clamp(-DOLLY_RATE * pixels, -50, 50)), min, max);
}

function projectPoint(position, camera, width, height) {
  const point = new Vector3(...position);
  const local = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const depth = -local.z;
  const inDepth = depth >= camera.near && depth <= camera.far;
  const ndc = depth > 1e-12 ? point.clone().project(camera) : null;
  const screen = ndc ? [(ndc.x + 1) * width / 2, (1 - ndc.y) * height / 2] : null;
  return { cameraLocal: local.toArray(), depth, screen, inDepth,
    inFrustum: !!ndc && inDepth && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 };
}

export function observe({ points, camera, target, axis, width, height, overlapPixels = 10 }) {
  camera.updateMatrixWorld(true);
  const basis = axisFrame(axis);
  const originProjection = projectPoint([0, 0, 0], camera, width, height);
  const observations = points.map((point) => {
    if (point.position === null) return { id: point.id, status: 'NOT QUANTIFIED', projection: null,
      bearing: null, elevation: null, axisCoordinates: null, axisAngle: null,
      screenOriginDistance: null, overlapIds: [] };
    const p = new Vector3(...point.position);
    const projection = projectPoint(point.position, camera, width, height);
    const [x, y, z] = projection.cameraLocal;
    const horizontal = Math.hypot(x, z), length = Math.hypot(x, y, z);
    const axisCoordinates = [basis.x, basis.y, basis.z].map((a) => p.dot(new Vector3(...a)));
    return { id: point.id, status: 'QUANTITATIVE', projection,
      bearing: horizontal < 1e-12 ? null : MathUtils.radToDeg(Math.atan2(x, -z)),
      elevation: length < 1e-12 ? null : MathUtils.radToDeg(Math.atan2(y, horizontal)),
      axisCoordinates,
      axisAngle: p.length() < 1e-12 ? null : MathUtils.radToDeg(p.angleTo(new Vector3(...basis.z))),
      screenOriginDistance: projection.inDepth && originProjection.inDepth
        ? Math.hypot(projection.screen[0] - originProjection.screen[0], projection.screen[1] - originProjection.screen[1]) : null,
      overlapIds: [],
    };
  });
  for (let i = 0; i < observations.length; i++) for (let j = i + 1; j < observations.length; j++) {
    const a = observations[i], b = observations[j];
    if (!a.projection?.inFrustum || !b.projection?.inFrustum) continue;
    if (Math.hypot(a.projection.screen[0] - b.projection.screen[0], a.projection.screen[1] - b.projection.screen[1]) < overlapPixels) {
      a.overlapIds.push(b.id); b.overlapIds.push(a.id);
    }
  }
  return { camera: { position: camera.position.toArray(), target: target.toArray(),
    quaternion: camera.quaternion.toArray(), forward: camera.getWorldDirection(new Vector3()).toArray(),
    fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect,
    observationDistance: camera.position.distanceTo(target) },
    viewport: { width, height, units: 'CSS pixels' },
    projectionPlane: 'camera image plane', overlapPixels, basis, originProjection, points: observations };
}
