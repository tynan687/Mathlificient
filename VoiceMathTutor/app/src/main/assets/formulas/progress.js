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
