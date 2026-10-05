const numeric = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Same numeric branches as the supplied generate.js riskScore; no new scale.
export function riskScore(variable) {
  if (variable.data_status !== 'verified_numeric') return null;
  const { baseline, boundary, high_risk: highRisk, current, direction } = variable;
  if (![baseline, boundary, highRisk, current].every(numeric)) {
    throw new Error(`${variable.id}: missing numeric input`);
  }
  if (!['higher_is_worse', 'lower_is_worse'].includes(direction)) {
    throw new Error(`${variable.id}: unknown risk direction`);
  }
  if (direction === 'lower_is_worse') {
    if (!(baseline > boundary && boundary > highRisk)) throw new Error(`${variable.id}: invalid thresholds`);
    if (current >= boundary) return clamp((baseline - current) / (baseline - boundary), 0, 1);
    if (current >= highRisk) return 1 + clamp((boundary - current) / (boundary - highRisk), 0, 1);
    return 2 + Math.max(0, (highRisk - current) / (boundary - highRisk));
  }
  if (!(baseline < boundary && boundary < highRisk)) throw new Error(`${variable.id}: invalid thresholds`);
  if (current <= boundary) return clamp((current - baseline) / (boundary - baseline), 0, 1);
  if (current <= highRisk) return 1 + clamp((current - boundary) / (highRisk - boundary), 0, 1);
  return 2 + Math.max(0, (current - highRisk) / (highRisk - boundary));
}

export function parseData(source) {
  if (!Array.isArray(source.chapters) || source.chapters.length !== 9) throw new Error('Expected 9 boundary groups');
  const ids = new Set();
  const orders = new Set();
  return source.chapters.slice().sort((a, b) => a.order - b.order).map((chapter) => {
    if (ids.has(chapter.id) || orders.has(chapter.order)) throw new Error('Duplicate group');
    ids.add(chapter.id); orders.add(chapter.order);
    if (!Array.isArray(chapter.variables) || !chapter.variables.length) throw new Error('Missing variables');
    const controlIds = new Set();
    return {
      id: chapter.id, order: chapter.order, name: chapter.title_en, nameKo: chapter.title_ko,
      controls: chapter.variables.map((variable) => {
        if (controlIds.has(variable.id)) throw new Error('Duplicate control');
        controlIds.add(variable.id);
        if (!['verified_numeric', 'verified_qualitative', 'unresolved_boundary'].includes(variable.data_status)) {
          throw new Error(`${variable.id}: unsupported status`);
        }
        return {
          id: variable.id, groupId: chapter.id, raw: { ...variable },
          r: riskScore(variable),
          state: variable.data_status === 'verified_numeric' ? 'QUANTITATIVE'
            : variable.data_status === 'verified_qualitative' ? 'QUALITATIVE / NOT QUANTIFIED' : 'NOT QUANTIFIED',
        };
      }),
    };
  });
}
