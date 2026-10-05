import { Vector3 } from 'three';

export const GROUP_IDS = [
  'climate-change', 'biosphere-integrity', 'land-system-change', 'freshwater-change',
  'biogeochemical-flows', 'ocean-acidification', 'atmospheric-aerosol-loading',
  'stratospheric-ozone-depletion', 'novel-entities',
];
export const OFFSET = Math.PI / 60;
export const DOUBLE_TOLERANCE = 1e-10;
export const GPU_TOLERANCE = 2e-7;

export function groupDirection(id) {
  const i = GROUP_IDS.indexOf(id);
  if (i < 0) throw new Error(`Unknown group: ${id}`);
  const y = 1 - 2 * (i + 0.5) / GROUP_IDS.length;
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  const horizontal = Math.sqrt(1 - y * y);
  return new Vector3(horizontal * Math.sin(theta), y, horizontal * Math.cos(theta)).normalize();
}

export function angles(direction) {
  return { theta: (Math.atan2(direction.x, direction.z) + 2 * Math.PI) % (2 * Math.PI),
    phi: Math.acos(Math.max(-1, Math.min(1, direction.y))) };
}

export function validatePosition(position, r, relativeTolerance = DOUBLE_TOLERANCE) {
  if (r === null && position === null) return { status: 'NOT QUANTIFIED', length: null, error: null, tolerance: null };
  if (typeof r !== 'number' || !Number.isFinite(r) || r < 0 || !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
    return { status: 'FAIL', length: null, error: null, tolerance: null };
  }
  const length = Math.hypot(...position);
  const error = Math.abs(length - r);
  const tolerance = relativeTolerance * Math.max(1, Math.abs(r));
  return { status: error <= tolerance ? 'PASS' : 'FAIL', length, error, tolerance };
}

export function spatialize(groups) {
  return groups.map((group) => {
    const direction = groupDirection(group.id);
    const tangent = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    if (group.controls.length > 2) throw new Error('A new group layout policy is needed for >2 controls');
    return { ...group, direction: direction.toArray(), ...angles(direction),
      controls: group.controls.map((control, index) => {
        const offset = group.controls.length === 2 ? (index === 0 ? -OFFSET : OFFSET) : 0;
        const unit = direction.clone().multiplyScalar(Math.cos(offset)).addScaledVector(tangent, Math.sin(offset)).normalize();
        const position = control.r === null ? null : unit.clone().multiplyScalar(control.r).toArray();
        return { ...control, offset, direction: unit.toArray(), ...angles(unit), position,
          validation: validatePosition(position, control.r) };
      }),
    };
  });
}
