// Presentation only: source IDs, paths, axis definitions and cell values stay intact.
const chapters = {
  '01': 'FOREST / FRESHWATER / RED LIST INDEX',
  '02': 'LAND TRANSFORMATION',
  '03': 'RESOURCE PRESSURE',
  '04': 'ATMOSPHERIC PRESSURE',
  '05': 'MAINTENANCE & RESPONSE',
};
const statistics = {
  '672f9f8cb1ec4016f4ca': 'INDICATOR DISTRIBUTIONS',
  '4c882a273a43d5225ad5': 'INDICATOR RANK EXTREMES',
  '5f1104bfb26c827636c2': 'INDICATOR ASSOCIATIONS',
  '978ce0d655f4459460ac': 'FOREST / FRESHWATER / RLI SYNTHESIS',
  '0cedfaa18f63bc38a678': 'INDICATOR DISTRIBUTIONS',
  '94cdcfa48ce79f6650c3': 'INDICATOR ASSOCIATIONS',
  '3c845d5799da2c56f1b0': 'FOREST CHANGE DIRECTION',
  '83006f5a80eecedc1237': 'INDICATOR RANK EXTREMES',
  '7f0848943c9639a05114': 'INDICATOR DISTRIBUTIONS',
  '15d1ccae717c36635b42': 'INDICATOR ASSOCIATIONS',
  'a3f9cbbe3254d516a6ed': 'WATER STRESS CLASSES',
  '37013d1d2f95ffe064a7': 'INDICATOR RANK EXTREMES',
  'db1ae8da7dc5ec5ee73b': 'INDICATOR DISTRIBUTIONS',
  '2bd85b67e15860d8a17c': 'INDICATOR ASSOCIATIONS',
  '76c75fc3490e95c3d0dc': 'FOSSIL ELECTRICITY CLASSES',
  '9a51f705b04357d19c64': 'INDICATOR RANK EXTREMES',
};
export function axisLabel(axis) {
  // Only a trailing parenthesis is treated as source-provided unit metadata.
  const match = axis.match(/^(.*?)\s*\(([^()]*)\)$/);
  return match ? { name: match[1], unit: match[2] } : { name: axis, unit: '' };
}
const types = { xy: 'XY', xyz: 'XYZ', category: 'ENTITY / VALUE', history: 'TIME SERIES', records: 'SOURCE RECORDS' };
const roleNames = {
  analysis: 'MULTIVARIATE ANALYSIS', processed: 'INDICATORS', history: 'TIME SERIES',
  statistics: 'STATISTICS', 'red-points': 'SOURCE SELECTIONS', relations: 'ASSOCIATIONS', summary: 'SUMMARIES',
};
export function datasetPresentation(meta) {
  const chapter = meta.sources.map((source) => source.path.match(/(?:^|\/)(0[1-5])_[^/]+\//)?.[1]).find(Boolean);
  if (!chapter) throw new Error(`Missing source chapter: ${meta.id}`);
  let subject;
  if (meta.axes.length) {
    const variables = meta.axes.filter((axis) => axis !== 'Year' && axis !== 'Entity (categorical layout)');
    subject = variables.map((axis) => axisLabel(axis).name.replace(/CO2/g, 'CO₂').replace(/N2O/g, 'N₂O').replace(/CH4/g, 'CH₄').toUpperCase()).join(' × ');
  } else if (statistics[meta.id]) {
    subject = `${chapters[chapter]} / ${statistics[meta.id]}`;
  } else {
    subject = `${chapters[chapter]} / ${roleNames[meta.role]}`;
  }
  return { name: `${chapter} / ${subject}`, format: types[meta.kind], role: roleNames[meta.role], chapter };
}
