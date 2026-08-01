// The symbols screen on the tablet, including the Kotlin TextToSpeech bridge.
const { attach } = require('./cdp.js');
const { execFileSync } = require('child_process');

const ADB = `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`;
const PKG = 'com.tynan.mathtutor';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

function forwardDevtools() {
  const unix = adb('shell', 'cat', '/proc/net/unix');
  const n = [...unix.matchAll(/@(webview_devtools_remote_\d+)/g)].map((m) => m[1]);
  if (!n.length) return false;
  adb('forward', '--remove-all');
  adb('forward', 'tcp:9223', `localabstract:${n[n.length - 1]}`);
  return true;
}
async function reattach(match) {
  for (let i = 0; i < 30; i++) {
    try { if (forwardDevtools()) return await attach(match); } catch { /* loading */ }
    await sleep(500);
  }
  throw new Error(`could not attach to ${match}`);
}

(async () => {
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(1200);
  adb('shell', 'am', 'start', '-n', `${PKG}/.SymbolsActivity`);
  await sleep(3000);

  const top = adb('shell', 'dumpsys', 'activity', 'activities');
  ok('SymbolsActivity launches', /topResumedActivity.*SymbolsActivity/.test(top));

  const page = await reattach('symbols.html');
  ok('the symbols page loads from the APK assets',
    page.url.includes('android_asset/formulas/symbols.html'), page.url);

  let r = JSON.parse(await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 600));
    return JSON.stringify({
      symbols: SYMBOLS.length, readings: READINGS.length,
      cards: document.querySelectorAll('.sym').length,
      rendered: document.querySelectorAll('.katex').length,
      pending: document.querySelectorAll('.tex-pending').length,
      noHScroll: document.body.scrollWidth <= window.innerWidth + 1,
      speakButtons: document.querySelectorAll('.speak').length,
      bridgeSpeak: typeof Android.speak === 'function',
    });
  })()`));
  ok('all 100 symbols shipped', r.symbols === 100 && r.cards === 100, `${r.cards}`);
  ok('  ...and the 20 readings', r.readings === 20, String(r.readings));
  ok('KaTeX is lazy on device too', r.rendered > 0 && r.rendered < 60,
    `${r.rendered} rendered, ${r.pending} pending`);
  ok('nothing overflows the tablet', r.noHScroll === true);
  ok('the Kotlin speak bridge is present', r.bridgeSpeak === true);

  // Open a card and use the real TextToSpeech path.
  r = JSON.parse(await page.eval(`(async () => {
    const card = document.querySelector('.sym[data-id="partial"]');
    card.querySelector('.sym-head').click();
    await new Promise(r => setTimeout(r, 400));
    const btn = card.querySelector('.speak');
    let threw = null;
    try { if (btn) btn.click(); } catch (e) { threw = e.message; }
    await new Promise(r => setTimeout(r, 500));
    return JSON.stringify({
      meaning: card.querySelector('.sym-meaning').textContent,
      exampleSay: card.querySelector('.ex-say-text').textContent,
      confusables: [...card.querySelectorAll('.cf-name')].map(n => n.textContent),
      glyphRendered: !!card.querySelector('.glyph .katex'),
      exampleRendered: !!card.querySelector('.ex-tex .katex'),
      hasSpeak: !!btn, threw,
    });
  })()`));
  ok('a card opens with its meaning', /curly d/.test(r.meaning), r.meaning.slice(0, 45));
  ok('  ...the glyph and example are typeset', r.glyphRendered && r.exampleRendered);
  ok('  ...the spoken reading is written out', /partial f by partial x/.test(r.exampleSay),
    r.exampleSay);
  ok('  ...and confusions resolve both ways on device',
    r.confusables.length >= 3, r.confusables.join(', '));
  ok('tapping speak reaches TextToSpeech without throwing',
    r.hasSpeak === true && r.threw === null, r.threw || 'no exception');

  // Search by raw LaTeX — the case a student copying from a PDF hits.
  r = JSON.parse(await page.eval(`(async () => {
    const s = document.getElementById('search');
    s.value = '\\\\partial';
    s.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));
    return JSON.stringify({
      n: document.querySelectorAll('.sym').length,
      first: (document.querySelector('.sym-name') || {}).textContent || null,
    });
  })()`));
  ok('searching raw LaTeX works on device', r.n >= 1 && /Partial/.test(r.first),
    `${r.n}: ${r.first}`);

  // The reading tab.
  r = JSON.parse(await page.eval(`(async () => {
    document.getElementById('search').value = '';
    document.getElementById('search').dispatchEvent(new Event('input'));
    document.getElementById('tabRead').click();
    await new Promise(r => setTimeout(r, 600));
    const quad = document.querySelector('.reading[data-id="quadratic-formula"]');
    const tokens = [...quad.querySelectorAll('.token')];
    tokens[3].click();
    await new Promise(r => setTimeout(r, 300));
    return JSON.stringify({
      cards: document.querySelectorAll('.reading').length,
      chipsHidden: document.getElementById('chips').classList.contains('hidden'),
      tokens: tokens.length,
      lit: tokens[3].classList.contains('lit'),
      tokenH: Math.round(tokens[0].getBoundingClientRect().height),
      lastToken: tokens[tokens.length - 1].querySelector('.token-tex').textContent.slice(0, 12),
      note: (quad.querySelector('.token-note') || {}).textContent || null,
      noHScroll: document.body.scrollWidth <= window.innerWidth + 1,
    });
  })()`));
  ok('the reading tab works on device', r.cards === 20, String(r.cards));
  ok('  ...the browse-only chips are hidden there', r.chipsHidden === true);
  ok('  ...a token highlights when tapped', r.lit === true);
  ok('  ...tokens are 44px targets', r.tokenH >= 44, String(r.tokenH));
  ok('  ...the placeholder numerator shows an ellipsis, not a bare bar',
    /⋯|\.\.\./.test(r.lastToken), JSON.stringify(r.lastToken));
  ok('  ...grouping notes are shown', !!r.note, (r.note || '').slice(0, 50));
  ok('  ...and it still fits the screen', r.noHScroll === true);

  page.close();
  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR:', e.message); process.exit(1); });
