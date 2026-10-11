import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareDataset } from '../src/atlas-data.js';
import { climateLayout } from '../src/climate-layout.js';

const manifest = JSON.parse(readFileSync(new URL('../src/atlas-manifest.generated.json', import.meta.url)));
const read = (meta) => prepareDataset(meta, JSON.parse(readFileSync(new URL(`../public${meta.url}`, import.meta.url))));

test('All 133 CSV files are accounted for; all 96 unique datasets retain every source row', () => {
  assert.equal(manifest.coverage.length, 133);
  assert.equal(manifest.datasets.length, 96);
  let count = 0;
  for (const meta of manifest.datasets) {
    const data = read(meta);
    assert.equal(data.records.length, meta.rowCount, meta.title);
    count += data.records.length;
    assert.ok(data.records.every((r, i) => r.sourceRow === i + 2 && r.raw.length === meta.columns.length));
    if (meta.kind === 'records') assert.equal(data.observations.length, 0);
    else {
      const layout = climateLayout(data.observations);
      assert.ok(layout.positions.every((xyz) => xyz.every(Number.isFinite)), meta.title);
      if (meta.kind !== 'xyz') {
        assert.ok(data.observations.every((r) => r.xyz[2] === null));
        assert.ok(layout.positions.every((xyz) => xyz[2] === 0));
      }
    }
  }
  assert.equal(count, 257474);
  for (const file of manifest.coverage) assert.ok(file.dataset || file.status.startsWith('union index'));
});

test('Missing values stay unplotted, negatives are preserved, and filtering does not rescale coordinates', () => {
  const meta = { kind: 'history', axes: ['Year', 'Value'], sources: [], title: 'test' };
  const data = prepareDataset(meta, { columns: ['Entity', 'Code', 'Year', 'Value'], rows: [['A', 'AAA', '2000', '-2'], ['A', 'AAA', '2001', ''], ['Region', '', '2000', '8']] });
  assert.equal(data.records.length, 3);
  assert.equal(data.observations.length, 2);
  assert.equal(data.records[1].xyz[1], null);
  assert.equal(data.logAvailable, false);
  assert.equal(data.observations[0].xyz[1], -2);
  const full = climateLayout(data.observations);
  const filtered = climateLayout([data.observations[1]], 'linear', data.observations);
  assert.deepEqual(filtered.positions[0], full.positions[1]);
});

test('Shared analyses retain one ID and unsupported boundaries have no fabricated data', () => {
  const shared = manifest.datasets.find((d) => d.title === 'raw_xyz.csv');
  for (const id of ['biosphere-integrity', 'land-system-change', 'freshwater-change']) assert.ok(manifest.boundaries[id].datasets.includes(shared.id));
  for (const id of ['ocean-acidification', 'atmospheric-aerosol-loading', 'stratospheric-ozone-depletion']) assert.equal(manifest.boundaries[id].datasets.length, 0);
  assert.ok(manifest.boundaries['novel-entities'].datasets.length > 0);
});
