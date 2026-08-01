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
  browse: document.getElementById('browse'),
  read: document.getElementById('read'),
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
  if (opening) typesetWithin(card);
}

function render() {
  buildChips();
  const found = searchSymbols(el.search.value)
    .filter((s) => !activeCategory || s.category === activeCategory);

  el.list.innerHTML = '';
  openCard = null;
  let lastCategory = null;
  for (const sym of found) {
    if (sym.category !== lastCategory && !activeCategory) {
      lastCategory = sym.category;
      const cat = SYMBOL_CATEGORY_BY_ID[sym.category];
      el.list.appendChild(make('h2', 'cat', cat ? cat.name : sym.category));
    }
    el.list.appendChild(symbolCard(sym));
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
  el.read.classList.toggle('hidden', browsing);
  el.tabBrowse.classList.toggle('on', browsing);
  el.tabRead.classList.toggle('on', !browsing);
  // The category chips and the "n of 100" count only describe the browse list.
  // Leaving them up while reading is worse than clutter — the count keeps
  // reporting a filter that is no longer doing anything.
  el.chips.classList.toggle('hidden', !browsing);
  el.count.classList.toggle('hidden', !browsing);
  window.scrollTo(0, 0);
}

el.tabBrowse.addEventListener('click', () => showTab('browse'));
el.tabRead.addEventListener('click', () => showTab('read'));
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
