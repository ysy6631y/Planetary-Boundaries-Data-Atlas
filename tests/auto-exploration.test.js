import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoExploration } from '../src/auto-exploration.js';

function harness(options = {}, visitIndicators = false) {
  const calls = [], flags = { overview: true, camera: true, ready: true, error: null };
  let group;
  const controller = createAutoExploration({
    boundaries: Array.from({ length: 9 }, (_, i) => ({ id: `boundary-${i}` })),
    overviewReady: () => flags.overview,
    cameraReady: () => flags.camera,
    selectBoundary(g) { group = g; calls.push(['boundary', g.id]); return g.id !== 'boundary-4'; },
    datasets: () => group.id === 'boundary-5' ? [] : ['first', 'second', 'third', 'fourth'],
    enterBoundary: () => calls.push(['enter']),
    indicators: () => visitIndicators ? ['co2', 'radiative-forcing'] : [],
    selectIndicator: id => calls.push(['indicator', id]),
    selectDataset: id => calls.push(['select', id]),
    openDataset: id => calls.push(['load', id]),
    datasetStatus: () => flags,
    cancelDataset: () => calls.push(['cancelDataset']),
    returnToPlanet: () => calls.push(['return']),
    cancelCamera: () => calls.push(['cancelCamera']),
  }, { initialDelayMs: 5, boundarySelectionMs: 2, datasetSelectionMs: 2, datasetHoldMs: 5,
    overviewHoldMs: 2, indicatorHoldMs: 3, idleResumeMs: 45, loadTimeoutMs: 30, ...options });
  return { controller, calls, flags, advance: (n = 1) => { for (let i = 0; i < n; i++) controller.tick(1); } };
}

test('two INDEX cycles, ordered first three datasets, missing nodes and reference-only boundaries', () => {
  const h = harness();
  h.advance(800);
  const boundaries = h.calls.filter(c => c[0] === 'boundary').map(c => c[1]);
  assert.deepEqual(boundaries.slice(0, 18), Array.from({ length: 18 }, (_, i) => `boundary-${i % 9}`));
  assert(!h.calls.some(c => c[1] === 'fourth'));
  assert.deepEqual(h.calls.filter(c => c[0] === 'load').slice(0, 6).map(c => c[1]), ['first', 'second', 'third', 'first', 'second', 'third']);
});

test('visit both indicators before opening common datasets once; manual input cancels between visits', () => {
  const h = harness({}, true);
  h.advance(8);
  assert.equal(h.controller.getState().stage, 'VIEWING INDICATOR');
  assert.equal(h.controller.getState().controlId, 'co2');
  assert(!h.calls.some(call => call[0] === 'load'));
  h.advance(3);
  assert.equal(h.controller.getState().stage, 'SELECTING INDICATOR');
  assert.equal(h.controller.getState().controlId, 'radiative-forcing');
  h.flags.camera = false; h.advance(10);
  assert(!h.calls.some(call => call[0] === 'load'));
  h.flags.camera = true; h.advance(10);
  assert.deepEqual(h.calls.filter(call => call[0] === 'load'), [['load', 'first']]);
  assert.deepEqual(h.calls.filter(call => call[0] === 'indicator'), [['indicator', 'radiative-forcing']]);
  const manual = harness({}, true);
  manual.advance(11); manual.controller.userActivity();
  const count = manual.calls.length; manual.advance(40);
  assert.equal(manual.calls.length, count);
  assert.equal(manual.controller.getState().mode, 'MANUAL');
});

test('readiness gates initialization, camera movement and visualization dwell', () => {
  const h = harness();
  h.flags.overview = false; h.advance(100);
  assert.equal(h.calls.length, 0);
  h.flags.overview = true; h.advance(4); assert.equal(h.calls.length, 0);
  h.flags.camera = false; h.advance(20);
  assert.equal(h.controller.getState().stage, 'ENTERING BOUNDARY');
  assert(!h.calls.some(c => c[0] === 'load'));
  h.flags.camera = true; h.flags.ready = false; h.advance(10);
  assert.equal(h.controller.getState().stage, 'READING DATASET');
  h.flags.ready = true; h.advance();
  assert.equal(h.controller.getState().stage, 'VISUALIZATION READY');
  h.advance(4); assert.equal(h.controller.getState().datasetId, 'first');
  h.advance(); assert.equal(h.controller.getState().datasetId, 'second');
});

test('manual takeover in every active phase cancels camera once and resumes via overview after inactivity', () => {
  for (const phase of ['INITIALIZING', 'SELECTING BOUNDARY', 'ENTERING BOUNDARY', 'SELECTING DATASET', 'READING DATASET', 'VISUALIZATION READY', 'RETURNING TO PLANET']) {
    const h = harness();
    for (let i = 0; h.controller.getState().stage !== phase && i < 100; i++) h.advance();
    assert.equal(h.controller.getState().stage, phase);
    h.controller.userActivity();
    const count = h.calls.length;
    h.advance(44); assert.equal(h.calls.length, count);
    h.controller.userActivity(); h.advance(44); assert.equal(h.calls.length, count);
    h.controller.tick(100, { interacting: true }); assert.equal(h.calls.length, count);
    h.advance(45);
    assert.equal(h.controller.getState().stage, 'RETURNING TO PLANET');
    assert.equal(h.calls.at(-1)[0], 'return');
    assert.equal(h.calls.filter(c => c[0] === 'cancelCamera').length, 1);
  }
});

test('load failures and stalled loads skip safely; hidden time and disposal do not advance', () => {
  const h = harness();
  h.flags.ready = false; h.advance(45);
  assert(h.calls.some(c => c[0] === 'cancelDataset'));
  assert.equal(h.controller.getState().datasetId, 'second');
  const before = h.calls.length;
  h.controller.tick(100000, { visible: false }); assert.equal(h.calls.length, before);
  h.flags.error = 'missing file'; h.advance();
  assert.equal(h.controller.getState().datasetId, 'third');
  h.controller.dispose(); const finalCount = h.calls.length;
  h.advance(500); assert.equal(h.calls.length, finalCount);
});

test('all-dataset setting, loop off, immutable state and unsubscribe', () => {
  const h = harness({ datasetsPerBoundary: null, loop: false });
  let events = 0;
  const off = h.controller.subscribe(state => { assert(Object.isFrozen(state)); events++; });
  h.advance(50); assert(events > 0); off(); const count = events;
  h.advance(1000);
  assert.equal(events, count);
  assert(h.calls.some(c => c[1] === 'fourth'));
  assert.equal(h.controller.getState().stage, 'COMPLETE');
  assert.equal(h.calls.filter(c => c[0] === 'boundary').length, 9);
});
