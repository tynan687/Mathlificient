// The progress screen — shared by the PC tool window and Android's ProgressActivity.
//
// Reads the attempt log through practice-store.js, folds it with
// practice-prof.js, and renders: what to work on next (with a reason for each),
// what's gone stale, and a bar per area that opens into a bar per skill.
//
// Deliberately no KaTeX: every label here is plain prose, and a progress screen
// that waits on a maths typesetter to show a number is a progress screen that
// feels slow.

const isElectron = typeof window.tutor !== 'undefined';
const hasBridge = typeof Android !== 'undefined';

const el = {
  summary: document.getElementById('summary'),
  placement: document.getElementById('placement'),
  focus: document.getElementById('focus'),
  review: document.getElementById('review'),
  reviewWrap: document.getElementById('reviewWrap'),
  slips: document.getElementById('slips'),
  slipsWrap: document.getElementById('slipsWrap'),
  areas: document.getElementById('areas'),
  empty: document.getElementById('empty'),
};

/** Skills that actually have questions — nothing else is worth recommending. */
function pool() {
  if (typeof templatesForSkill !== 'function') return null;
  return SKILLS.filter((s) => templatesForSkill(s.id).length).map((s) => s.id);
}

const pct = (p) => Math.round(p * 100);

/** Red → amber → green, with the same thresholds practice-prof.js reasons about. */
function band(p, n) {
  if (!n) return 'none';
  if (p < 0.30) return 'low';
  if (p < 0.60) return 'mid';
  return 'high';
}

function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * One labelled bar. `sub` is the small print under it — attempt count, or how
 * long ago. The bar is drawn at full mastery width but *faded* when there's too
 * little evidence to be sure, rather than being shortened: shortening would be a
 * lie about the score, and fading says "we don't know yet", which is the truth.
 */
function bar(name, s, opts) {
  opts = opts || {};
  const row = make('div', 'bar-row');

  const head = make('div', 'bar-head');
  head.appendChild(make('span', 'bar-name', name));
  head.appendChild(make('span', 'bar-pct', s.n ? pct(s.p) + '%' : '—'));
  row.appendChild(head);

  const track = make('div', 'track');
  const fill = make('div', 'fill ' + band(s.p, s.n));
  fill.style.width = (s.n ? Math.max(pct(s.p), 2) : 0) + '%';
  if (s.n && !s.confident) fill.classList.add('unsure');
  track.appendChild(fill);
  row.appendChild(track);

  if (opts.sub !== false) {
    const sub = make('div', 'bar-sub', subtitleFor(s));
    row.appendChild(sub);
  }
  return row;
}

function subtitleFor(s) {
  if (!s.n) return 'Not attempted yet';
  const parts = [`${s.correct}/${s.n} correct`];
  if (!s.confident) parts.push('still working it out');
  if (s.daysSince != null) parts.push(agoText(s.daysSince));
  if (s.streak >= 3) parts.push(`${s.streak} in a row`);
  return parts.join(' · ');
}

