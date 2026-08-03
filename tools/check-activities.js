#!/usr/bin/env node
/**
 * The Kotlin screens and the shared pages they host have to agree.
 *
 * This is the same class of drift `sync-shared.js` exists to catch between the
 * two copies of a page — a thing wired up in one place and forgotten in the
 * other — except the two halves here are a WebView page and the activity that
 * hosts it, so no file comparison can see it.
 *
 * It is a source-text check, not a build or a test. That is the point: it runs
 * in a second, with no Android SDK, no Gradle and no tablet, and it would have
 * caught a live bug where `show_practice` opened the popup practice screen and
 * the tutor's `check_my_answer` then timed out because only the full-screen
 * studio was listening.
 *
 *   node tools/check-activities.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JAVA = path.join(ROOT, 'VoiceMathTutor', 'app', 'src', 'main', 'java');

let failures = 0;
const ok = (label, cond, extra) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};

/** Every .kt file under the app source tree, as { name, rel, text }. */
function kotlinSources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...kotlinSources(full));
    else if (entry.name.endsWith('.kt')) {
      out.push({ name: entry.name, rel: path.relative(ROOT, full), text: fs.readFileSync(full, 'utf8') });
    }
  }
  return out;
}

if (!fs.existsSync(JAVA)) {
  console.log(`FAIL — no Kotlin source tree at ${path.relative(ROOT, JAVA)}`);
  process.exit(1);
}
const sources = kotlinSources(JAVA);

// ---- every screen that hosts the practice page must answer check_my_answer ----------
//
// The page carries `window.__checkAnswer`, but nothing calls it on its own: the
// service publishes the question on `uiState.pendingCheck` and whichever screen
// is on top has to notice, run it, and post the verdict back. A screen that
// loads the page and does not watch that field looks completely fine — it just
// leaves every tool call to time out, and the model then tells the student to
// open the screen they are already looking at.
{
  const hosts = sources.filter((s) => s.text.includes('practice.html'));
  ok('some activity hosts practice.html', hosts.length > 0, `${hosts.length} found`);
  for (const host of hosts) {
    ok(`  ${host.name} watches pendingCheck`, host.text.includes('pendingCheck'), host.rel);
  }
}

// ---- the verdict must come from the page, never from Kotlin -------------------------
//
// The whole premise is that the model is never told the answer: the page marks
// it and hands back a verdict. If a screen ever reached for the answer itself
// that guarantee would be gone, and it would be gone quietly.
{
  const leaks = sources.filter((s) => /__answer\b|currentAnswer|\.answer\s*=/.test(s.text));
  ok('no activity reads the answer out of the page', leaks.length === 0,
    leaks.map((s) => s.rel).join(', ') || 'none');
}

// ---- the tool is declared on both platforms ------------------------------------------
//
// TutorConfig.kt says in its own comment that check_my_answer is kept in step BY
// HAND with shared.js, because that file is not in sync-shared.js's PAIRS. A
// name check is the least this can do about that.
{
  const shared = fs.readFileSync(
    path.join(ROOT, 'VoiceMathTutorPC', 'renderer', 'shared.js'), 'utf8');
  const config = sources.find((s) => s.name === 'TutorConfig.kt');
  ok('TutorConfig.kt exists', !!config);
  if (config) {
    for (const tool of ['check_my_answer', 'show_practice']) {
      ok(`  ${tool} is declared on both platforms`,
        config.text.includes(tool) && shared.includes(tool));
    }
  }
}

// ---- a tool call always gets an answer -------------------------------------------------
//
// A function_call_output that never arrives stalls the conversation, so the
// service's own comment says the timeout "must always fire". Keep the timeout
// and the delivery path from being deleted or renamed without a thought.
{
  const svc = sources.find((s) => s.name === 'RealtimeService.kt');
  ok('RealtimeService.kt exists', !!svc);
  if (svc) {
    ok('  check_my_answer is dispatched', svc.text.includes('"check_my_answer"'));
    ok('  an unanswered check times out', svc.text.includes('CHECK_ANSWER_TIMEOUT_MS'));
    ok('  a screen can post a verdict back', svc.text.includes('fun deliverCheck'));
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
