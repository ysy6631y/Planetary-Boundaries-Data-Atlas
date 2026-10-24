import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const mode = process.argv[2] || 'before';
const output = process.argv[3] || await mkdtemp(join(tmpdir(), 'planetary-light-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1396 }, reducedMotion: 'reduce' });
try {
  await page.goto(process.env.ATLAS_TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
  await page.keyboard.press('h');
  const snapshot = await page.evaluate(() => ({
    scene: window.__PB_DEBUG__.snapshot(),
    labels: [...document.querySelectorAll('.group-label')].map(el => ({ id: el.dataset.groupLabel, left: el.style.left, top: el.style.top })),
  }));
  const buffer = await page.screenshot({ path: join(output, `${mode}.png`) });
  const png = PNG.sync.read(buffer);
  let bright = 0, white = 0, black = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = png.data.subarray(i, i + 3);
    if (Math.max(r, g, b) > 180) bright++;
    if (Math.min(r, g, b) > 150) white++;
    if (r === 0 && g === 0 && b === 0) black++;
  }
  const result = { snapshot, pixels: { bright, white, black, total: png.width * png.height } };
  if (mode === 'after') {
    const before = JSON.parse(await readFile(join(output, 'before.json'), 'utf8'));
    assert.deepEqual(snapshot, before.snapshot, 'Camera, geometry, node data and label positions must remain identical');
    assert(result.pixels.bright > before.pixels.bright, 'Signals should be more legible');
    console.log(JSON.stringify({ before: before.pixels, after: result.pixels, sceneUnchanged: true }));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => window.__PB_DEBUG__.snapshot().failed === 0);
  }
  await writeFile(join(output, `${mode}.json`), JSON.stringify(result, null, 2));
  console.log(output);
} finally { await browser.close(); }
