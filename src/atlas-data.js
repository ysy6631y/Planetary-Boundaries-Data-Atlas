const cache = new Map();
const numeric = (value) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export function prepareDataset(meta, payload) {
  const { columns, rows } = payload;
  const column = (row, name) => row[columns.indexOf(name)];
  const categories = [...new Set(rows.map((row) => column(row, 'iso')))].sort();
  const categoryIndex = new Map(categories.map((name, index) => [name, index]));
  const records = rows.map((raw, index) => {
    const label = column(raw, 'label') ?? (meta.kind === 'history'
      ? `${column(raw, 'Entity')} / ${column(raw, 'Code') || 'REGION'} / ${column(raw, 'Year')}`
      : column(raw, 'iso') ?? column(raw, 'iso3') ?? column(raw, 'metric') ?? column(raw, 'node_a') ?? `ROW ${index + 2}`);
    const code = column(raw, 'iso') || column(raw, 'Code') || column(raw, 'iso3')
      || label.match(/\(([A-Z]{3})\)/)?.[1] || label.match(/^([A-Z]{3})\s*\//)?.[1] || column(raw, 'Entity') || label;
    const entity = meta.kind === 'history' ? column(raw, 'Entity') : code;
    let xyz = null;
    if (meta.kind === 'xyz' || meta.kind === 'xy') xyz = [numeric(column(raw, 'x')), numeric(column(raw, 'y')), meta.kind === 'xyz' ? numeric(column(raw, 'z')) : null];
    if (meta.kind === 'history') xyz = [numeric(column(raw, 'Year')), numeric(raw[3]), null];
    if (meta.kind === 'category') xyz = [categoryIndex.get(column(raw, 'iso')), numeric(column(raw, 'value')), null];
    const plotted = xyz !== null && xyz[0] !== null && xyz[1] !== null && (meta.kind !== 'xyz' || xyz[2] !== null);
    return { code, label, entity, xyz, plotted, raw, sourceRow: index + 2 };
  });
  const observations = records.filter((row) => row.plotted);
  const logAvailable = observations.length > 0 && observations.every(({ xyz }) => xyz.slice(1).every((v) => v === null || v > 0));
  return { ...meta, records, observations, axes: meta.axes, title: meta.title, logAvailable,
    source: meta.sources.map(({ archive, path }) => `${archive}/${path}`).join('\n'),
    omittedCount: records.length - observations.length,
    entities: [...new Set(records.map((row) => row.entity))].sort(),
  };
}

export async function loadDataset(meta, onStage = () => {}) {
  onStage('READING');
  if (!cache.has(meta.id)) {
    cache.set(meta.id, fetch(`${import.meta.env.BASE_URL}${meta.url.replace(/^\//, '')}`).then(async (response) => {
      if (!response.ok) throw new Error(`Cannot load ${meta.title} (${response.status})`);
      const text = await response.text();
      onStage('PARSING');
      const payload = JSON.parse(text);
      return prepareDataset(meta, payload);
    }).catch((error) => { cache.delete(meta.id); throw error; }));
  }
  return cache.get(meta.id);
}
