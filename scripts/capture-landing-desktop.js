const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const outPath = path.resolve(__dirname, '..', 'screenshots', '00-landing-page.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`saved ${outPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
