import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const archive = '04_atmospheric_pressure.zip';
const source = '04_atmospheric_pressure/section_04_analysis/csv/section04_optional_xyz_energy_co2_n2o.csv';
const csv = execFileSync('unzip', ['-p', archive, source], { encoding: 'utf8' });
const metadataPath = '04_atmospheric_pressure/section_04_analysis/csv/metadata.json';
const metadata = JSON.parse(execFileSync('unzip', ['-p', archive, metadataPath], { encoding: 'utf8' }));

function parseRow(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

const [header, ...rows] = csv.trim().split(/\r?\n/).map(parseRow);
if (header.join(',') !== 'x,y,z,label') throw new Error(`Unexpected columns: ${header}`);
const observations = rows.map(([x, y, z, label]) => {
  const values = [x, y, z].map(Number);
  const code = label.match(/\(([A-Z]{3})\)/)?.[1];
  if (!code || values.some((value) => !Number.isFinite(value))) throw new Error(`Invalid observation: ${label}`);
  return { code, label, xyz: values };
});
if (observations.length !== 120) throw new Error(`Expected 120 observations, got ${observations.length}`);
writeFileSync('src/climate-field.generated.json', JSON.stringify({
  source: `${archive}/${source}`,
  archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
  metadataSource: metadataPath,
  axes: ['Fossil electricity (%)', 'Consumption CO2 (tonnes/person)', 'N2O (tonnes CO2e/person)'],
  sourceColumns: ['fossil', 'co2_pc', 'n2o_pc'].map((key) => metadata.source_files[key]),
  observations,
}, null, 2) + '\n');
console.log(`Generated ${observations.length} climate observations`);
