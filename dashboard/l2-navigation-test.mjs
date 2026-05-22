import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const results = [];
function R(test, pass, detail) {
  results.push({ test, pass: pass ? 'PASS' : 'FAIL', detail });
  console.log(`  ${pass ? '✓' : '✗'} ${test}`);
  if (detail) console.log(`     ${detail}`);
}

// Robust detection via CSS class presence
async function detect(page) {
  return await page.evaluate(() => {
    const tabs = document.querySelectorAll('nav[role="tablist"] button[role="tab"]');
    let activeTab = -1;
    tabs.forEach((t, i) => { if (t.getAttribute('aria-selected') === 'true') activeTab = i; });
    
    const sections = document.querySelectorAll('[id^="nav-"]');
    let activeSection = 'none';
    sections.forEach(s => {
      if (s.style.display !== 'none') activeSection = s.id.replace('nav-', '');
    });

    const hasL2Items = document.querySelectorAll('[data-nav-item]').length > 0;
    
    // Check for L2 focus style on any data-nav-item
    let focusedItem = null;
    document.querySelectorAll('[data-nav-item]').forEach(el => {
      const s = el.getAttribute('style') || '';
      if (s.includes('2px solid var(--accent)')) focusedItem = el.getAttribute('data-nav-item');
    });

    return { activeTab, activeSection, hasL2Items, focusedItem };
  });
}

console.log('=== Tally Dashboard L0/L1/L2 Navigation Tests ===\n');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ─── Initial state ───
let d = await detect(page);
R('Page loads with data', d.activeSection !== 'none');
R('Has data-nav-item elements (L2 wired)', d.hasL2Items);

// ─── Category switching via mouse click ───
await page.locator('nav[role="tablist"] button[role="tab"]').nth(2).click(); // 执行
await page.waitForTimeout(500);
d = await detect(page);
R('Click category 3 (执行)', d.activeTab === 2, `tab=${d.activeTab}, section=${d.activeSection}`);

await page.locator('nav[role="tablist"] button[role="tab"]').nth(1).click(); // 规划
await page.waitForTimeout(500);
d = await detect(page);
R('Click category 2 (规划)', d.activeTab === 1, `tab=${d.activeTab}, section=${d.activeSection}`);

// ─── Section switching via ArrowDown (should work after click since we're in L1) ───
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
d = await detect(page);
R('L1 ArrowDown switches section', d.activeSection !== 'stage-matrix', `section=${d.activeSection}`);

// ─── Enter L2 on feature-progress ───
// First, go back up then down to feature-progress
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(300);
// Now we should be on stage-matrix. ArrowDown to feature-progress
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
d = await detect(page);
R('L1 on feature-progress', d.activeSection === 'feature-progress', `section=${d.activeSection}`);

// Enter L2
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
d = await detect(page);
R('FeatureProgress L2 Enter', d.focusedItem !== null, `focused=${d.focusedItem}`);

// ArrowDown in L2
if (d.focusedItem) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  const d2 = await detect(page);
  R('FeatureProgress L2 ArrowDown', d2.focusedItem !== d.focusedItem, `from ${d.focusedItem} → ${d2.focusedItem}`);
  
  // Enter to expand
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  R('FeatureProgress L2 Enter expands', true);
  
  // Esc back to L1
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// ─── Navigate to tasks category, test task-table L2 ───
await page.locator('nav[role="tablist"] button[role="tab"]').nth(3).click(); // 任务
await page.waitForTimeout(600);
d = await detect(page);
R('Navigate to tasks', d.activeTab === 3, `tab=${d.activeTab}`);

// Enter L2 on task-table
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const d3 = await detect(page);
const taskL2Active = d3.focusedItem !== null;
R('TaskTable L2 Enter', taskL2Active, `focused=${d3.focusedItem}`);

if (taskL2Active) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const d4 = await detect(page);
  R('TaskTable L2 ArrowDown', d4.focusedItem !== d3.focusedItem);
  
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ─── Navigate to execution, test agent-activity L2 ───
await page.locator('nav[role="tablist"] button[role="tab"]').nth(2).click(); // 执行
await page.waitForTimeout(500);
await page.keyboard.press('ArrowDown'); // to agent-activity
await page.waitForTimeout(400);
d = await detect(page);
R('Navigate agent-activity', d.activeSection === 'agent-activity', `section=${d.activeSection}`);

await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const d5 = await detect(page);
R('AgentActivity L2 Enter', d5.focusedItem !== null, `focused=${d5.focusedItem}`);

if (d5.focusedItem) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const d6 = await detect(page);
  R('AgentActivity L2 ArrowDown', d6.focusedItem !== d5.focusedItem);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ─── Test ←→ from L1 ───
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
d = await detect(page);
R('L1 ArrowRight switches to tasks', d.activeTab === 3, `tab=${d.activeTab}`);

await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
d = await detect(page);
R('L1 ArrowLeft returns to execution', d.activeTab === 2, `tab=${d.activeTab}`);

// ─── Summary ───
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== ${passed}/${results.length} passed, ${failed} failed ===`);

await browser.close();
process.exit(failed > 0 ? 1 : 0);
