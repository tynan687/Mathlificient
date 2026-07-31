// Mobile formula sheet: KaTeX-rendered, searchable, solvers, and copy/share into
// Word (LaTeX text) or Samsung Notes (image) via the Android bridge.
//
// Rendering is deliberately lazy. Doing all 185 KaTeX renders and building all 82
// solver forms up front cost roughly a second of blank screen on a phone, for
// content that's mostly below the fold — so formulas render as they scroll into
// view, and a solver is built the first time its card is opened.

const list = document.getElementById('list');
const search = document.getElementById('search');
const clearBtn = document.getElementById('clear');
const closeBtn = document.getElementById('close');
const countEl = document.getElementById('count');
const groupBar = document.getElementById('groupbar');
const emptyEl = document.getElementById('empty');

/** The Android WebView bridge is absent when this page is served in a browser. */
const bridge = typeof Android !== 'undefined' ? Android : null;

function copyText(text) {
  if (bridge) bridge.copyText(text);
  else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

function flash(el, text) {
  const note = document.createElement('span');
  note.className = 'copied';
  note.textContent = text;
  el.after(note);
  setTimeout(() => note.remove(), 1400);
}

function renderTex(el, latex) {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: false });
  } catch {
    el.textContent = latex;
  }
}

// ---- Build the list (cheap parts only) ---------------------------------------------

const groups = [...new Set(FORMULAS.map((f) => f.group))];
const cards = [];

// Render only what's near the viewport; the rest fills in as you scroll.
const texObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    texObserver.unobserve(el);
    renderTex(el, el.dataset.latex);
  }
}, { rootMargin: '600px 0px' });

