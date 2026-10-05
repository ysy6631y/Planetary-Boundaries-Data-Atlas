import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseData } from '../src/data.js';
import { spatialize, validatePosition, GPU_TOLERANCE } from '../src/spatial.js';

const data = JSON.parse(await readFile(new URL('../audit/planetary-boundaries.source.json', import.meta.url)));
const groups = spatialize(parseData(data));
const points = groups.flatMap((group) => group.controls.map((c) => ({
  boundary: group.id, indicator: c.id, raw: c.raw, unifiedDistance: c.r, r: c.r,
  theta: c.theta, phi: c.phi, direction: c.direction, position: c.position,
  validation: c.validation,
  gpuEndpointValidation: validatePosition(c.position === null ? null : Array.from(new Float32Array(c.position)), c.r, GPU_TOLERANCE),
})));
const report = {
  groups: groups.map((g) => ({ id: g.id, direction: g.direction, theta: g.theta, phi: g.phi })),
  quantitative: points.filter((p) => p.r !== null).length,
  notQuantified: points.filter((p) => p.r === null).length,
  passed: points.filter((p) => p.validation.status === 'PASS' && p.gpuEndpointValidation.status === 'PASS').length,
  failed: points.filter((p) => p.validation.status === 'FAIL' || p.gpuEndpointValidation.status === 'FAIL').length,
  points,
};
await mkdir(new URL('../validation/', import.meta.url), { recursive: true });
await writeFile(new URL('../validation/mathematical.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ groups: groups.length, quantitative: report.quantitative, notQuantified: report.notQuantified, passed: report.passed, failed: report.failed }));
if (report.failed) process.exitCode = 1;
