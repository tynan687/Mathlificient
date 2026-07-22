// Mobile formula sheet: KaTeX-rendered, searchable, solvers, and copy/share into
// Word (LaTeX text) or Samsung Notes (image) via the Android bridge.

const list = document.getElementById('list');
const search = document.getElementById('search');

function flash(el, text) {
  const note = document.createElement('span');
  note.className = 'copied';
  note.textContent = text;
  el.after(note);
  setTimeout(() => note.remove(), 1400);
}

const groups = [...new Set(FORMULAS.map((f) => f.group))];
for (const group of groups) {
  const h = document.createElement('h3');
  h.textContent = group;
  list.appendChild(h);

  for (const formula of FORMULAS.filter((f) => f.group === group)) {
    const card = document.createElement('div');
    card.className = 'f';
    card.dataset.text = `${formula.name} ${formula.group} ${formula.latex}`.toLowerCase();

    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<span>${formula.name}</span>`
      + `<span class="badge">${formula.solve ? 'tap to solve' : 'tap for options'}</span>`;
    card.appendChild(name);

    const tex = document.createElement('div');
    tex.className = 'tex';
    try {
      katex.render(formula.latex, tex, { throwOnError: false, displayMode: false });
    } catch {
      tex.textContent = formula.latex;
    }
    card.appendChild(tex);

    const solver = document.createElement('div');
    solver.className = 'solver';
    buildSolver(solver, formula);
    card.appendChild(solver);

    card.addEventListener('click', (e) => {
      if (solver.contains(e.target)) return;
      card.classList.toggle('open');
    });

    list.appendChild(card);
  }
}

function buildSolver(container, formula) {
  const copyLatex = document.createElement('button');
  copyLatex.textContent = 'Copy LaTeX';
  copyLatex.addEventListener('click', () => {
    Android.copyText(formula.latex);
    flash(copyLatex, 'copied — paste into Word’s equation editor');
  });

  const copyImg = document.createElement('button');
  copyImg.textContent = 'Copy image';
  copyImg.addEventListener('click', () => {
    Android.copyImage(formula.latex);
    flash(copyImg, 'image copied — paste into Notes');
  });

  const shareImg = document.createElement('button');
  shareImg.textContent = 'Share image';
  shareImg.addEventListener('click', () => Android.shareImage(formula.latex));

  if (formula.solve) {
    const inputs = document.createElement('div');
    inputs.className = 'inputs';
    const fields = {};
    for (const v of formula.vars) {
      const wrap = document.createElement('span');
      const label = document.createElement('label');
      label.textContent = v.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
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

    solveBtn.addEventListener('click', () => {
      const values = {};
      for (const v of formula.vars) {
        const n = parseFloat(fields[v.key].value);
        if (isNaN(n) && !formula.optionalVars) {
          results.innerHTML = `<div>Enter a number for <b>${v.label}</b></div>`;
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
    });

    const copyResult = document.createElement('button');
    copyResult.textContent = 'Copy result';
    copyResult.classList.add('hidden');
    copyResult.addEventListener('click', () => {
      Android.copyText(lastResultText);
      flash(copyResult, 'copied');
    });

    container.appendChild(solveBtn);
    container.appendChild(copyResult);
    container.appendChild(results);
  }

  container.appendChild(copyLatex);
  container.appendChild(copyImg);
  container.appendChild(shareImg);
}

search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  document.querySelectorAll('.f').forEach((f) => {
    f.classList.toggle('hidden', !!q && !f.dataset.text.includes(q));
  });
  document.querySelectorAll('h3').forEach((h) => {
    let el = h.nextElementSibling;
    let any = false;
    while (el && el.classList && el.classList.contains('f')) {
      if (!el.classList.contains('hidden')) any = true;
      el = el.nextElementSibling;
    }
    h.classList.toggle('hidden', !any);
  });
});
