import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const output = await mkdtemp(join(tmpdir(), 'planetary-exploration-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => window.__PB_EXPLORATION__.getState());
try {
  await page.goto(process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__PB_EXPLORATION__ && window.__PB_DEBUG__.overview().ready);
  await page.evaluate(() => {
    window.tourHistory = [];
    window.__PB_EXPLORATION__.subscribe(state => window.tourHistory.push({ ...state, time: performance.now() }));
    window.cameraSamples = { finite: true, maxStep: 0, frames: 0 };
    let previous;
    function sample() {
      const position = window.__PB_DEBUG__.snapshot().camera.position;
      window.cameraSamples.finite &&= position.every(Number.isFinite);
      if (previous) window.cameraSamples.maxStep = Math.max(window.cameraSamples.maxStep, Math.hypot(...position.map((v, i) => v - previous[i])));
      previous = position;
      window.cameraSamples.frames++;
      requestAnimationFrame(sample);
    }
    sample();
  });
  assert.equal((await state()).stage, 'INITIALIZING');
  await page.screenshot({ path: join(output, 'overview.png') });
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().stage === 'ENTERING BOUNDARY');
  const first = await page.evaluate(() => window.tourHistory[0]);
  assert(first.time >= 5000, 'First selection must wait for initial overview');
  // Trusted pointer input interrupts an in-flight automatic camera movement.
  await page.mouse.move(1100, 500);
  await page.mouse.down(); await page.mouse.up();
  assert.equal((await state()).mode, 'MANUAL');
  const before = await page.evaluate(() => ({ motion: window.__PB_DEBUG__.motion(), camera: window.__PB_DEBUG__.snapshot().camera }));
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => ({ motion: window.__PB_DEBUG__.motion(), camera: window.__PB_DEBUG__.snapshot().camera }));
  assert.equal(after.motion.focusing, false);
  assert.equal(after.motion.motionPaused, true);
  assert.deepEqual(after.motion.orbitAngles, before.motion.orbitAngles, 'Focused scene must remain steady during manual takeover');
  assert.deepEqual(after.camera, before.camera, 'Automatic camera must leave manual view alone');
  // Existing INDEX interaction must remain functional.
  await page.locator('#index-trigger').click();
  await page.locator('.group-title').nth(1).click();
  assert.equal((await state()).mode, 'MANUAL');
  assert.equal(await page.evaluate(() => window.__PB_DEBUG__.atlas().boundary), 'biosphere-integrity');
  console.log('Manual takeover, steady focused scene and INDEX selection passed; checking 45-second idle return.', output);
  await page.waitForTimeout(40000);
  assert.equal((await state()).mode, 'MANUAL');
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().mode === 'AUTO', null, { timeout: 15000 });
  assert.equal((await state()).stage, 'RETURNING TO PLANET');
  const resumeAt = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().stage === 'VISUALIZATION READY', null, { timeout: 30000 });
  await page.screenshot({ path: join(output, 'dataset.png') });
  let lastBoundary;
  const deadline = Date.now() + 600000;
  while ((await state()).cycle < 2) {
    if (Date.now() > deadline) throw new Error('Two-cycle test timed out');
    await page.waitForTimeout(1000);
    const current = await state();
    if (current.boundaryId && current.boundaryId !== lastBoundary) {
      console.log(`Cycle ${current.cycle + 1}: ${current.boundaryId} / ${current.stage}`);
      lastBoundary = current.boundaryId;
    }
  }
  const report = await page.evaluate(() => ({ history: window.tourHistory, camera: window.cameraSamples, snapshot: window.__PB_DEBUG__.snapshot(), motion: window.__PB_DEBUG__.motion() }));
  const selections = report.history.filter(entry => entry.time > resumeAt && entry.stage === 'SELECTING BOUNDARY');
  const order = await page.locator('.group-title').evaluateAll(elements => elements.map(el => el.dataset.group));
  assert.deepEqual(selections.slice(0, 18).map(entry => entry.boundaryId), [...order, ...order]);
  assert(report.camera.finite);
  assert.equal(report.snapshot.failed, 0);
  assert.equal(report.snapshot.stateUnchanged, true);
  assert.equal(report.motion.motionPaused, true);
  assert.deepEqual(errors, []);
  const ready = report.history.filter(entry => entry.stage === 'VISUALIZATION READY');
  assert(ready.filter(entry => entry.datasetId).length >= 36);
  assert(!report.history.some(entry => entry.error));
  await writeFile(join(output, 'report.json'), JSON.stringify({ ...report, errors }, null, 2));
  await page.screenshot({ path: join(output, 'two-cycles.png') });
  console.log(JSON.stringify({ result: 'PASS', cycles: 2, datasetsShown: ready.filter(entry => entry.datasetId).length, camera: report.camera, output }));
} finally {
  await browser.close();
}
