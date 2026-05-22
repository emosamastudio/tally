import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const results = [];
function R(test, pass) { results.push(pass); console.log(`  ${pass ? '✓' : '✗'} ${test}`); }

console.log('=== Quick L2 Interaction Test ===\n');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 1. Count data-nav-item elements to verify L2 wiring
const itemCount = await page.evaluate(() => document.querySelectorAll('[data-nav-item]').length);
R(`Found ${itemCount} data-nav-item elements`, itemCount > 0);

// 2. Click tasks category, Enter to L2, navigate
await page.locator('nav button[role="tab"]').nth(3).click();
await page.waitForTimeout(500);

// Press Enter to go to L1 first (since click enters L1)
const beforeL2 = await page.evaluate(() => document.querySelectorAll('[data-nav-item]').length);
R(`Task table has ${beforeL2} nav items`, beforeL2 > 0);

// Enter L2
await page.keyboard.press('Enter');
await page.waitForTimeout(400);

// Press ArrowDown several times
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
}

// Check if any item has focus style
const focused = await page.evaluate(() => {
  const items = document.querySelectorAll('[data-nav-item]');
  let found = null;
  items.forEach(el => {
    const s = el.getAttribute('style') || '';
    if (s.includes('accent')) found = el.getAttribute('data-nav-item');
  });
  return found;
});
R(`L2 item focused after ArrowDown: ${focused}`, focused !== null);

// Esc back to L1
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 3. Click planning, navigate to feature-progress, Enter L2
await page.locator('nav button[role="tab"]').nth(1).click();
await page.waitForTimeout(400);

// ArrowDown to feature-progress
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);

// Enter L2
await page.keyboard.press('Enter');
await page.waitForTimeout(400);

const fpFocused = await page.evaluate(() => {
  const items = document.querySelectorAll('[data-nav-item]');
  for (const el of items) {
    const s = el.getAttribute('style') || '';
    if (s.includes('accent')) return el.getAttribute('data-nav-item');
  }
  return null;
});
R(`FeatureProgress L2 focused: ${fpFocused}`, fpFocused !== null);

// Enter to expand
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const expanded = await page.evaluate(() => document.querySelectorAll('.sk-mono.truncate').length > 5);
R('FeatureProgress expanded after L2 Enter', expanded);

// Esc back
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 4. Test ←→ from L1
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
const tabAfterRight = await page.evaluate(() => {
  const tabs = document.querySelectorAll('nav button[role="tab"]');
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].getAttribute('aria-selected') === 'true') return i;
  }
  return -1;
});
R(`ArrowRight from L1 switches to tab ${tabAfterRight}`, tabAfterRight === 2); // should be 执行

await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
const tabAfterLeft = await page.evaluate(() => {
  const tabs = document.querySelectorAll('nav button[role="tab"]');
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].getAttribute('aria-selected') === 'true') return i;
  }
  return -1;
});
R(`ArrowLeft returns to tab ${tabAfterLeft}`, tabAfterLeft === 1); // should be 规划

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} passed ===`);

await browser.close();
process.exit(passed === results.length ? 0 : 1);
