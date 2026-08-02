// The symbols reference — shared by the PC tool window and Android's
// SymbolsActivity.
//
// Two surfaces in one page:
//   Browse   every symbol, searchable, grouped by category, each card saying
//            what it means, how to say it, and what it gets confused with.
//   Read     whole expressions broken into the fragments you actually say.
//
// KaTeX is rendered lazily via IntersectionObserver. There are ~100 symbol
// glyphs plus an example each, plus the readings — around 300 renders, and the
// formula sheet already proved that doing that up front costs seconds on a
// phone.

const isElectron = typeof window.tutor !== 'undefined';
const hasBridge = typeof Android !== 'undefined';

const el = {
  search: document.getElementById('search'),
  chips: document.getElementById('chips'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  empty: document.getElementById('empty'),
  tabBrowse: document.getElementById('tabBrowse'),
  tabRead: document.getElementById('tabRead'),
  tabQuiz: document.getElementById('tabQuiz'),
  browse: document.getElementById('browse'),
  read: document.getElementById('read'),
  quiz: document.getElementById('quiz'),
  readings: document.getElementById('readings'),
};

let activeCategory = '';   // '' = all
let openCard = null;

// ---- Lazy typesetting -----------------------------------------------------------------

/**
 * Mark an element to be typeset when it scrolls near the viewport. `tex` is
 * stored on the node rather than rendered now.
 */
const pending = new WeakSet();
const observer = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      typeset(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '400px 0px' })
  : null;

function lazyTex(node, latex, display) {
  node.dataset.tex = latex;
  if (display) node.dataset.display = '1';
  node.classList.add('tex-pending');
  if (observer) { pending.add(node); observer.observe(node); } else { typeset(node); }
  return node;
}

function typeset(node) {
  const latex = node.dataset.tex;
  if (latex == null) return;
  try {
    katex.render(latex, node, {
      throwOnError: false, displayMode: node.dataset.display === '1',
    });
  } catch {
    node.textContent = latex;
  }
  node.classList.remove('tex-pending');
  delete node.dataset.tex;
}

/** Typeset everything inside a container now — used when a card opens. */
function typesetWithin(root) {
  for (const node of root.querySelectorAll('.tex-pending')) {
    if (observer) observer.unobserve(node);
    typeset(node);
  }
}

function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// ---- Speaking -------------------------------------------------------------------------
//
// An enhancement, never the artefact. Web Speech can be silently mute inside an
// Android WebView, so the written "say it" line is always on screen and the
// button only appears where speech actually works.

