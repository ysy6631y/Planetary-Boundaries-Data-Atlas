import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:5174');
  await page.waitForFunction(() => window.__PB_DEBUG__?.overview().ready);
  await page.locator('#index-trigger').click();
  await page.locator('[data-group="climate-change"]').click();
  await page.waitForFunction(() => !!window.__PB_DEBUG__.atlas().dataset);
  await page.waitForTimeout(1200);
  await page.locator('#source-record').fill('2');
  await page.locator('#source-record').dispatchEvent('change');
  for (const [name, bottom, right] of [['lighter', .90, .92], ['balanced', .92, .94], ['denser', .94, .96]]) {
    await page.evaluate(({ bottom, right }) => {
      document.querySelector('#local-field').style.background = `rgba(0,0,0,${bottom})`;
      document.querySelector('#inspector').style.background = `rgba(0,0,0,${right})`;
    }, { bottom, right });
    await page.screenshot({ path: `validation/ui-surface-${name}.png` });
  }
  const rects = await Promise.all(['fit', 'focus', 'ui-toggle'].map(id => page.locator(`#${id}`).boundingBox()));
  assert.equal(new Set(rects.map(r => r.y)).size, 1);
  assert.equal(new Set(rects.map(r => r.height)).size, 1);
  assert.equal(await page.locator('#fit').getAttribute('aria-pressed'), null);
  for (const id of ['pb-toggle', 'hr-toggle']) {
    await page.locator(`#${id}`).uncheck();
    assert.equal(await page.locator(`#${id}`).isChecked(), false);
    await page.locator(`#${id}`).check();
  }
  await page.locator('#ui-toggle').click();
  assert.equal(await page.locator('#ui-toggle').innerText(), 'UI OFF');
  await page.locator('#ui-toggle').click();
  assert.equal(await page.locator('#ui-toggle').innerText(), 'UI ON');
  console.log('PASS: surface comparisons, toolbar alignment, command/toggle semantics, layer toggles, UI hide/restore');
} finally { await browser.close(); }
