// Display coordinates only. PB risk distances never pass through this transform.
export function climateLayout(observations, mode = 'linear', domainObservations = observations) {
  if (!['linear', 'log'].includes(mode)) throw new Error('Unknown climate axis mode');
  const transformed = observations.map(({ xyz }) => xyz.map((value, axis) => {
    if (value === null) return null;
    if (!Number.isFinite(value)) throw new Error('Invalid analysis observation');
    return mode === 'log' && axis > 0 ? Math.log10(value) : value;
  }));
  if (transformed.some((xyz) => xyz.some((v) => v !== null && !Number.isFinite(v)))) throw new Error('Log axes require positive values');
  const ranges = [0, 1, 2].map((axis) => {
    const values = domainObservations.map(({ xyz }) => xyz[axis]).filter((v) => v !== null).map((v) => mode === 'log' && axis > 0 ? Math.log10(v) : v);
    return values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
  });
  const extent = [8, 6, 8];
  return {
    mode, ranges, extent,
    positions: transformed.map((xyz) => xyz.map((value, axis) => {
      const [min, max] = ranges[axis];
      if (value === null || max === min) return 0;
      return ((value - min) / (max - min || 1) - 0.5) * extent[axis];
    })),
  };
}