const speech = (() => {
  const androidSpeak = hasBridge && typeof Android.speak === 'function';
  const webSpeech = typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
  return {
    available: androidSpeak || webSpeech,
    say(text) {
      if (!text) return;
      try {
        if (androidSpeak) { Android.speak(text); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      } catch { /* the written line is still there */ }
    },
  };
})();

function speakButton(text) {
  if (!speech.available) return null;
  const b = make('button', 'speak', '🔊');
  b.title = 'Say it out loud';
  b.setAttribute('aria-label', `Say: ${text}`);
  b.addEventListener('click', (e) => { e.stopPropagation(); speech.say(text); });
  return b;
}

// ---- Browse ----------------------------------------------------------------------------

function buildChips() {
  el.chips.innerHTML = '';
  const all = make('button', 'chip' + (activeCategory ? '' : ' on'), 'All');
  all.addEventListener('click', () => { activeCategory = ''; render(); });
  el.chips.appendChild(all);
  for (const cat of SYMBOL_CATEGORIES) {
    if (!symbolsInCategory(cat.id).length) continue;
    const chip = make('button', 'chip' + (activeCategory === cat.id ? ' on' : ''), cat.name);
    chip.addEventListener('click', () => {
      activeCategory = activeCategory === cat.id ? '' : cat.id;
      render();
    });
    el.chips.appendChild(chip);
  }
}

function symbolCard(sym) {
  const card = make('div', 'sym');
  card.dataset.id = sym.id;

  const head = make('div', 'sym-head');
  head.appendChild(lazyTex(make('span', 'glyph'), sym.glyph, false));
  const titles = make('div', 'sym-titles');
  titles.appendChild(make('div', 'sym-name', sym.name));
  titles.appendChild(make('div', 'sym-say', `say: “${sym.say}”`));
  head.appendChild(titles);
  if (sym.level > 1) head.appendChild(make('span', 'lvl', 'Ext'));
  card.appendChild(head);

  const body = make('div', 'sym-body hidden');
  body.appendChild(make('div', 'sym-meaning', sym.meaning));

  const exWrap = make('div', 'sym-example');
  exWrap.appendChild(lazyTex(make('div', 'ex-tex'), sym.example, true));
  const line = make('div', 'ex-say');
  line.appendChild(make('span', 'ex-say-text', `“${sym.exampleSay}”`));
  const sb = speakButton(sym.exampleSay);
  if (sb) line.appendChild(sb);
  exWrap.appendChild(line);
  body.appendChild(exWrap);

  // The picture belongs with the example, not after the cross-references — it is
  // explaining the same thing the example is. Drawn on open, not now: the body is
  // .hidden until then and a canvas with no layout renders at the wrong size.
  if (sym.viz && typeof renderVisual === 'function') {
    const wrap = make('div', 'sym-viz');
    wrap.appendChild(make('canvas', 'sym-canvas'));
    body.appendChild(wrap);
  }

  const confusables = confusablesOf(sym.id);
  if (confusables.length) {
    const cf = make('div', 'confusable');
    cf.appendChild(make('div', 'cf-label', 'Easily mixed up with'));
    const row = make('div', 'cf-row');
    for (const other of confusables) {
      const pill = make('button', 'cf-pill');
      pill.appendChild(lazyTex(make('span', 'cf-glyph'), other.glyph, false));
      pill.appendChild(make('span', 'cf-name', other.name));
      pill.addEventListener('click', (e) => { e.stopPropagation(); jumpTo(other.id); });
      row.appendChild(pill);
    }
    cf.appendChild(row);
    body.appendChild(cf);
  }

  const uses = readingsUsing(sym.id);
  if (uses.length) {
    const link = make('button', 'reading-link',
      `Read it in context: ${uses[0].full.slice(0, 44)}…`);
    link.addEventListener('click', (e) => { e.stopPropagation(); showReading(uses[0].id); });
    body.appendChild(link);
  }

  card.appendChild(body);
  head.addEventListener('click', () => toggleCard(card, body));
  return card;
}

function toggleCard(card, body) {
  const opening = body.classList.contains('hidden');
  if (openCard && openCard !== card) {
    openCard.querySelector('.sym-body').classList.add('hidden');
    openCard.classList.remove('open');
  }
  body.classList.toggle('hidden', !opening);
  card.classList.toggle('open', opening);
  openCard = opening ? card : null;
  // The card's own example and confusables were deferred; they're needed now.
  if (opening) { typesetWithin(card); drawCard(card); }
}

/**
 * Diagram colours. Mirrors practice.js: the Practice Studio's paper if Kotlin has
 * pushed one, otherwise whatever the page is actually painted.
 */
let paperColors = null;
function vizColors() {
  if (paperColors) return paperColors;
  const cs = getComputedStyle(document.body);
  return { bg: cs.backgroundColor, fg: cs.color, accent: '#4F7DF7' };
}

/** Draw an open card's diagram, if it has one. */
function drawCard(card) {
  if (!card || typeof renderVisual !== 'function') return;
  const canvas = card.querySelector('.sym-canvas');
  const sym = SYMBOL_BY_ID[card.dataset.id];
  if (!canvas || !sym || !sym.viz) return;
  // One frame later: the body lost `.hidden` a moment ago, so the canvas has no
  // layout yet and renderVisual would read 0 and fall back to its 600x280 default.
  requestAnimationFrame(() => {
    try { renderVisual(canvas, sym.viz, vizColors()); } catch { /* the words still work */ }
  });
}

function render() {
  buildChips();
  const found = searchSymbols(el.search.value)
    .filter((s) => !activeCategory || s.category === activeCategory);

  el.list.innerHTML = '';
  openCard = null;
  // Group by category rather than watching for the category to change as we walk
  // the list. SYMBOLS is not sorted by category — a handful of entries sit at the
  // end under a category declared much earlier — so the walking version emitted a
  // second heading for each of them, and that gets worse with every entry added.
  const order = SYMBOL_CATEGORIES.map((c) => c.id);
  const groups = new Map();
  for (const sym of found) {
    if (!groups.has(sym.category)) groups.set(sym.category, []);
    groups.get(sym.category).push(sym);
  }
  const cats = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const catId of cats) {
    if (!activeCategory) {
      const cat = SYMBOL_CATEGORY_BY_ID[catId];
      el.list.appendChild(make('h2', 'cat', cat ? cat.name : catId));
    }
    for (const sym of groups.get(catId)) el.list.appendChild(symbolCard(sym));
  }
  el.count.textContent = found.length === SYMBOLS.length
    ? `${SYMBOLS.length} symbols`
    : `${found.length} of ${SYMBOLS.length}`;
  el.empty.classList.toggle('hidden', found.length > 0);
}

