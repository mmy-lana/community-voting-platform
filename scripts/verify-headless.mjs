// Headless Chrome Verification Gate (Rule 4)
// Usage: node scripts/verify-headless.mjs <url> [--shots dir]
// Criteria: zero console errors / uncaught exceptions, zero 4xx/5xx responses,
// stable DOM mounting at 360px and 1024px, interactive targets >= 44x44px.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5102/';
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;

const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
const shells = fs
  .readdirSync(cacheRoot)
  .filter((d) => d.startsWith('chromium_headless_shell-'))
  .sort();
const latest = shells[shells.length - 1];
const executablePath = path.join(
  cacheRoot,
  latest,
  'chrome-headless-shell-mac-arm64',
  'chrome-headless-shell',
);

function fail(msg) {
  console.error(`GATE FAIL: ${msg}`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath });
const defects = [];

async function auditViewport(width, height, label) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  page.on('pageerror', (err) => defects.push(`[${label}] uncaught exception: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') defects.push(`[${label}] console.error: ${msg.text()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) defects.push(`[${label}] HTTP ${res.status()} ${res.url()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
  if (nodeCount < 10) defects.push(`[${label}] DOM barely mounted (${nodeCount} nodes)`);

  const smallTargets = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, input, select, [role="button"]')];
    return els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((r) => r.w > 0 && (r.w < 44 || r.h < 44));
  });
  if (smallTargets.length > 0) {
    defects.push(`[${label}] targets <44px: ${JSON.stringify(smallTargets)}`);
  }

  if (shotsDir) {
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: path.join(shotsDir, `${label}.png`), fullPage: true });
  }

  await context.close();
  console.log(`[${label}] ${width}x${height}: ${nodeCount} nodes, ${smallTargets.length} small targets`);
}

await auditViewport(360, 800, 'mobile-360');
await auditViewport(1024, 800, 'desktop-1024');
await auditViewport(1440, 900, 'desktop-1440');

await browser.close();

if (defects.length > 0) {
  console.error('GATE FAIL — defects:');
  for (const d of defects) console.error(' - ' + d);
  process.exit(1);
}
console.log('GATE PASS: console clean, network clean, responsive mount verified, targets >=44px.');
