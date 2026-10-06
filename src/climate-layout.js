// Display coordinates only. PB risk distances never pass through this transform.
export function climateLayout(observations, mode = 'linear') {
  if (!['linear', 'log'].includes(mode)) throw new Error('Unknown climate axis mode');
  const transformed = observations.map(({ xyz }) => xyz.map((value, axis) => {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid climate observation');
    return mode === 'log' && axis > 0 ? Math.log10(value) : value;
  }));
  if (transformed.some((xyz) => xyz.some((v) => !Number.isFinite(v)))) throw new Error('Log axes require positive emissions');
  const ranges = [0, 1, 2].map((axis) => {
    const values = transformed.map((xyz) => xyz[axis]);
    return [Math.min(...values), Math.max(...values)];
  });
  const extent = [8, 6, 8];
  return {
    mode, ranges, extent,
    positions: transformed.map((xyz) => xyz.map((value, axis) => {
      const [min, max] = ranges[axis];
      return ((value - min) / (max - min || 1) - 0.5) * extent[axis];
    })),
  };
}
