#!/usr/bin/env node
/**
 * Check the symbols reference is internally consistent.
 *
 * The data is hand-written prose, so the failures here are the boring kind that
 * are invisible until a student hits them: a "confused with" pointing at an id
 * that does not exist, a reading claiming to use a symbol it never mentions,
 * two entries sharing an id so one silently wins, or a spoken line that still
 * has LaTeX in it and would be read out as backslash-f-r-a-c.
 *
 *   node tools/check-symbols.js
 *   node tools/check-symbols.js --list    print every entry, to read through
 */
const path = require('path');

const R = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'renderer');
const {
  SYMBOLS, SYMBOL_CATEGORIES, SYMBOL_BY_ID, READINGS,
  symbolsInCategory, searchSymbols, confusablesOf, readingsUsing,
} = require(path.join(R, 'symbols-data.js'));

let fail = 0;
const ok = (cond, label, extra) => {
  if (!cond) { fail++; console.log(`FAIL — ${label}${extra != null ? ' :: ' + extra : ''}`); }
};

// ---- Structure ------------------------------------------------------------------
const ids = SYMBOLS.map((s) => s.id);
ok(new Set(ids).size === ids.length, 'symbol ids are unique',
  ids.filter((id, i) => ids.indexOf(id) !== i).join(', '));

const catIds = new Set(SYMBOL_CATEGORIES.map((c) => c.id));
for (const s of SYMBOLS) {
  ok(catIds.has(s.category), `${s.id} sits in a real category`, s.category);
  ok(s.level === 1 || s.level === 2, `${s.id} has a level of 1 or 2`, String(s.level));
  for (const field of ['glyph', 'name', 'meaning', 'say', 'example', 'exampleSay']) {
    ok(typeof s[field] === 'string' && s[field].trim().length > 0,
      `${s.id} has a non-empty ${field}`);
  }
  ok(s.meaning.length > 25, `${s.id}'s meaning says something`, s.meaning);
  ok(/[.!]$/.test(s.meaning), `${s.id}'s meaning ends in a full stop`, s.meaning.slice(-30));
}

// ---- Spoken lines must be speakable ------------------------------------------------
// They are read aloud by a synthesiser, so a stray backslash becomes noise.
const SPOKEN_LATEX = /\\[a-zA-Z]+|\$|\^|_\{|\\\\/;
for (const s of SYMBOLS) {
  ok(!SPOKEN_LATEX.test(s.say), `${s.id}'s "say" is plain speech, not LaTeX`, s.say);
  ok(!SPOKEN_LATEX.test(s.exampleSay), `${s.id}'s "exampleSay" is plain speech`, s.exampleSay);
}
for (const r of READINGS) {
  ok(!SPOKEN_LATEX.test(r.full), `reading ${r.id}'s "full" is plain speech`, r.full);
  for (const t of r.tokens) {
    ok(!SPOKEN_LATEX.test(t.say), `reading ${r.id} token "${t.tex}" is plain speech`, t.say);
  }
}

// ---- Cross-references --------------------------------------------------------------
for (const s of SYMBOLS) {
  for (const other of s.confusableWith || []) {
    ok(!!SYMBOL_BY_ID[other], `${s.id} is confused with a symbol that exists`, other);
    ok(other !== s.id, `${s.id} is not confused with itself`);
  }
  // Confusion is a two-way relationship, so confusablesOf has to RESOLVE it
  // both ways even though the data only declares it once. Check the resolved
  // view, not the raw field.
  for (const other of s.confusableWith || []) {
    if (!SYMBOL_BY_ID[other]) continue;
    ok(confusablesOf(other).some((c) => c.id === s.id),
      `${other} resolves ${s.id} back as confusable`,
      confusablesOf(other).map((c) => c.id).join(', ') || 'nothing');
  }
}

const readingIds = READINGS.map((r) => r.id);
ok(new Set(readingIds).size === readingIds.length, 'reading ids are unique');
for (const r of READINGS) {
  ok(Array.isArray(r.tokens) && r.tokens.length >= 2,
    `reading ${r.id} breaks into at least two pieces`);
  for (const sym of r.symbols || []) {
    ok(!!SYMBOL_BY_ID[sym], `reading ${r.id} names a symbol that exists`, sym);
  }
  // The token fragments should account for the whole spoken line, roughly —
  // a token list far shorter than `full` means pieces were left out.
  const spoken = r.tokens.map((t) => t.say).join(' ').length;
  ok(spoken > r.full.length * 0.55,
    `reading ${r.id}'s tokens cover the whole line`,
    `${spoken} chars of tokens vs ${r.full.length} in full`);
}

// ---- Helpers behave ------------------------------------------------------------------
ok(searchSymbols('').length === SYMBOLS.length, 'an empty search returns everything');
ok(searchSymbols('zzzzz').length === 0, 'a nonsense search returns nothing');
ok(searchSymbols('partial').some((s) => s.id === 'partial'), 'searching a name works');
ok(searchSymbols('\\partial').some((s) => s.id === 'partial'),
  'searching the LaTeX works — someone who copied it out of a PDF can find it');
ok(searchSymbols('curly d').some((s) => s.id === 'partial'),
  'searching a description works — someone who can only describe it can find it');
ok(confusablesOf('abs').length > 0, 'confusablesOf resolves');
ok(readingsUsing('sigma-sum').length > 0, 'readingsUsing resolves');

// ---- Coverage ---------------------------------------------------------------------------
const used = new Set(READINGS.flatMap((r) => r.symbols || []));
const empty = SYMBOL_CATEGORIES.filter((c) => !symbolsInCategory(c.id).length);
ok(empty.length === 0, 'every category has at least one symbol',
  empty.map((c) => c.id).join(', '));

if (process.argv.includes('--list')) {
  for (const cat of SYMBOL_CATEGORIES) {
    console.log(`\n== ${cat.name} ==`);
    for (const s of symbolsInCategory(cat.id)) {
      console.log(`  ${s.glyph.padEnd(24)} ${s.name} — say "${s.say}"`);
      console.log(`      ${s.meaning}`);
      console.log(`      e.g. ${s.example}  ->  "${s.exampleSay}"`);
    }
  }
}

const lvl1 = SYMBOLS.filter((s) => s.level === 1).length;
console.log(`\n${SYMBOLS.length} symbols across ${SYMBOL_CATEGORIES.length} categories `
  + `(${lvl1} core, ${SYMBOLS.length - lvl1} extension)`);
console.log(`${READINGS.length} worked readings, using ${used.size} of them`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
process.exit(fail ? 1 : 0);
