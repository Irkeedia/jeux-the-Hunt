// Test fumée : lance le jeu en headless, clique JOUER, vérifie l'absence
// d'erreurs console et mesure le temps moyen par frame.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const exe = path.join(
  os.homedir(),
  '.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'
);

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:8123/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.click('#btn-play');
// fuit vers le haut pour rester en vie pendant la mesure
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1500);

// Mesure du coût moyen d'une frame sur 120 frames
const avgMs = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      function tick() {
        if (++n >= 120) resolve((performance.now() - t0) / n);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })
);

await page.screenshot({ path: 'smoke-gameplay.png' });
console.log('Erreurs console:', errors.length ? errors : 'aucune');
console.log('Temps moyen par frame:', avgMs.toFixed(2), 'ms');
await browser.close();
