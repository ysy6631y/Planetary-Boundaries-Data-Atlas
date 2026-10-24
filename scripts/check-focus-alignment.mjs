import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'planetary-focus-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const samePosition = (a, b) => assert(Math.hypot(...a.map((value, i) => value - b[i])) < 1e-8);
page.on('pageerror', error => errors.push(error.message));
const sample = () => page.evaluate(() => ({
  motion: window.__PB_DEBUG__.motion(),
  background: window.__PB_DEBUG__.backgroundMotion(),
  snapshot: window.__PB_DEBUG__.snapshot(),
  navigation: window.__PB_DEBUG__.navigation(),
}));
try {
  await page.goto(process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready && !window.__PB_DEBUG__.motion().focusing);
  await page.evaluate(() => {
    window.focusHistory = [];
    window.__PB_EXPLORATION__.subscribe(state => window.focusHistory.push(state));
  });
  const alignment = await page.evaluate(() => {
    const label = document.querySelector('[data-group-label="climate-change"]');
    const rect = label.getBoundingClientRect();
    const point = window.__PB_DEBUG__.project('co2');
    return { labelY: rect.y + rect.height / 2, point };
  });
  assert(alignment.labelY < alignment.point.y - 100, 'Restore the original upper CLIMATE boundary label');
  await page.screenshot({ path: join(output, 'overview.png') });
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().stage === 'VISUALIZATION READY');
  assert.equal(await page.evaluate(() => window.__PB_EXPLORATION__.getState().boundaryId), 'climate-change');
  const before = await sample();
  const visits = await page.evaluate(() => window.focusHistory.filter(state => state.stage === 'VIEWING INDICATOR').map(state => state.controlId));
  assert.deepEqual(visits, ['co2', 'radiative-forcing']);
  assert.equal(before.navigation.scope, 'boundary');
  assert.equal(before.snapshot.selectedId, 'radiative-forcing');
  const finalNode = before.snapshot.points.find(point => point.id === 'radiative-forcing');
  samePosition(finalNode.position, before.snapshot.camera.target);
  samePosition(before.navigation.fieldAnchor, finalNode.position);
  await page.waitForTimeout(1200);
  const after = await sample();
  assert.equal(after.motion.motionPaused, true);
  assert.deepEqual(after.motion.orbitAngles, before.motion.orbitAngles);
  assert.deepEqual(after.motion.boundaryAngles, before.motion.boundaryAngles);
  assert.equal(after.background.systemRotationAngle, before.background.systemRotationAngle);
  assert.notEqual(after.background.starfieldAngle, before.background.starfieldAngle);
  assert.deepEqual(after.snapshot.camera, before.snapshot.camera);
  await page.screenshot({ path: join(output, 'focused.png') });
  await page.waitForFunction(() => window.__PB_EXPLORATION__.getState().stage === 'SELECTING NEXT BOUNDARY');
  assert.equal(await page.evaluate(() => window.focusHistory.filter(state => state.stage === 'READING DATASET').length), 3, 'Read shared datasets only once after both indicator visits');
  const returned = await sample();
  await page.waitForTimeout(500);
  const resumed = await sample();
  assert.equal(resumed.motion.motionPaused, false);
  assert.notEqual(resumed.motion.orbitAngles[0], returned.motion.orbitAngles[0]);
  assert.equal(resumed.snapshot.failed, 0);
  for (const id of ['co2', 'radiative-forcing']) {
    await page.locator('#index-trigger').click();
    await page.locator(`[data-control="${id}"]`).click();
    await page.waitForFunction(() => window.__PB_DEBUG__.atlas().dataset && !window.__PB_DEBUG__.motion().focusing);
    const manual = await sample();
    assert.equal(manual.navigation.scope, 'control');
    const node = manual.snapshot.points.find(point => point.id === id);
    samePosition(manual.snapshot.camera.target, node.position);
    samePosition(manual.navigation.fieldAnchor, node.position);
  }
  await page.locator('#index-trigger').click();
  await page.locator('.group-title').first().click();
  await page.waitForFunction(() => !window.__PB_DEBUG__.motion().focusing);
  const boundary = await sample();
  assert.equal(boundary.navigation.scope, 'boundary');
  samePosition(boundary.snapshot.camera.target, boundary.navigation.fieldAnchor);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', originalLabelRestored: true, nodeCenteredFraming: true, finalIndicator: 'radiative-forcing', individualNodeFocus: true, readingOrbitsFrozen: true, starsMoving: true, overviewOrbitsResumed: true, output }));
} finally { await browser.close(); }
