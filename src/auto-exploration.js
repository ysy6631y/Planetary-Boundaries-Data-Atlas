// Exhibition timing lives here. Null explores every existing dataset in UI order.
export const explorationConfig = Object.freeze({
  initialDelayMs: 5000,
  boundarySelectionMs: 450,
  cameraDurationMs: 2000,
  indicatorHoldMs: 1800,
  datasetSelectionMs: 300,
  datasetHoldMs: 5000,
  datasetsPerBoundary: 3,
  idleResumeMs: 45000,
  overviewHoldMs: 1800,
  loadTimeoutMs: 30000,
  loop: true,
});

// Driven by the existing render loop: no recursive timers or queued camera jobs.
// The adapter owns scene operations; subscribers receive immutable snapshots.
export function createAutoExploration(adapter, options = {}) {
  const config = Object.freeze({ ...explorationConfig, ...options });
  const listeners = new Set();
  let state = Object.freeze({ mode: 'AUTO', stage: 'INITIALIZING', boundaryId: null, controlId: null, datasetId: null, cycle: 0, error: null });
  let elapsed = 0, idle = 0, index = -1, datasetIndex = -1, datasets = [];
  let disposed = false, returning = false;
  let indicators = [], indicatorIndex = 0;
  const boundaries = adapter.boundaries;
  function publish(stage, patch = {}) {
    elapsed = 0;
    state = Object.freeze({ ...state, stage, ...patch });
    for (const listener of listeners) {
      try { listener(state); } catch (error) { console.error('Exploration subscriber:', error); }
    }
  }
  function returnToPlanet() {
    adapter.returnToPlanet(config.cameraDurationMs);
    returning = true;
    publish('RETURNING TO PLANET', { controlId: null, datasetId: null });
  }
  function nextDataset() {
    const id = datasets[++datasetIndex];
    if (!id) { returnToPlanet(); return; }
    adapter.selectDataset(id);
    publish('SELECTING DATASET', { datasetId: id, error: null });
  }
  function nextBoundary() {
    index++;
    if (index >= boundaries.length) {
      if (!config.loop || !boundaries.length) { publish('COMPLETE'); return; }
      index = 0;
      state = Object.freeze({ ...state, cycle: state.cycle + 1 });
    }
    const boundary = boundaries[index];
    if (!adapter.selectBoundary(boundary)) {
      publish('SELECTING NEXT BOUNDARY', { boundaryId: null, datasetId: null });
      return;
    }
    datasets = adapter.datasets();
    if (config.datasetsPerBoundary !== null) datasets = datasets.slice(0, config.datasetsPerBoundary);
    datasetIndex = -1;
    indicators = adapter.indicators?.() ?? [];
    indicatorIndex = 0;
    publish('SELECTING BOUNDARY', { boundaryId: boundary.id, controlId: indicators[0] ?? null, datasetId: null, error: null });
  }
  return {
    config,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    userActivity() {
      if (disposed) return;
      idle = 0;
      if (state.mode === 'MANUAL') return;
      adapter.cancelCamera();
      publish('MANUAL', { mode: 'MANUAL' });
    },
    tick(deltaMs, { visible = true, interacting = false } = {}) {
      if (disposed || !visible) return;
      if (state.mode === 'MANUAL') {
        idle = interacting ? 0 : idle + deltaMs;
        if (idle >= config.idleResumeMs) {
          index = -1;
          state = Object.freeze({ ...state, mode: 'AUTO' });
          returnToPlanet();
        }
        return;
      }
      // Initialization time starts only after the overview and camera are ready.
      if (state.stage === 'INITIALIZING' && !adapter.overviewReady()) { elapsed = 0; return; }
      elapsed += deltaMs;
      switch (state.stage) {
        case 'INITIALIZING':
          if (elapsed >= config.initialDelayMs) nextBoundary();
          break;
        case 'SELECTING BOUNDARY':
          if (elapsed >= config.boundarySelectionMs) {
            adapter.enterBoundary(config.cameraDurationMs);
            publish('ENTERING BOUNDARY');
          }
          break;
        case 'ENTERING BOUNDARY':
          if (adapter.cameraReady()) {
            if (indicators.length) publish('VIEWING INDICATOR');
            else if (datasets.length) nextDataset();
            else publish('VISUALIZATION READY'); // Existing reference-only boundary.
          }
          break;
        case 'VIEWING INDICATOR':
          if (elapsed >= config.indicatorHoldMs) {
            const id = indicators[++indicatorIndex];
            if (id) {
              adapter.selectIndicator(id);
              publish('SELECTING INDICATOR', { controlId: id });
            } else if (datasets.length) nextDataset();
            else returnToPlanet();
          }
          break;
        case 'SELECTING INDICATOR':
          if (elapsed >= config.boundarySelectionMs) {
            adapter.enterBoundary(config.cameraDurationMs);
            publish('ENTERING BOUNDARY');
          }
          break;
        case 'SELECTING DATASET':
          if (elapsed >= config.datasetSelectionMs) {
            adapter.openDataset(state.datasetId);
            publish('READING DATASET');
          }
          break;
        case 'READING DATASET': {
          const result = adapter.datasetStatus(state.datasetId);
          if (result.error || elapsed >= config.loadTimeoutMs) {
            adapter.cancelDataset();
            const error = result.error || 'Dataset readiness timed out';
            nextDataset();
            publish(state.stage, { error });
          } else if (result.ready && adapter.cameraReady()) publish('VISUALIZATION READY');
          break;
        }
        case 'VISUALIZATION READY':
          if (elapsed >= config.datasetHoldMs) nextDataset();
          break;
        case 'RETURNING TO PLANET':
          if (adapter.overviewReady() && adapter.cameraReady()) {
            returning = false;
            publish('SELECTING NEXT BOUNDARY', { boundaryId: null });
          }
          break;
        case 'SELECTING NEXT BOUNDARY':
          if (!returning && elapsed >= config.overviewHoldMs) nextBoundary();
          break;
      }
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}
