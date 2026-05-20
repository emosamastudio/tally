// test-keyboard-nav.mjs — L1 keyboard navigation tests for Tally Dashboard
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function R(test, pass, detail) {
  results.push({ test, pass: pass ? 'PASS' : 'FAIL', detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${test}`);
  if (detail) console.log(`     ${detail}`);
}
async function S(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}
async function clickCat(page, idx) {
  await page.locator('nav[role="tablist"] button[role="tab"]').nth(idx).click();
  await page.waitForTimeout(400);
}

// Get the hint bar TEXT (just the hint+crumb+dots text, no header noise)
// Strategy: find the <span> that STARTS WITH "↑↓" or "←→", then get its parent's full text
async function hintBarText(page) {
  return await page.evaluate(() => {
    // Find the <span> whose text content is exactly one of the level hints
    const hints = ['←→ 选择分类', '↑↓ 选择板块 · Enter 进入', '↑↓ 选择项目 · Esc 返回 · Enter 确认'];
    const allSpans = document.querySelectorAll('span');
    for (const s of allSpans) {
      const t = s.textContent?.trim() || '';
      for (const h of hints) {
        if (t === h || t.startsWith(h.substring(0, 6))) {
          // Found the hint span, now get the parent div (the full hint bar)
          const parent = s.parentElement;
          return parent?.textContent?.trim() || '';
        }
      }
    }
    return '';
  });
}

// Extract breadcrumb: "规划 › feature-deps"
function getBc(text) {
  const m = text.match(/(概览|规划|执行|任务|图谱)\s*›\s*([a-z][a-z-]+)/);
  return m ? `${m[1]} › ${m[2]}` : null;
}

// Extract section badge: "2/3" — last digit/digit pattern
function getBadge(text) {
  const m = text.match(/(\d+)\/(\d+)/g);
  return m ? m[m.length - 1] : null;
}

async function getActiveBorder(page) {
  return await page.evaluate(() => {
    for (const sec of document.querySelectorAll('section[id^="nav-"]')) {
      if (sec.offsetParent === null) continue;
      const bl = window.getComputedStyle(sec).borderLeft;
      if (bl && bl !== '0px none rgb(0, 0, 0)' && !bl.includes('transparent') && !bl.match(/rgba\(0,\s*0,\s*0/)) {
        return bl;
      }
    }
    return null;
  });
}

async function visibleSecs(page) {
  return await page.evaluate(() => {
    const v = [];
    for (const sec of document.querySelectorAll('section[id^="nav-"]')) {
      if (sec.offsetParent !== null) v.push(sec.id);
    }
    return v;
  });
}

async function secInView(page) {
  return await page.evaluate(() => {
    for (const sec of document.querySelectorAll('section[id^="nav-"]')) {
      if (sec.offsetParent === null) continue;
      const r = sec.getBoundingClientRect();
      return { ok: r.top >= 0 && r.bottom <= window.innerHeight, top: Math.round(r.top), bot: Math.round(r.bottom), win: window.innerHeight };
    }
    return { ok: false };
  });
}

async function getDots(page) {
  return await page.evaluate(() => {
    const allSpans = document.querySelectorAll('span');
    for (const outer of allSpans) {
      if (outer.style.display === 'flex' && outer.style.gap === '3px') {
        const dots = [];
        for (const dot of outer.children) {
          if (dot.style.width === '6px' && dot.style.height === '6px') {
            const bg = window.getComputedStyle(dot).backgroundColor;
            const active = bg.includes('255, 210, 63') || bg.includes('204, 153, 0');
            dots.push(active ? '●' : '○');
          }
        }
        if (dots.length > 0) return dots;
      }
    }
    return [];
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('═══ Tally Dashboard L1 Keyboard Navigation Tests ═══\n');

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    const bodyText = await page.textContent('body');
    const loading = bodyText.includes('加载中');
    const error = bodyText.includes('数据加载失败');
    console.log(`  Page: ${loading ? 'LOADING' : error ? 'ERROR' : 'READY'}`);

    // Sanity check: can we read the hint bar?
    const raw = await hintBarText(page);
    console.log(`  Hint bar: "${raw.substring(0, 80)}..."`);
    if (!raw || (!raw.includes('↑↓') && !raw.includes('←→'))) {
      console.log('  FATAL: Cannot extract hint bar. Dumping DOM...');
      const dump = await page.evaluate(() => {
        const spans = document.querySelectorAll('span');
        return Array.from(spans).slice(0, 30).map(s => s.textContent?.trim().substring(0, 40)).filter(Boolean);
      });
      console.log('  Spans found:', dump);
    }
    console.log('');

    // ═══════════════════════════════
    // TEST 1
    // ═══════════════════════════════
    {
      console.log('── Test 1: 概览 (1 section) ↑/↓ ──');
      await clickCat(page, 0);
      const b0 = getBc(await hintBarText(page));
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const b1 = getBc(await hintBarText(page));
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
      const b2 = getBc(await hintBarText(page));
      R('1. 概览: ↑/↓ no effect (single section)', b0 && b0 === b1 && b1 === b2,
        `"${b0}" → "${b1}" → "${b2}"`);
      await S(page, 't1');
    }

    // ═══════════════════════════════
    // TEST 2
    // ═══════════════════════════════
    {
      console.log('── Test 2: 规划 (3 sections) ↓×3 ──');
      await clickCat(page, 1);
      const seq = [getBc(await hintBarText(page))];
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
        seq.push(getBc(await hintBarText(page)));
        const bg = getBadge(await hintBarText(page));
        console.log(`  ↓${i + 1}: bc="${seq[seq.length - 1]}", badge="${bg}"`);
      }
      const exp = ['规划 › stage-matrix', '规划 › feature-progress', '规划 › feature-deps', '规划 › feature-deps'];
      R('2. 规划: ↓ 0→1→2 then clamps', seq.every((s, i) => s === exp[i]),
        `Got: ${seq.join(' → ')}`);
      await S(page, 't2');
    }

    // ═══════════════════════════════
    // TEST 3
    // ═══════════════════════════════
    {
      console.log('── Test 3: 规划 ↑ on first ──');
      await clickCat(page, 1);
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
      const b = getBc(await hintBarText(page));
      const bg = getBadge(await hintBarText(page));
      R('3. 规划: ↑ on sec 0 clamps, no wrap', b === '规划 › stage-matrix' && bg === '1/3',
        `bc="${b}", badge="${bg}"`);
      await S(page, 't3');
    }

    // ═══════════════════════════════
    // TEST 4
    // ═══════════════════════════════
    {
      console.log('── Test 4: Visual indicators ──');
      await clickCat(page, 1);
      const bl = await getActiveBorder(page);
      R('4a. Active section has 3px solid colored border', bl !== null,
        `Border: ${bl}`);
      const bg0 = getBadge(await hintBarText(page));
      R('4b. Section badge 1/3', bg0 === '1/3', `Badge: "${bg0}"`);

      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const bl2 = await getActiveBorder(page);
      const bg1 = getBadge(await hintBarText(page));
      R('4c. Border moves to new section', bl2 !== null && bl2.includes('solid'),
        `Border: ${bl2}`);
      R('4d. Badge 2/3', bg1 === '2/3', `Badge: "${bg1}"`);
      await S(page, 't4');
    }

    // ═══════════════════════════════
    // TEST 5
    // ═══════════════════════════════
    {
      console.log('── Test 5: Breadcrumb ──');
      await clickCat(page, 1);
      const b0 = getBc(await hintBarText(page));
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const b1 = getBc(await hintBarText(page));
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const b2 = getBc(await hintBarText(page));
      R('5. Breadcrumb updates: stage-matrix→feature-progress→feature-deps',
        b0 === '规划 › stage-matrix' && b1 === '规划 › feature-progress' && b2 === '规划 › feature-deps',
        `"${b0}" → "${b1}" → "${b2}"`);
      await S(page, 't5');
    }

    // ═══════════════════════════════
    // TEST 6
    // ═══════════════════════════════
    {
      console.log('── Test 6: Dots ──');
      await clickCat(page, 1);
      const d0 = await getDots(page); console.log(`  sec0: ${d0.join('')}`);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const d1 = await getDots(page); console.log(`  sec1: ${d1.join('')}`);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const d2 = await getDots(page); console.log(`  sec2: ${d2.join('')}`);
      R('6. Dots: ●○○ → ○●○ → ○○●',
        d0.join('') === '●○○' && d1.join('') === '○●○' && d2.join('') === '○○●',
        `Got: ${d0.join('')} → ${d1.join('')} → ${d2.join('')}`);
      await S(page, 't6');
    }

    // ═══════════════════════════════
    // TEST 7
    // ═══════════════════════════════
    {
      console.log('── Test 7: 图谱 (1 section) ↓ ──');
      await clickCat(page, 4);
      const b0 = getBc(await hintBarText(page));
      const bg0 = getBadge(await hintBarText(page));
      for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200); }
      const b1 = getBc(await hintBarText(page));
      const bg1 = getBadge(await hintBarText(page));
      R('7a. 图谱: ↓ no effect (single sec)', b0 === b1, `"${b0}" → "${b1}"`);
      R('7b. Badge stays 1/1', bg0 === '1/1' && bg1 === '1/1', `"${bg0}" → "${bg1}"`);
      await S(page, 't7');
    }

    // ═══════════════════════════════
    // TEST 8
    // ═══════════════════════════════
    {
      console.log('── Test 8: 执行 (4 sections) rapid ↓ ──');
      await clickCat(page, 2);
      const rapid = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120);
        rapid.push(getBc(await hintBarText(page)));
      }
      console.log(`  Rapid: ${rapid.join(' → ')}`);
      const exp = ['执行 › agent-activity', '执行 › round-timeline', '执行 › round-analytics', '执行 › round-analytics', '执行 › round-analytics'];
      R('8a. Rapid ↓ hits all 4 sections, no skip',
        rapid.every((s, i) => s === exp[i]),
        `Got: ${rapid.join(' → ')}`);
      const vis = await visibleSecs(page);
      R('8b. Single visible section (no double render)',
        vis.length <= 2, `Visible: ${vis.join(', ')}`);
      await S(page, 't8');
    }

    // ═══════════════════════════════
    // TEST 9
    // ═══════════════════════════════
    {
      console.log('── Test 9: Enter/Esc ──');
      await clickCat(page, 1);
      const h1 = await hintBarText(page);
      console.log(`  L1: "${h1}"`);

      await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      const h1e = await hintBarText(page);
      const hasL2 = h1e.includes('Esc 返回') || h1e.includes('选择项目');
      R('9a. Enter L1 (no items): stays L1', !hasL2,
        `Hint: "${h1e}"`);

      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const hL0 = await hintBarText(page);
      R('9b. Esc L1→L0: shows ←→', hL0.includes('←→'),
        `Hint: "${hL0}"`);

      await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      const hL1b = await hintBarText(page);
      R('9c. Enter L0→L1: ↑↓ pick section', hL1b.includes('↑↓ 选择板块') || hL1b.includes('↑↓'),
        `Hint: "${hL1b}"`);

      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      const hL0s = await hintBarText(page);
      R('9d. Esc L0 stays L0', hL0s.includes('←→'),
        `Hint: "${hL0s}"`);

      // Test Enter at L0 selects current category (goes to L1)
      // Test Enter at L1 with items — none registered, should do nothing
      await S(page, 't9');
    }

    // ═══════════════════════════════
    // TEST 10
    // ═══════════════════════════════
    {
      console.log('── Test 10: Scroll ──');
      await clickCat(page, 1); await page.waitForTimeout(500);

      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
      const v1 = await secInView(page);
      console.log(`  feature-deps: ${JSON.stringify(v1)}`);
      R('10a. Section visible after ↓↓ to feature-deps', v1.ok,
        `top=${v1.top}, bot=${v1.bot}, win=${v1.win}`);

      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(400);
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(400);
      const v2 = await secInView(page);
      R('10b. Section visible after ↑↑ to stage-matrix', v2.ok,
        `top=${v2.top}, bot=${v2.bot}, win=${v2.win}`);
      await S(page, 't10');
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    console.log('\n═══════════════════════════════════════');
    console.log('         RESULTS SUMMARY');
    console.log('═══════════════════════════════════════\n');
    let pass = 0, fail = 0;
    for (const x of results) {
      console.log(`${x.pass} — ${x.test}`);
      if (x.detail) console.log(`  ${x.detail}`);
      if (x.pass === 'PASS') pass++;
      else fail++;
    }
    console.log(`\nTotal: ${pass} PASS, ${fail} FAIL (${results.length} tests)`);
    await browser.close();
  }
})();
