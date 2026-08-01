# Mathlificient — engineering handover

An offline-first maths study app for HSC students and first-year engineering, shipping as an
**Android APK** and a **Windows Electron app** from one shared question engine.

This document is for an engineer picking the project up cold. It covers the architecture
decision everything else hangs off, the conventions you must follow to add content safely,
the verification story, and the traps that have already cost real time — with evidence, so
you don't have to rediscover them.

**Current state:** v1.0.0 published; five phases of a planned eight-phase programme are merged
and verified on hardware. See [Where it stands](#where-it-stands).

---

## 1. What it does

Everything below works **completely offline, free, with no account** — that is the product's
core claim and it constrains most decisions:

| Surface | What it is |
|---|---|
| **Practice** | 66 question generators. Every question is generated fresh with real step-by-step working and, for 37 of them, a diagram drawn from that question's actual numbers. |
| **Multiple choice** | 65 of the 66 offer four options built from *named misconceptions*. A wrong pick says which mistake you made. |
| **Progress** | A mastery bar per skill across 47 skills in 10 areas, a "focus next" list with a reason for each pick, a due-for-review queue, and a 12-question placement check. |
| **Symbols** | 100 symbols with meaning, spoken form and confusions, plus 20 expressions broken into the fragments you actually say. |
| **Formula sheet** | 185 formulas, 82 of them live solvers. |
| **Live voice tutoring** *(optional)* | Bring-your-own OpenAI key, WebRTC realtime session, screen-aware. Everything above works without it. |

---

## 2. The architecture decision that explains everything

**The question engine is plain JavaScript in classic `<script>` tags, sharing one global scope.
No bundler, no modules, no framework.** Android runs it in a `WebView`; Windows runs it in an
Electron renderer. The *same files* exist as byte-identical copies in both trees.

This is deliberate and worth keeping:

- One implementation of the maths. A generator bug is fixed once.
- Android needs zero build tooling for content changes — the files are APK assets.
- The engine is testable under Node with no DOM, which is what makes the harnesses cheap.

### The cost, and how it's managed

The copies are *not* symlinked, and the paths do not line up (`practice.js` is in
`renderer/tools/` on PC and flat in `assets/formulas/` on Android). Before this was tooled,
`formulas.js` silently diverged between platforms and nobody noticed.

```bash
node tools/sync-shared.js          # PC -> Android
node tools/sync-shared.js --check  # fails if the trees have drifted
```

`tools/sync-shared.js` holds an **explicit pair manifest** — a directory copy would miss the
path asymmetry. It also cross-checks that both `practice.html` files pull in the same set of
`<script>` tags, because those pages are *intentionally divergent* (different CSS, different
asset paths, Android has touch sizing) and so nothing else would catch adding a shared module
to one page and forgetting the other.

**If you add a shared file, add it to `PAIRS` in that script.** That is the whole contract.

### Platform guards

Every shared file runs in three environments and must not assume any of them:

```js
const isElectron = typeof window.tutor !== 'undefined';   // Electron IPC bridge
const hasBridge  = typeof Android !== 'undefined';        // Android @JavascriptInterface
// ...and neither, under Node in the test harnesses
```

Files end with a guarded CommonJS footer so Node can require them:

```js
if (typeof module !== 'undefined' && module.exports) { module.exports = { ... }; }
```

### Map

```
VoiceMathTutorPC/renderer/          source of truth for shared files
  practice-data.js       66 generators + PRACTICE_FORMULAS + MISCONCEPTIONS
  practice-skills.js     47 skills / 10 areas, prereqs, aliases  (stable ids — do not rename)
  practice-prof.js       the mastery model
  practice-store.js      storage shim: Electron IPC | Android bridge | in-memory
  practice-mcq.js        option building, LaTeX comparison, the option grid
  practice-quiz.js       quiz + placement flow
  practice-viz.js        12 canvas diagram types
  symbols-data.js        100 symbols + 20 readings
  practice-ink.js        PC-only pen/mouse canvas (Android has a native InkCanvasView)
  tools/{practice,progress,symbols}.{html,js}
VoiceMathTutor/app/src/main/assets/formulas/    the Android copies (flat)
tools/{sync-shared,check-practice,check-symbols}.js
```

---

## 3. How the learning system works

Three ideas, each of which was arrived at by fixing a wrong first attempt. The commit history
has the details; this is the summary.

### Skills, not topics or templates

Proficiency keys off a **skill** layer (47), not `topic` (24) or `template.id` (66).
"Trigonometry 62%" averages cosine-rule arithmetic with compound-angle identities and a student
can't act on it. Template ids are the opposite problem — implementation detail, unstable, and
66 bars is unreadable. A skill is what a student says out loud ("I'm bad at the chain rule").

### Store attempts, never the computed mastery

`proficiency.json` is an **append-only log**: `{version, attempts:[{t, skill, tmpl, score, mode, flow, k, ms, miss?}]}`.
Mastery is recomputed on every read. This buys three things:

- The **Kotlin side implements zero maths** — `Proficiency.kt` is `StudyLog.kt` with a different
  filename. It appends a line.
- Two windows practising at once lose one attempt instead of clobbering a record.
- **The scoring formula can change with no migration.** That is not hypothetical: the guessing
  correction (below) was added after data already existed.

Two fields that look redundant and are not:

- `mode` (`mcq` | `self`) — *how it was graded*. Drives the weighting.
- `flow` (`practice` | `quiz` | `placement`) — *where it happened*.

An earlier version conflated them, which meant a multiple-choice answer inside a quiz was
logged as self-marked and quietly given the lower weight.

### Correct for guessing

Four options hand out a free 25%. Uncorrected, a student who genuinely knows **half** a skill
converges to 0.623 — above the "solid" line — where the same student self-marking sits at 0.5.
Switching modes would turn a bar green with no change in ability.

```js
// practice-prof.js — for attempts carrying an option count `k` only
const adjusted = (score - 1 / k) / (1 - 1 / k);   // deliberately NOT clamped
```

**The lack of a clamp is the mechanism, not an oversight.** The first version clamped to [0,1],
which on a binary score maps 1→1 and 0→0 — an identity that did nothing. A wrong pick has to be
worth −⅓ for the discount to appear in the average. Measured over 300 randomised runs:
0.623 uncorrected → 0.516 corrected.

---

## 4. Adding a question generator

This is the most common task. The shape:

```js
{
  id: 'coord-distance',              // stable; the proficiency log references it
  skill: 'coordinate-geometry',      // must exist in practice-skills.js
  topic: 'Coordinate geometry',
  keywords: ['distance', 'midpoint'],
  mcqOrdered: true,                  // optional — see below
  generate() {
    // ...
    return {
      question, steps: [...], answer,
      viz: { type: 'points', ... },  // optional
      w: { x1, y1, x2, y2, dist },   // the workings bag — see below
    };
  },
  distractors({ x1, y1, x2, y2, dist }) {
    return [ { latex: '...', why: 'midpoint-difference' }, ... ];  // 4-6, best first
  },
}
```

### Rules that are not negotiable

1. **Always emit `w`.** Retrofitting 33 templates once was enough. `w` never reaches the stored
   question — `buildQuestion` destructures it out — so it costs nothing.

2. **Format with the `PR` helpers**, never raw interpolation:
   - `PR.lead(n, v)` — leading coefficient: `1` → `x`, `-1` → `-x`
   - `PR.xt(n, v)` — signed mid-chain term: vanishes at 0, drops the 1
   - `PR.ct(n)` — signed constant, vanishes at 0
   - `PR.par(n)` — parenthesise negatives

   Getting this wrong produces `0x`, `1x`, `(x + 0)` and — found on a tablet screen after four
   harnesses missed it — `\sqrt{-16^2 + 12^2}`, which reads as *minus sixteen squared*.
   **`PR.par` on any negative being raised to a power.**

3. **Distractors are misconceptions, not perturbed numbers.** Every `why` must exist in
   `MISCONCEPTIONS`, whose entries are `{ label, hint }` in **plain text, never LaTeX** —
   `label` completes "you keep …" on the progress screen and is rendered with `textContent`.

4. **Author distractors with the same template literal as the answer.** If the answer uses
   `PR.lead(...)`, the distractors do too. Otherwise options differ by formatting rather than by
   maths, and the odd one out is pickable without doing any.

5. **Narrow the parameter range wherever a value makes the named mistake produce the right
   answer.** Real examples, all commented in place:
   - `quad-formula` forces `a ≥ 2, c ≠ 0` — at `a = 1`, "forgot the *a* in b²−4ac" is correct
   - `binom-prob` excludes `p = 0.5` — the distribution is symmetric, so "swapped the powers"
     is correct
   - `diff-transcendental` excludes `a = ±1` — an inner derivative of 1 doesn't test the chain rule
   - `int-definite` starts at `x ≥ 1` — at 0, "only substituted the top limit" is correct

6. **`mcqOrdered: true` where position carries meaning.** By default the framework treats an
   option with the answer's shape and number multiset as the answer *reordered* and drops it —
   correct for the two roots of a quadratic, wrong for a partial fraction where the numerators
   sit over particular denominators. When you opt out, you take on the duty of never writing a
   reordering as a distractor.

Then, always:

```bash
node tools/check-practice.js                    # ~2000 generations per template
node tools/check-practice.js --runs 50 <id>     # while authoring
node tools/check-practice.js --sample <id>      # print one example set
```

It fails on: an option that is secretly right (including reorderings and `x^{0}` vs `1`); an
answer identifiable by its *form* alone; a coefficient artifact in any question, step or option;
a negative raised to a power without brackets; a non-finite value; an unknown or unreachable
`why`; a `viz` type with no renderer; and a fallback rate over 5%. When a template does fall
back it prints *which candidate died and why* — that diagnostic pays for itself.

---

## 5. Verification

There is no CI. Verification is five layers of harness plus a hardware pass; all of it runs
from the command line in a couple of minutes.

| Layer | Command | Covers |
|---|---|---|
| Generators + distractors | `node tools/check-practice.js` | ~130k generations across 66 templates |
| Symbols data | `node tools/check-practice.js` → `check-symbols.js` | ids, cross-references both ways, no LaTeX in spoken lines |
| Mastery model | scratchpad `phase1-prof.mjs` | decay, recovery, area rollup, guessing correction (Monte Carlo) |
| PC UI | scratchpad Electron harnesses | real pages, real IPC, synthetic pointer events |
| Android UI | scratchpad harness at 360 dp | **real asset copies**, stand-in bridge, touch targets, overflow |
| Hardware | scratchpad CDP suites | real Kotlin bridge, real `filesDir`, force-stop persistence |

The Electron/CDP harnesses live in the session scratchpad rather than the repo. **Moving them
into `tools/` and wiring `npm test` to run the lot is the single highest-value next piece of
engineering work** — they are the reason the last four phases landed without regressions, and
right now they are not where a new engineer would find them.

### Driving the tablet

Three traps, all learned the hard way:

1. **Release builds are not debuggable** — no devtools socket, no `run-as`. `isMinifyEnabled = false`
   for release, so debug and release run *identical* code: install debug to instrument, then
   reinstall release. Neither installs over the other; `adb uninstall` first, every time.
2. **The devtools socket is named after the PID**, and `pm clear` / `force-stop` change it.
   Re-read `/proc/net/unix`, grep `@webview_devtools_remote_\d+`, re-run `adb forward` before
   *every* attach.
3. **`/json/list` returns stale targets.** An activity left in the back stack keeps its WebView
   registered, so taking the first match reads a page showing pre-test state. Take the **last**,
   and `force-stop` before reopening a screen you have already visited — which doubles as a
   cold-start persistence test.

Screenshots: `adb shell screencap -p /sdcard/x.png` then `adb pull`. PowerShell's `>` corrupts
binary. And **Electron's `capturePage()` on a hidden window lies** — it returned a page with
every KaTeX glyph missing while the DOM was provably correct. Hidden windows are fine for
assertions; screenshots need `show: true`.

### Two ways a green check can be worthless

Both of these happened here and both are worth watching for:

- A canvas check counted "non-white" pixels — but the page had been themed to dark paper, so
  every pixel counted and it passed whatever happened, reporting the *identical* total for four
  different templates. It now samples the canvas's own corner as background **and asserts the
  per-template totals are distinct**.
- A shape rule demanded every option match the answer's form. That's too strong: four options in
  three different shapes give nothing away. What is fatal is three looking alike and the answer
  being the fourth. The rule is now exactly that.

---

## 6. Build and release

```bash
# Android — no gradlew in this repo, and no java on PATH
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"   # note the "1"
cd VoiceMathTutor
& "$env:LOCALAPPDATA\vmt-tools\gradle-8.9\bin\gradle.bat" assembleRelease

# Windows
cd VoiceMathTutorPC && npm install && npm run dist
```

- Release signing activates only if `VoiceMathTutor/keystore.properties` exists (gitignored).
  Without it a clone still builds. **The passphrase is not recoverable — losing it breaks all
  future signed updates.**
- minSdk 29, targetSdk 35. There is no `@RequiresApi` anywhere, which makes lint's `NewApi`
  count the complete ground truth. It is currently 0; keep it there.
- Electron derives `userData` from **`productName`**, not package `name`. Any rename strands
  user data — `migrateLegacyUserData()` in `main.js` exists because that already happened once.
- A `BrowserWindow`'s real title comes from the page's `<title>`, which **overrides** the
  constructor option. `OWN_WINDOW_TITLES` in `main.js` (which keeps our own windows out of the
  screen-capture picker) is matched against the former.

---

## 7. Where it stands

Planned as eight phases; five are merged and hardware-verified.

| Phase | Status |
|---|---|
| 0 — sync tooling + skill graph | ✅ |
| 1 — proficiency, progress screen, Android quiz | ✅ |
| 2 — multiple choice + misconception feedback | ✅ |
| 3 — coordinate geometry + trigonometry (17 templates) | ✅ |
| 4 — calculus + differential equations (16 templates) | ✅ |
| 5 — symbols: browse + read | ✅ |
| 6 — symbol diagrams | ⬜ |
| 7 — symbol quiz + engineering notation | ⬜ |
| 8 — polish | ⬜ (cuttable) |

**Skills with content: 39 / 47.** Still empty: `polynomials`, `inequalities`, `conics`,
`numerical-methods`, `de-basics`, `de-particular`, `series-taylor`, `probability`.

### Known gaps, stated plainly

- **`matrix-det-inv` has no multiple choice, deliberately.** The question asks for `det A` *and*
  `A⁻¹` but the `answer` string carries only the determinant, so four determinants would not
  answer the question on screen. Fix properly by splitting it into two templates.
- **No CI, and the UI harnesses are not in the repo** (§5).
- **`formulas.js` is genuinely forked** between platforms — Android has the lazy-render and phone
  work, PC has `runSolve`/Enter-key/`optionalVars`. It is in the sync script's `DIVERGENT` list
  with the reason. Reconcile deliberately, never by copying.
- **Speech is Android-only in practice.** Web Speech can be silently mute inside a WebView, so
  the symbols page routes through a Kotlin `TextToSpeech` bridge and only shows the speaker
  where it exists. The written "say it" line is always present.

### If you continue the plan

Phase 6 adds 8 diagram types to `practice-viz.js` (`numberline`, `setdiagram`, `riemann`, `tree`,
`stack`, `contourpath`, `vectorfield`, `surfaceslice`) and attaches `viz` to ~50 symbol entries.
Note the constraint recorded in the plan: `applyPaper(bg, fg)` is **called from Kotlin**, so add a
derived `colors.accent2` *inside* `renderVisual` rather than changing that signature, which would
need a lockstep shared-file + Kotlin change.

Phase 7's symbol quiz should feed the **same** proficiency bars via `sym-*` skill ids — not a
parallel progress system — and take its distractors from the `confusableWith` field that already
drives the "easily mixed up with" card.

---

## 8. Working on this with Claude Code

What actually made the difference across five phases:

- **Build the checker before the content.** `tools/check-practice.js` existed before a single
  distractor was written. Every subsequent authoring error was caught in seconds instead of
  reaching a student.
- **Make the harness explain itself.** The fallback diagnostic prints which candidate died and
  why. Without it, a 6% fallback rate is a guessing game.
- **Look at the screen.** Four harness layers passed a step that read `√(−16² + 12²)`. One
  screenshot caught it. Then ask *why the harness missed it* — the answer was that it never
  scanned the worked steps, and fixing that immediately found two more real bugs, one of them
  older than all this work.
- **Distrust a check that cannot fail.** See §5.
- **Write the "why" in the code, not the commit.** Every narrowed parameter range in
  `practice-data.js` carries a comment saying which misconception it protects. The next person
  to widen `a = PR.int(2, 3)` back to `(1, 3)` will see why not.
