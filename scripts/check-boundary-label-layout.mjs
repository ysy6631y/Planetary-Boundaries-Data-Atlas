import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const output = await mkdtemp(join(tmpdir(), 'planetary-original-labels-'));
// Use the pre-tour UI with the archived original fixed-direction expression.
const archived = execFileSync('git', ['show', '699cd0a^:src/main.js'], { encoding: 'utf8' });
const originalExpression = 'const v = new THREE.Vector3(...group.direction).multiplyScalar(3.25).project(camera);';
assert(archived.includes(originalExpression));
const reference = execFileSync('git', ['show', '3b6bd72:src/main.js'], { encoding: 'utf8' })
  .replace('const groupDirection = groupWorldDirection(group);\n    const v = groupDirection.multiplyScalar(3.25).project(camera);', originalExpression);
assert(reference.includes(originalExpression));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5173/';
const errors = [], layouts = {};
const closePosition = (a, b) => assert(Math.hypot(...a.map((v, i) => v - b[i])) < 1e-8);
try {
  for (const mode of ['reference', 'current']) {
    // Identical stationary camera makes the pixel comparison reproducible.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    if (mode === 'reference') await page.route('**/src/main.js', route => route.fulfill({ body: reference, contentType: 'application/javascript' }));
    await page.goto(url);
    await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
    layouts[mode] = await page.locator('.group-label').evaluateAll(elements => elements.map(el => ({ id: el.dataset.groupLabel, x: parseFloat(el.style.left), y: parseFloat(el.style.top), hidden: el.hidden })));
    await page.screenshot({ path: join(output, `${mode}.png`) });
    await page.close();
  }
  assert.equal(layouts.current.length, 9);
  assert.deepEqual(layouts.current, layouts.reference, 'All nine labels must match the original fixed layout');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready && !window.__PB_DEBUG__.motion().focusing);
  const groups = await page.evaluate(() => window.__PB_DEBUG__.snapshot().groupDirections);
  await page.screenshot({ path: join(output, 'overview-normal-motion.png') });
  const results = [];
  for (const group of groups) {
    await page.locator('#index-trigger').click();
    await page.locator(`.group-title[data-group="${group.id}"]`).click();
    await page.waitForFunction(() => !window.__PB_DEBUG__.motion().focusing && !document.querySelector('#local-field').classList.contains('loading'));
    const result = await page.evaluate(() => ({ atlas: window.__PB_DEBUG__.atlas(), navigation: window.__PB_DEBUG__.navigation(), snapshot: window.__PB_DEBUG__.snapshot() }));
    const expected = group.direction.map(v => v * 3.25);
    closePosition(result.navigation.boundaryAnchor, expected);
    const node = result.snapshot.points.find(point => point.id === result.snapshot.selectedId);
    const focusTarget = node?.position ?? expected;
    closePosition(result.snapshot.camera.target, focusTarget);
    if (result.atlas.available.length) closePosition(result.navigation.fieldAnchor, focusTarget);
    assert.equal(result.atlas.boundary, group.id);
    assert.equal(result.atlas.error, null);
    assert.equal(result.snapshot.failed, 0);
    await page.screenshot({ path: join(output, `${group.id}.png`) });
    results.push({ id: group.id, originalAnchor: true, cameraMatches: true, hasLocalData: Boolean(result.atlas.available.length) });
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'report.json'), JSON.stringify({ layouts, results, errors }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', labelsMatchingOriginal: 9, boundariesVerified: results.length, output }));
} finally { await browser.close(); }