/** Open a specific symbol's card and scroll it into view. */
function jumpTo(symbolId) {
  showTab('browse');
  el.search.value = '';
  activeCategory = '';
  render();
  const card = el.list.querySelector(`.sym[data-id="${symbolId}"]`);
  if (!card) return;
  toggleCard(card, card.querySelector('.sym-body'));
  card.scrollIntoView({ block: 'center' });
}

// ---- Read ------------------------------------------------------------------------------

function readingCard(reading) {
  const card = make('div', 'reading');
  card.dataset.id = reading.id;
  card.appendChild(lazyTex(make('div', 'reading-tex'), reading.latex, true));

  const whole = make('div', 'reading-full');
  whole.appendChild(make('span', 'reading-full-text', `“${reading.full}”`));
  const sb = speakButton(reading.full);
  if (sb) whole.appendChild(sb);
  card.appendChild(whole);

  card.appendChild(make('div', 'token-label', 'Piece by piece, in the order you say them'));
  const toks = make('ol', 'tokens');
  for (const t of reading.tokens) {
    if (!t.say) continue; // a closing brace with nothing to say
    const li = make('li', 'token');
    li.appendChild(lazyTex(make('span', 'token-tex'), t.tex, false));
    li.appendChild(make('span', 'token-say', `“${t.say}”`));
    if (t.note) li.appendChild(make('div', 'token-note', t.note));
    li.addEventListener('click', () => {
      for (const other of toks.querySelectorAll('.token')) other.classList.remove('lit');
      li.classList.add('lit');
      speech.say(t.say);
    });
    toks.appendChild(li);
  }
  card.appendChild(toks);
  return card;
}

function buildReadings() {
  el.readings.innerHTML = '';
  for (const r of READINGS) el.readings.appendChild(readingCard(r));
}

function showReading(id) {
  showTab('read');
  const card = el.readings.querySelector(`.reading[data-id="${id}"]`);
  if (!card) return;
  typesetWithin(card);
  card.scrollIntoView({ block: 'start' });
  card.classList.add('lit');
  setTimeout(() => card.classList.remove('lit'), 1200);
}

// ---- Tabs -------------------------------------------------------------------------------

function showTab(which) {
  const browsing = which === 'browse';
  el.browse.classList.toggle('hidden', !browsing);
  el.read.classList.toggle('hidden', which !== 'read');
  el.tabBrowse.classList.toggle('on', browsing);
  el.tabRead.classList.toggle('on', which === 'read');
  // The quiz tab is optional markup — the page still works on a build that
  // predates it, the same way practice-quiz.js no-ops without its bar.
  if (el.quiz) el.quiz.classList.toggle('hidden', which !== 'quiz');
  if (el.tabQuiz) el.tabQuiz.classList.toggle('on', which === 'quiz');
  // The category chips and the count only describe the browse list. Leaving them
  // up elsewhere is worse than clutter — the count keeps reporting a filter that
  // is no longer doing anything.
  el.chips.classList.toggle('hidden', !browsing);
  el.count.classList.toggle('hidden', !browsing);
  window.scrollTo(0, 0);
}

el.tabBrowse.addEventListener('click', () => showTab('browse'));
el.tabRead.addEventListener('click', () => showTab('read'));
if (el.tabQuiz) el.tabQuiz.addEventListener('click', () => showTab('quiz'));
el.search.addEventListener('input', render);

const closeBtn = document.getElementById('close');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    if (hasBridge && typeof Android.closeWindow === 'function') Android.closeWindow();
    else window.close();
  });
}

/** Paint to match the Practice Studio's paper colour (Android). No-op on PC. */
window.applyPaper = (bg, fg) => {
  // Diagram colours follow the paper, same rule as practice.js: a brighter accent
  // once the paper is dark enough that the standard blue stops reading.
  const hex = String(bg).replace('#', '');
  const lum = hex.length === 6
    ? (0.299 * parseInt(hex.slice(0, 2), 16)
      + 0.587 * parseInt(hex.slice(2, 4), 16)
      + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255
    : 1;
  paperColors = { bg, fg, accent: lum < 0.4 ? '#7DA7FF' : '#4F7DF7' };
  // An already-open card was drawn against the old paper and would keep a white
  // rectangle sitting in the middle of a dark page.
  if (openCard) drawCard(openCard);
  let s = document.getElementById('paperTheme');
  if (!s) {
    s = document.createElement('style');
    s.id = 'paperTheme';
    document.head.appendChild(s);
  }
  s.textContent =
    `body{background:${bg}!important;color:${fg}!important}` +
    `.sym,.reading,.token{background:${bg}!important;border-color:${fg}33!important}` +
    `input,button{color:${fg}!important;border-color:${fg}66!important;background:transparent!important}` +
    `.chip.on{background:${fg}!important;color:${bg}!important}`;
};

buildReadings();
render();
