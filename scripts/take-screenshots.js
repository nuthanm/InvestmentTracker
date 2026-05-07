// Captures 16 screenshots of the full app flow and saves them to screenshots/.
// Re-run this whenever the UI changes to keep the README images up to date.
//
// Setup (one-time):
//   npm install -D playwright
//   npx playwright install chromium
//
// Usage:
//   npm run dev                       ← terminal 1
//   node scripts/take-screenshots.js  ← terminal 2

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const PIN = '123456';
const NAME = 'Demo User';
// Unique mobile per run so signup never conflicts
const MOBILE = `+91 9${Date.now().toString().slice(-9)}`;
const OUT = path.resolve(__dirname, '..', 'screenshots');

async function snap(page, filename) {
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
  console.log(`  ✓ screenshots/${filename}`);
}

async function enterPin(page, pin) {
  const inputs = page.locator('input[type="password"]');
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).click();
    await page.keyboard.type(pin[i]);
    await page.waitForTimeout(80);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`\n🎬  Taking screenshots  (mobile: ${MOBILE})\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // ── 1. Signup — details form ────────────────────────────────────────
  console.log('[ 1/16 ] Signup — empty form');
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForLoadState('networkidle');
  await snap(page, '01-signup.png');

  await page.fill('input[placeholder="Karthik R."]', NAME);
  await page.fill('input[type="tel"]', MOBILE);

  // ── 2. Signup — filled ─────────────────────────────────────────────
  console.log('[ 2/16 ] Signup — details filled');
  await snap(page, '02-signup-filled.png');
  await page.click('button[type="submit"]');

  // ── 3. Signup — set PIN ────────────────────────────────────────────
  console.log('[ 3/16 ] Signup — set PIN');
  await page.waitForSelector('text=Choose a 6-digit PIN');
  await snap(page, '03-signup-set-pin.png');
  await enterPin(page, PIN);

  // ── 4. Signup — confirm PIN ────────────────────────────────────────
  console.log('[ 4/16 ] Signup — confirm PIN');
  await page.waitForSelector('text=Confirm your PIN');
  await snap(page, '04-signup-confirm-pin.png');
  await enterPin(page, PIN);

  // ── 5. Home — empty state ──────────────────────────────────────────
  console.log('[ 5/16 ] Home — empty state');
  await page.waitForURL(`${BASE_URL}/home`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await snap(page, '05-home-empty.png');

  // ── 6. New goal — blank form ───────────────────────────────────────
  console.log('[ 6/16 ] New goal — blank form');
  await page.click('a[href="/goals/new"]');
  await page.waitForLoadState('networkidle');
  await snap(page, '06-new-goal.png');

  // ── 7. New goal — filled ───────────────────────────────────────────
  console.log('[ 7/16 ] New goal — filled in');
  await page.fill('input[placeholder="e.g. Car, Wedding, Vacation"]', 'Dream Vacation');
  await page.fill('input[type="number"]', '300000');
  await page.fill('input[type="date"]', '2026-12-31');
  await page.locator('button', { hasText: 'travel' }).click();
  await snap(page, '07-new-goal-filled.png');
  await page.click('button:has-text("Create goal")');

  // ── 8. Goals list ─────────────────────────────────────────────────
  console.log('[ 8/16 ] Goals list');
  await page.waitForURL(`${BASE_URL}/goals`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await snap(page, '08-goals-list.png');

  // ── 9. New investment — blank ──────────────────────────────────────
  console.log('[ 9/16 ] New investment — blank form');
  await page.goto(`${BASE_URL}/investments/new`);
  await page.waitForLoadState('networkidle');
  await snap(page, '09-new-investment.png');

  // ── 10. New investment — filled (with maturity preview) ────────────
  console.log('[10/16 ] New investment — filled in');
  await page.fill('input[placeholder="HDFC Bank, Groww, Zerodha…"]', 'HDFC Bank');
  await page.fill('input[placeholder="Senior FD - 5Y"]', 'Flexi Fixed Deposit');
  await page.fill('input[placeholder="300000"]', '500000');
  await page.fill('input[placeholder="7.25"]', '7.25');
  await page.waitForTimeout(500); // let the maturity calculator render
  await page.fill('input[placeholder="Full name"]', 'Priya Sharma');
  await snap(page, '10-new-investment-filled.png');
  await page.click('button:has-text("Save investment")');

  // ── 11. Investments list ───────────────────────────────────────────
  console.log('[11/16 ] Investments list');
  await page.waitForURL(`${BASE_URL}/investments`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await snap(page, '11-investments-list.png');

  // ── 12. Investment detail ──────────────────────────────────────────
  console.log('[12/16 ] Investment detail');
  await page.locator('a[href^="/investments/"]:not([href="/investments/new"])').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await snap(page, '12-investment-detail.png');

  // ── 13. Home — dashboard (with data) ──────────────────────────────
  console.log('[13/16 ] Home — dashboard with data');
  await page.goto(`${BASE_URL}/home`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await snap(page, '13-home-dashboard.png');

  // ── 14. Notifications ─────────────────────────────────────────────
  console.log('[14/16 ] Notifications');
  await page.goto(`${BASE_URL}/notifications`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await snap(page, '14-notifications.png');

  // ── 15. Account ───────────────────────────────────────────────────
  console.log('[15/16 ] Account page');
  await page.goto(`${BASE_URL}/account`);
  await page.waitForLoadState('networkidle');
  await snap(page, '15-account.png');

  // ── 16. Login page (after sign-out) ───────────────────────────────
  console.log('[16/16 ] Login page');
  // First click reveals the confirmation row
  await page.locator('span.text-danger', { hasText: 'Sign out' }).click();
  await page.waitForSelector('text=Sure you want to sign out?');
  // Second click (the bg-danger confirmation button) signs out
  await page.locator('button', { hasText: 'Sign out' }).last().click();
  await page.waitForURL(`${BASE_URL}/login`);
  await snap(page, '16-login.png');

  await browser.close();
  console.log(`\n✅  16 screenshots saved → screenshots/\n`);
}

main().catch((err) => {
  console.error('\n❌ ', err.message);
  process.exit(1);
});
