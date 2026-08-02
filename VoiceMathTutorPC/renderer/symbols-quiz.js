// The symbols quiz — shared by the PC and Android apps.
//
// Almost nothing here is new machinery, and treating it as new is the main way
// this goes wrong. Option assembly, de-duplication and the reordering guard all
// come from `buildChoices` in practice-mcq.js; recording goes through
// `attemptFrom` + `Store.profAppend` exactly as practice does. What this file
// owns is choosing a question and drawing it.
//
// Scores feed the SAME bars as practice, via the `sym-*` skills in the notation
// area — there is deliberately no parallel progress system. `flow: 'symbols'`
// keeps the attempt log readable.

const SymbolsQuiz = (() => {
  const startBtn = typeof document !== 'undefined' ? document.getElementById('startSymQuiz') : null;
  const panel = typeof document !== 'undefined' ? document.getElementById('symQuiz') : null;

  /** Which `sym-*` skill a category's attempts count towards. */
  const skillForCategory = (categoryId) => `sym-${categoryId}`;

  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];

  /**
   * Four distractor symbols for `sym`, confusable ones first.
   *
   * `confusablesOf` resolves the relationship BOTH ways even though the data
   * declares it once, so it is the only correct source — the raw
   * `confusableWith` field is asymmetric and empty on plenty of entries. It
   * yields anywhere from 0 to 5, so the same category tops it up; the whole list
   * is the last resort, because a question with three options is worse than a
   * slightly easy one.
   */
  function neighbours(sym, want) {
    const out = [];
    const seen = new Set([sym.id]);
    const add = (s) => {
      if (!s || seen.has(s.id)) return;
      seen.add(s.id);
      out.push(s);
    };
    for (const c of confusablesOf(sym.id)) add(c);
    const sameCat = symbolsInCategory(sym.category).filter((s) => !seen.has(s.id));
    while (out.length < want && sameCat.length) add(sameCat.splice(rnd(sameCat.length), 1)[0]);
    const rest = SYMBOLS.filter((s) => !seen.has(s.id));
    while (out.length < want && rest.length) add(rest.splice(rnd(rest.length), 1)[0]);
    return out.slice(0, want);
  }

  /**
   * The four question shapes. Each returns what the prompt is, what the right
   * answer string is, and the wrong ones — `why` carries the id of the symbol
   * the student confused it with, which is what lets the feedback name it.
   *
   * `display: 'tex'` means the options are LaTeX and must be typeset; 'text'
   * means they are prose and must not be.
   */
  const MODES = {
    'glyph-meaning': {
      label: 'What does it mean?',
      build(sym) {
        return {
          promptTex: sym.glyph,
          display: 'text',
          answer: sym.meaning,
          wrong: neighbours(sym, 5).map((o) => ({ latex: o.meaning, why: o.id })),
        };
      },
    },
    'meaning-glyph': {
      label: 'Which symbol is it?',
      build(sym) {
        return {
          promptText: sym.meaning,
          display: 'tex',
          answer: sym.glyph,
          wrong: neighbours(sym, 5).map((o) => ({ latex: o.glyph, why: o.id })),
        };
      },
    },
    'spot-the-symbol': {
      label: 'Spot the symbol',
      build(sym) {
        return {
          promptText: `Which one is said “${sym.say}”?`,
          display: 'tex',
          answer: sym.glyph,
          wrong: neighbours(sym, 5).map((o) => ({ latex: o.glyph, why: o.id })),
        };
      },
    },
  };

  /**
   * Reading a whole expression aloud. Separate from MODES because it is driven by
   * READINGS rather than by a single symbol, and it is the mode that actually
   * matters — knowing every symbol individually still leaves you stuck on a line
   * you cannot read.
   */
  function buildReadingQuestion() {
    const reading = pick(READINGS);
    const others = READINGS.filter((r) => r.id !== reading.id);
    const wrong = [];
    while (wrong.length < 5 && others.length) {
      const o = others.splice(rnd(others.length), 1)[0];
      wrong.push({ latex: o.full, why: o.id });
    }
    // Attribute it to the first symbol the reading actually uses.
    const sym = SYMBOL_BY_ID[reading.symbols[0]];
    return {
      mode: 'read-expression',
      label: 'How do you say it?',
      sym,
      promptTex: reading.latex,
      display: 'text',
      answer: reading.full,
      wrong,
    };
  }

  /** One question, or null if options could not be assembled honestly. */
  function buildQuestion() {
    const useReading = typeof READINGS !== 'undefined' && READINGS.length && rnd(4) === 0;
    const q = useReading ? buildReadingQuestion() : (() => {
      const modeKey = pick(Object.keys(MODES));
      const sym = pick(SYMBOLS);
      return { mode: modeKey, label: MODES[modeKey].label, sym, ...MODES[modeKey].build(sym) };
    })();
    if (!q.sym) return null;

    // `ordered: true` throughout. The reordering guard exists for answers like
    // "x = 3, x = -5" where the same numbers in another order mean the same
    // thing; shapeOf strips digits and signs, so on prose meanings it compares
    // almost nothing and only risks discarding a good distractor.
    const choices = buildChoices(q.answer, () => q.wrong, {}, { ordered: true });
    if (!choices) return null;
    return { ...q, choices };
  }

  // ---- View --------------------------------------------------------------------------
  // No-ops without the markup, the same way practice-quiz.js does.

  let current = null;
  let shownAt = 0;
  let graded = false;
  let score = 0;
  let asked = 0;
  let total = 0;

  const el = (id) => document.getElementById(id);
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /** KaTeX if it is there, plain text if it is not — never throw at the student. */
  function tex(node, latex, display) {
    if (typeof katex === 'undefined') { node.textContent = latex; return node; }
    try { katex.render(latex, node, { throwOnError: false, displayMode: !!display }); }
    catch { node.textContent = latex; }
    return node;
  }

  function show() {
    current = buildQuestion();
    if (!current) { finish(); return; }
    graded = false;
    shownAt = Date.now();
    asked++;

    const prompt = el('symQuizPrompt');
    const opts = el('symQuizOptions');
    const fb = el('symQuizFeedback');
    prompt.innerHTML = '';
    opts.innerHTML = '';
    fb.textContent = '';
    fb.className = 'sq-feedback hidden';
    el('symQuizProgress').textContent = `${current.label} — ${asked} of ${total}`;

    if (current.promptTex) prompt.appendChild(tex(make('div', 'sq-glyph'), current.promptTex, true));
    else prompt.appendChild(make('div', 'sq-ask', current.promptText));

    current.choices.options.forEach((opt, i) => {
      // A <div>, not a <button>: applyPaper injects `select,button{...!important}`
      // from Kotlin on every paper change, which would repaint the right/wrong
      // states back to plain — the same reason practice-mcq.js uses divs.
      const cell = make('div', 'sq-option');
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.dataset.index = String(i);
      if (current.display === 'tex') cell.appendChild(tex(make('span'), opt.latex, false));
      else cell.appendChild(make('span', 'sq-text', opt.latex));
      cell.addEventListener('click', () => answer(i));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); }
      });
      opts.appendChild(cell);
    });
  }

  function answer(index) {
    if (graded || !current) return;
    graded = true;
    const { options, answerIndex, k } = current.choices;
    const right = index === answerIndex;
    if (right) score++;

    for (const cell of el('symQuizOptions').querySelectorAll('.sq-option')) {
      const i = Number(cell.dataset.index);
      cell.classList.add('locked');
      cell.setAttribute('tabindex', '-1');
      if (i === answerIndex) cell.classList.add('correct');
      else if (i === index) cell.classList.add('wrong');
    }

    const fb = el('symQuizFeedback');
    fb.className = 'sq-feedback ' + (right ? 'good' : 'bad');
    // Naming what they picked is the point of sourcing distractors from
    // `confusableWith` — "no" teaches nothing, "that is the closed integral"
    // teaches the distinction the question was testing.
    const chosen = options[index];
    const other = chosen && chosen.why ? SYMBOL_BY_ID[chosen.why] : null;
    fb.textContent = right
      ? 'Yes.'
      : other
        ? `That one is ${other.name} — “${other.say}”.`
        : 'Not that one.';

    if (current.sym && typeof Store !== 'undefined' && typeof attemptFrom === 'function') {
      Store.profAppend(attemptFrom(
        skillForCategory(current.sym.category), current.sym.id,
        right ? 1 : 0, 'mcq', Date.now() - shownAt,
        { k, flow: 'symbols' },
      ));
    }
    el('symQuizNext').classList.remove('hidden');
  }

  function finish() {
    el('symQuizPrompt').innerHTML = '';
    el('symQuizOptions').innerHTML = '';
    el('symQuizFeedback').className = 'sq-feedback hidden';
    el('symQuizNext').classList.add('hidden');
    el('symQuizProgress').textContent = `Done — ${score} of ${asked} right.`;
    current = null;
  }

  function start(count) {
    total = count || 10;
    asked = 0;
    score = 0;
    panel.classList.remove('hidden');
    show();
  }

  if (startBtn && panel) {
    startBtn.addEventListener('click', () => start(Number(el('symQuizCount').value) || 10));
    el('symQuizNext').addEventListener('click', () => {
      el('symQuizNext').classList.add('hidden');
      if (asked >= total) finish(); else show();
    });
  }

  return { buildQuestion, neighbours, skillForCategory, start };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SymbolsQuiz };
}
