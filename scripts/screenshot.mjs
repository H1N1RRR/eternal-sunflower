import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = fileURLToPath(new URL('../artifacts/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 4175, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

try {
  for (const [name, viewport] of Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1366, height: 768 } })) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4175/?complete=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ETERNAL_SUNFLOWER_READY__ === true);
    await page.waitForTimeout(900);
    if (await page.locator('#fallback').isVisible()) {
      throw new Error('WebGL fallback is visible; cannot create a faithful flower preview in this browser.');
    }
    await page.screenshot({ path: path.join(output, `preview-${name}.png`), fullPage: true });
    await page.close();
  }
  console.log('Saved artifacts/preview-mobile.png and artifacts/preview-desktop.png');
} finally {
  await browser.close();
  await server.close();
}