const frag = document.createDocumentFragment();
for (const group of groups) {
  const h = document.createElement('h3');
  h.textContent = group;
  h.id = 'g-' + group.replace(/\W+/g, '-').toLowerCase();
  frag.appendChild(h);

  for (const formula of FORMULAS.filter((f) => f.group === group)) {
    const card = document.createElement('div');
    card.className = 'f';
    card.dataset.text = `${formula.name} ${formula.group} ${formula.latex}`.toLowerCase();

    const name = document.createElement('div');
    name.className = 'name';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = formula.name;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = formula.solve ? 'tap to solve' : 'tap for options';
    name.appendChild(label);
    name.appendChild(badge);
    card.appendChild(name);

    const tex = document.createElement('div');
    tex.className = 'tex';
    tex.dataset.latex = formula.latex;
    texObserver.observe(tex);
    card.appendChild(tex);

    const solver = document.createElement('div');
    solver.className = 'solver';
    card.appendChild(solver);

    let built = false;
    card.addEventListener('click', (e) => {
      if (solver.contains(e.target)) return;
      if (!built) {                     // build on first open, not on page load
        buildSolver(solver, formula);
        built = true;
      }
      card.classList.toggle('open');
      if (card.classList.contains('open')) {
        // Keep the card in view once it grows, so Solve isn't left off-screen.
        setTimeout(() => card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
      }
    });

    frag.appendChild(card);
    cards.push(card);
  }
}
list.appendChild(frag);

// ---- Group chips --------------------------------------------------------------------

for (const group of groups) {
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.textContent = group;
  chip.addEventListener('click', () => {
    document.getElementById('g-' + group.replace(/\W+/g, '-').toLowerCase())
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  groupBar.appendChild(chip);
}

// ---- Solver -------------------------------------------------------------------------

function buildSolver(container, formula) {
  const actions = document.createElement('div');
  actions.className = 'actions';

  const copyLatex = document.createElement('button');
  copyLatex.textContent = 'Copy LaTeX';
  copyLatex.addEventListener('click', () => {
    copyText(formula.latex);
    flash(copyLatex, 'copied — paste into Word’s equation editor');
  });

  const copyImg = document.createElement('button');
  copyImg.textContent = 'Copy image';
  copyImg.addEventListener('click', () => {
    if (!bridge) return;
    bridge.copyImage(formula.latex);
    flash(copyImg, 'image copied — paste into Notes');
  });

  const shareImg = document.createElement('button');
  shareImg.textContent = 'Share image';
  shareImg.addEventListener('click', () => bridge && bridge.shareImage(formula.latex));

  if (formula.solve) {
    const inputs = document.createElement('div');
    inputs.className = 'inputs';
    const fields = {};
    for (const v of formula.vars) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const label = document.createElement('label');
      label.textContent = v.label;
      label.title = v.label;                     // full text on long-press
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.enterKeyHint = 'go';
      fields[v.key] = input;
      wrap.appendChild(label);
      wrap.appendChild(input);
      inputs.appendChild(wrap);
    }
    container.appendChild(inputs);

    const results = document.createElement('div');
    results.className = 'results';
    const solveBtn = document.createElement('button');
    solveBtn.className = 'primary';
    solveBtn.textContent = 'Solve';
    let lastResultText = '';

    const doSolve = () => {
      const values = {};
      for (const v of formula.vars) {
        const n = parseFloat(fields[v.key].value);
        if (isNaN(n) && !formula.optionalVars) {
          results.innerHTML = '';
          const msg = document.createElement('div');
          msg.innerHTML = 'Enter a number for <b></b>';
          msg.querySelector('b').textContent = v.label;
          results.appendChild(msg);
          fields[v.key].focus();
          return;
        }
        values[v.key] = n;
      }
      let out;
      try {
        out = formula.solve(values);
      } catch (e) {
        out = [{ label: 'Error', value: String(e.message || e) }];
      }
      results.innerHTML = '';
      lastResultText = out.map((r) => `${r.label} = ${r.value}`).join('\n');
      for (const r of out) {
        const div = document.createElement('div');
        div.innerHTML = `${r.label}: <b></b>`;
        div.querySelector('b').textContent = r.value;
        results.appendChild(div);
      }
      copyResult.classList.remove('hidden');
    };

    solveBtn.addEventListener('click', doSolve);
    // Enter from the keypad solves, so you don't have to dismiss the keyboard
    // and hunt for the button.
    for (const input of Object.values(fields)) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSolve(); }
      });
    }

    const copyResult = document.createElement('button');
    copyResult.textContent = 'Copy result';
    copyResult.classList.add('hidden');
    copyResult.addEventListener('click', () => {
      copyText(lastResultText);
      flash(copyResult, 'copied');
    });

    // Results go above the buttons: below them they sat under the keyboard.
    container.appendChild(results);
    actions.appendChild(solveBtn);
    actions.appendChild(copyResult);
  }

  actions.appendChild(copyLatex);
  if (bridge) {                 // image copy/share need the Android bridge
    actions.appendChild(copyImg);
    actions.appendChild(shareImg);
  }
  container.appendChild(actions);
}

// ---- Search -------------------------------------------------------------------------

const headings = [...document.querySelectorAll('h3')];

function applyFilter() {
  const q = search.value.trim().toLowerCase();
  let shown = 0;
  for (const f of cards) {
    const hit = !q || f.dataset.text.includes(q);
    f.classList.toggle('hidden', !hit);
    if (hit) shown++;
  }
  for (const h of headings) {
    let el = h.nextElementSibling;
    let any = false;
    while (el && el.classList && el.classList.contains('f')) {
      if (!el.classList.contains('hidden')) { any = true; break; }
      el = el.nextElementSibling;
    }
    h.classList.toggle('hidden', !any);
  }
  countEl.textContent = q
    ? `${shown} of ${cards.length} formulas`
    : `${cards.length} formulas · ${groups.length} groups`;
  clearBtn.classList.toggle('hidden', !q);
  emptyEl.classList.toggle('hidden', shown !== 0);
  groupBar.classList.toggle('hidden', !!q);
}

let filterTimer = null;
search.addEventListener('input', () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(applyFilter, 90); // debounce: 185 cards per keystroke
});
search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') search.blur();       // dismiss the keyboard, keep results
});
clearBtn.addEventListener('click', () => {
  search.value = '';
  applyFilter();
  search.focus();
});
closeBtn.addEventListener('click', () => {
  if (bridge && bridge.closeWindow) bridge.closeWindow();
  else window.history.back();
});

applyFilter();
