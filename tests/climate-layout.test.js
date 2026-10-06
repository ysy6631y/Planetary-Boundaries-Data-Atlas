import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { climateLayout } from '../src/climate-layout.js';

const data = JSON.parse(readFileSync(new URL('../src/climate-field.generated.json', import.meta.url)));
test('Climate display transforms preserve all 120 original rows and are invertible', () => {
  const original = JSON.stringify(data);
  assert.equal(data.observations.length, 120);
  assert.equal(new Set(data.observations.map((row) => row.code)).size, 120);
  for (const mode of ['linear', 'log']) {
    const layout = climateLayout(data.observations, mode);
    layout.positions.forEach((xyz, i) => xyz.forEach((value, axis) => {
      assert.ok(Number.isFinite(value));
      const [min, max] = layout.ranges[axis];
      const transformed = (value / layout.extent[axis] + 0.5) * (max - min) + min;
      const recovered = mode === 'log' && axis > 0 ? 10 ** transformed : transformed;
      assert.ok(Math.abs(recovered - data.observations[i].xyz[axis]) < 1e-10);
    }));
  }
  assert.equal(JSON.stringify(data), original);
});