function agoText(days) {
  if (days < 1 / 24) return 'just now';
  if (days < 1) return `${Math.round(days * 24)}h ago`;
  if (days < 14) return `${Math.round(days)} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

/** "Practise this" — hands the skill to the practice surface on either platform. */
/**
 * Two-step confirm on any control: first press arms it, a second within the
 * window fires. `window.confirm` is not an option — an Android WebView with no
 * WebChromeClient suppresses JS dialogs and confirm() just returns false, so the
 * control would silently do nothing on the phone.
 *
 * Each control keeps its own timer, so arming one never arms another.
 */
function armButton(node, restingText, armedText, onFire) {
  let armed = 0;
  node.addEventListener('click', async (e) => {
    e.stopPropagation(); // inside a <details>, a bubbled click would fold it up
    if (Date.now() - armed > 6000) {
      armed = Date.now();
      node.textContent = armedText;
      node.classList.add('armed');
      setTimeout(() => {
        if (Date.now() - armed >= 6000) {
          node.textContent = restingText;
          node.classList.remove('armed');
        }
      }, 6100);
      return;
    }
    armed = 0;
    node.textContent = restingText;
    node.classList.remove('armed');
    await onFire();
    render();
  });
  return node;
}

/**
 * Forget one skill. A div rather than a button because applyPaper repaints every
 * button with `background:transparent!important` from Kotlin, which would erase
 * the armed state exactly when the student needs to see it.
 */
function forgetButton(skillId) {
  const b = make('div', 'forget', 'Forget');
  b.setAttribute('role', 'button');
  b.setAttribute('tabindex', '0');
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); }
  });
  return armButton(b, 'Forget', 'Tap again to forget', () => Store.profResetSkill(skillId));
}

function practiceButton(skillId, label) {
  const b = make('button', 'go', label || 'Practise');
  b.addEventListener('click', () => Store.openSkill(skillId));
  return b;
}

// ---- Rendering ---------------------------------------------------------------------

async function render() {
  const log = await Store.profAll();
  const state = computeProficiency(log);
  const usable = pool();
  const total = state.totals.attempts;

  el.summary.textContent = total
    ? `${total} question${total === 1 ? '' : 's'} marked · ${Object.keys(state.skills).length} skills touched`
    : 'Nothing marked yet.';

  // The placement check is the answer to a cold start: with an empty log every
  // bar reads zero and "focus next" would just be picking at random.
  el.placement.classList.toggle('hidden', total >= 8);

  renderFocus(state, usable);
  renderReview(state, usable);
  renderSlips(log);
  renderAreas(state, usable);
  el.empty.classList.toggle('hidden', total > 0);
}

function renderFocus(state, usable) {
  el.focus.innerHTML = '';
  const picks = recommend(state, usable, 3);
  if (!picks.length) {
    el.focus.appendChild(make('div', 'hint', 'No practice questions available yet.'));
    return;
  }
  for (const pick of picks) {
    const card = make('div', 'pick');
    const top = make('div', 'pick-top');
    top.appendChild(make('span', 'pick-name', pick.skill.name));
    top.appendChild(practiceButton(pick.skill.id));
    card.appendChild(top);
    card.appendChild(make('div', 'pick-why', pick.reason));

    // The prerequisite chain is the "learning path": if something upstream is
    // shaky, name it rather than just ranking it lower and staying silent.
    const shaky = (pick.skill.prereqs || []).filter((id) => {
      const s = state.skills[id];
      return !s || s.p < 0.60;
    });
    if (shaky.length && pick.readiness < 0.999) {
      const path = make('div', 'pick-path');
      path.appendChild(make('span', 'path-label', 'Build up first: '));
      shaky.forEach((id, i) => {
        if (i) path.appendChild(make('span', 'path-sep', ' → '));
        const link = make('span', 'path-link', (SKILL_BY_ID[id] || {}).name || id);
        link.addEventListener('click', () => Store.openSkill(id));
        path.appendChild(link);
      });
      card.appendChild(path);
    }
    el.focus.appendChild(card);
  }
}

function renderReview(state, usable) {
  const due = dueForReview(state, usable, 4);
  el.reviewWrap.classList.toggle('hidden', !due.length);
  el.review.innerHTML = '';
  for (const item of due) {
    const row = make('div', 'pick');
    const top = make('div', 'pick-top');
    top.appendChild(make('span', 'pick-name', item.skill.name));
    top.appendChild(practiceButton(item.skill.id, 'Refresh'));
    row.appendChild(top);
    row.appendChild(make(
      'div', 'pick-why',
      `You had this at ${pct(item.s.p)}% — last practised ${agoText(item.s.daysSince)}.`,
    ));
    el.review.appendChild(row);
  }
}

/**
 * The mistakes you actually keep making, named.
 *
 * Only wrong multiple-choice picks and wrong symbol-quiz picks carry a slip — a
 * self-marked "missed it" records that you got it wrong but not WHY, and there is
 * nothing honest to put here for it. So a student who never uses multiple choice
 * sees an empty panel; when that is the reason, say so once rather than leaving
 * a feature they cannot find.
 */
function renderSlips(log) {
  if (!el.slipsWrap || !el.slips) return; // markup not present — no-op
  const slips = typeof topSlips === 'function' ? topSlips(log) : [];
  const attempts = (log && log.attempts) || [];
  const anyGraded = attempts.some((a) => a.mode === 'mcq');
  const worthExplaining = !slips.length && attempts.length >= 8 && !anyGraded;

  el.slipsWrap.classList.toggle('hidden', !slips.length && !worthExplaining);
  el.slips.innerHTML = '';

  if (worthExplaining) {
    el.slips.appendChild(make('div', 'note',
      'Switch a question to multiple choice and a wrong pick tells me which mistake '
      + 'you made — after a couple of repeats they show up here.'));
    return;
  }
  for (const slip of slips) {
    const card = make('div', 'pick');
    const top = make('div', 'pick-top');
    top.appendChild(make('div', 'pick-name', `You keep ${slip.label}`));
    top.appendChild(make('div', 'slip-count', `${slip.count}×`));
    card.appendChild(top);
    if (slip.hint) card.appendChild(make('div', 'pick-why', slip.hint));
    el.slips.appendChild(card);
  }
}

function renderAreas(state, usable) {
  el.areas.innerHTML = '';
  const has = usable ? new Set(usable) : null;

  for (const area of AREAS) {
    const skills = skillsInArea(area.id);
    // Hide an area only when it has neither questions nor history — otherwise a
    // student who practised something we've since stopped generating would watch
    // their record vanish.
    const shown = skills.filter((s) => (!has || has.has(s.id)) || state.skills[s.id]);
    if (!shown.length) continue;

    const a = state.areas[area.id] || { p: 0, n: 0 };
    const block = make('details', 'area');
    const summary = document.createElement('summary');
    summary.appendChild(bar(area.name, {
      p: a.p, n: a.n, correct: 0, confident: a.n >= 3, daysSince: null, streak: 0,
    }, { sub: false }));
    const counted = shown.filter((s) => state.skills[s.id]).length;
    summary.appendChild(make(
      'div', 'bar-sub',
      a.n ? `${counted} of ${shown.length} skills started` : `${shown.length} skills · not started`,
    ));
    block.appendChild(summary);

    for (const skill of shown) {
      const s = state.skills[skill.id] || blankSkill();
      const row = bar(skill.name, s);
      row.classList.add('skill');
      if (!has || has.has(skill.id)) {
        row.appendChild(practiceButton(skill.id));
        row.classList.add('has-go');
      } else if (skill.area === 'notation') {
        // These DO have questions, just not in the practice pool — they are drilled
        // from the symbols screen's "Test me" tab, so "coming soon" would be a lie.
        row.appendChild(make('div', 'bar-sub soon', 'Practise in Symbols → Test me'));
      } else {
        row.appendChild(make('div', 'bar-sub soon', 'Questions coming soon'));
      }
      // Only offered where there is something to forget — a Forget on a skill
      // with no history is a button that cannot do anything.
      if (state.skills[skill.id]) row.appendChild(forgetButton(skill.id));
      const blurbEl = make('div', 'bar-blurb', skill.blurb);
      row.insertBefore(blurbEl, row.querySelector('.track'));
      block.appendChild(row);
    }
    el.areas.appendChild(block);
  }
}

// ---- Actions -----------------------------------------------------------------------

document.getElementById('startPlacement').addEventListener('click', () => {
  if (isElectron) window.tutor.send('practice:placement');
  else if (hasBridge && typeof Android.openPlacement === 'function') Android.openPlacement();
});

// Two-step confirm rather than window.confirm(): an Android WebView with no
// WebChromeClient suppresses JS dialogs and confirm() just returns false, so the
// button would silently do nothing on the phone.
const resetBtn = document.getElementById('reset');
let resetArmed = 0;
resetBtn.addEventListener('click', async () => {
  if (Date.now() - resetArmed > 6000) {
    resetArmed = Date.now();
    resetBtn.textContent = 'Tap again to erase everything';
    resetBtn.classList.add('armed');
    setTimeout(() => {
      if (Date.now() - resetArmed >= 6000) {
        resetBtn.textContent = 'Reset all progress';
        resetBtn.classList.remove('armed');
      }
    }, 6100);
    return;
  }
  resetArmed = 0;
  resetBtn.textContent = 'Reset all progress';
  resetBtn.classList.remove('armed');
  await Store.profReset();
  render();
});

/**
 * Export the attempt log.
 *
 * Two formats on purpose. JSON is the file verbatim, so it can be put back —
 * which matters more than it looks: the log is rewritten whole on every attempt
 * with no backup, so this is the only copy a student can keep. CSV is for reading
 * in a spreadsheet and is deliberately lossy, with skill ids resolved to names.
 */
function toCsv(log) {
  const name = (id) => (typeof SKILL_BY_ID !== 'undefined' && SKILL_BY_ID[id]
    ? SKILL_BY_ID[id].name : id);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['when', 'skill', 'skill id', 'question', 'score', 'graded', 'where', 'options', 'seconds', 'slip']];
  for (const a of (log && log.attempts) || []) {
    if (!a) continue;
    rows.push([
      a.t ? new Date(a.t).toISOString() : '', name(a.skill), a.skill, a.tmpl || '',
      a.score, a.mode || '', a.flow || 'practice', a.k || '',
      a.ms != null ? (a.ms / 1000).toFixed(1) : '', a.miss || '',
    ].map(esc));
  }
  return rows.map((r) => r.join(',')).join('\n');
}

async function exportLog(kind) {
  const log = await Store.profAll();
  const stamp = new Date().toISOString().slice(0, 10);
  const isJson = kind === 'json';
  const body = isJson ? JSON.stringify(log, null, 2) : toCsv(log);
  const file = `mathlificient-progress-${stamp}.${isJson ? 'json' : 'csv'}`;
  const mime = isJson ? 'application/json' : 'text/csv';
  if (isElectron) return window.tutor.invoke('prof:export', { file, body });
  if (hasBridge && typeof Android.shareText === 'function') {
    Android.shareText(file, mime, body);
    return true;
  }
  // No host: the clipboard is better than nothing, and the worksheet window
  // already sets the precedent that "save" can mean "hand it to the OS".
  try { await navigator.clipboard.writeText(body); return true; } catch { return false; }
}

for (const kind of ['json', 'csv']) {
  const btn = document.getElementById(`export-${kind}`);
  if (btn) btn.addEventListener('click', () => exportLog(kind));
}

document.getElementById('refresh').addEventListener('click', render);

// Coming back from a practice session should show the new numbers, not a stale
// snapshot — this window stays open behind the practice one on both platforms.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});
window.addEventListener('focus', render);
window.refreshProgress = render; // Android calls this from onResume

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
    `.pick,.area,.note{background:${bg}!important;border-color:${fg}44!important}` +
    `.track{background:${fg}22!important}` +
    `button{color:${fg}!important;border-color:${fg}66!important;background:transparent!important}`;
};

render();
