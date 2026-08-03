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
| **Practice** | 73 question generators. Every question is generated fresh with real step-by-step working and, for 42 of them, a diagram drawn from that question's actual numbers. |
| **Multiple choice** | 72 of the 73 offer four options built from *named misconceptions*. A wrong pick says which mistake you made. |
| **Progress** | A mastery bar per skill across 64 skills in 10 areas, a "focus next" list with a reason for each pick, a due-for-review queue, and a 12-question placement check. |
| **Symbols** | 159 symbols with meaning, spoken form and confusions, 79 of them with a diagram, plus 20 expressions broken into the fragments you actually say — and a four-mode quiz that feeds the same bars as practice. |
| **Formula sheet** | 189 formulas, 84 of them live solvers. |
| **Live voice tutoring** *(optional)* | Bring-your-own OpenAI key, WebRTC realtime session, screen-aware. It can mark an answer — see below — and looks at your handwritten working when you get one wrong. Everything above works without it. |
| **Marking, without a key** | `markAnswer` in `practice-mcq.js` compares what you said against the stored answer offline and for nothing, so the app knows right from wrong on its own. The tutor asks for that verdict through a tool; it is never told the answer. |

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
  practice-data.js       73 generators + PRACTICE_FORMULAS + MISCONCEPTIONS
  practice-skills.js     64 skills / 10 areas, prereqs, aliases  (stable ids — do not rename)
  practice-prof.js       the mastery model
  practice-store.js      storage shim: Electron IPC | Android bridge | in-memory
  practice-mcq.js        option building, LaTeX comparison, the option grid
  practice-quiz.js       quiz + placement flow
  practice-viz.js        12 canvas diagram types
  symbols-data.js        159 symbols + 20 readings
  symbols-quiz.js        the four-mode symbol quiz, over practice-mcq's buildChoices
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

There is no CI. Verification is six layers of harness plus a hardware pass; everything except
the hardware pass runs from one command in about two minutes.

```powershell
$env:ELECTRON_RUN_AS_NODE = 1
& "$env:LOCALAPPDATA\vmt-build\node_modules\electron\dist\electron.exe" tools\test\run-all.js
```

`--fast` skips the generator sweep (~30 s); a bare word filters by suite name. There is no
system Node on the original dev machine, which is why Electron doubles as the JS runtime —
`run-all.js` locates it and sets `ELECTRON_RUN_AS_NODE` per suite. Full detail, including how to
attach to the tablet, is in [tools/test/README.md](tools/test/README.md).

| Layer | Suite | Covers |
|---|---|---|
| Generators + distractors | `tools/check-practice.js` | ~130k generations across 73 templates |
| Symbols data | `tools/check-symbols.js` | ids, cross-references both ways, no LaTeX in spoken lines |
| Shared-file drift | `tools/sync-shared.js --check` | PC and Android copies identical, same `<script>` sets |
| Mastery model | `tools/test/model.mjs`, `skills.mjs` | decay, recovery, area rollup, guessing correction (Monte Carlo) |
| PC UI | `tools/test/pc-*.js`, `viz.js` | real pages, real IPC, synthetic pointer events |
| Android UI | `tools/test/android-*.js` | **real asset copies**, stand-in bridge, touch targets, overflow |
| Hardware | `tools/test/device-*.js` | real Kotlin bridge, real `filesDir`, force-stop persistence, per-skill reset, export through the share sheet, every renderer on the real WebView — 129 assertions |

The `device-*` suites are excluded from `run-all.js` — they need a tablet and a debug build.
Run them individually after any change to `Proficiency.kt` or the `Bridge` methods.

**The PC suites run against `%LOCALAPPDATA%\vmt-build`, not the repo.** The repo sits in OneDrive
and `npm install` was never run there, so Electron and KaTeX live in `vmt-build` and the pages
load from it. Copy the renderer across before testing a PC-side edit:

```
robocopy "<repo>\VoiceMathTutorPC\renderer" "%LOCALAPPDATA%\vmt-build\renderer" /MIR
```

`paths.js` hashes both trees on every run and **exits 1 naming the drifted files** rather than
letting a stale copy report green. Running `npm install` inside `VoiceMathTutorPC` makes the repo
win the resolution order and removes the two-copy problem entirely.

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

### What lives on the dev machine, not in the repo

A clone alone does not build or test. On the original machine these are already in place; on a
new one they are the setup list.

| Path | What it is | If it's missing |
|---|---|---|
| `%LOCALAPPDATA%\vmt-build\node_modules` | Electron, KaTeX, pdf.js | No JS runtime and no tests — there is no system `node` |
| `%LOCALAPPDATA%\vmt-build\renderer` | The PC pages the harnesses load | PC suites cannot run (§5) |
| `%LOCALAPPDATA%\vmt-tools\gradle-8.9` | Gradle | No Android build — there is no `gradlew` in this repo |
| `C:\Program Files\Android\Android Studio1\jbr` | The JDK, for `JAVA_HOME` | No Android build. Note the **`1`** — the plain "Android Studio" folder is a broken install |
| `VoiceMathTutor/keystore.properties` | Signing config (gitignored); points at the keystore below | Release build falls back to unsigned; debug is unaffected |
| `%LOCALAPPDATA%\vmt-tools\keys\mathlificient-release.jks` | The release signing key | **Signed updates to the published app become impossible** |

Everything above the last two rows is a re-download. The keystore is not: Android identifies an
app by its signature, so a lost `.jks` or a forgotten passphrase means the published
`com.tynan.mathtutor` can never be updated again — only replaced by a new listing that existing
users would have to find and reinstall by hand. **Back up the `.jks` and its passphrase off this
machine before anything else.** Neither is in the repo and neither should be.

### Key custody

The `.jks` and the four values in `keystore.properties` are backed up in a **shared password
manager vault**, which is the only copy off this machine. Record the vault item's name here when
you set it up — never the secrets themselves.

Keep the key out of email and chat: both leave permanent copies on servers you do not control,
and unlike a password this one **cannot be rotated**. A vault item can be unshared; a mail
archive cannot be unsent.

A backup that has never been restored is not a backup. Prove it once, from the vault copy alone —
build a release APK with it and print the certificate:

```bash
apksigner verify --print-certs app-release.apk
```

It must come back with the v1.0.0 identity:

```
DN:      CN=Mathlificient, OU=Mathlificient, O=Mathlificient, C=AU
SHA-256: c66704b5516975ef78433e78222f7138335a99a8b884e063640d7a6475ee07fc
SHA-1:   51901bc81b7f90eca9c078f069cdb4e1502bf058
```

Anything else means the backup is not the shipping key, and an APK signed with it will not
install over an existing copy. The digest is public — it is in every APK already distributed —
so recording it here is safe and is what makes the check possible at all. `apksigner` lives in
the Android SDK build-tools and needs the same `JAVA_HOME` as the Gradle build.

### Transitioning the machine to someone else

This project was handed over in place — same PC, new owner — which raises things a `git clone`
never would. `%APPDATA%\Mathlificient` holds `apikey.bin`, `spend.json`, `study_log.json`,
`tutor_memory.json` and `worked_examples.json`.

**Give the new owner a fresh Windows account.** `apikey.bin` is encrypted with Electron's
`safeStorage`, which on Windows is DPAPI and therefore keyed to the Windows user — a new account
simply cannot decrypt it, and starts with no study history, no tutor memory and no cached git
credentials. That is the whole mitigation, and it costs nothing.

If the same Windows account is unavoidable, then before handing it over: rotate the API key at
the provider, delete the five files above, and clear the `github.com` entry from the git
credential helper — otherwise the new owner inherits billable API spend and can push as you.
Do **not** delete `%LOCALAPPDATA%\vmt-build` or `vmt-tools`; they are shared tooling that the
harnesses and the Gradle build both depend on.

Verify from the new account: the PC app should prompt for an API key rather than working, and
`git push` should ask for credentials rather than succeeding.

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
| 6 — symbol diagrams | ✅ 8 new `practice-viz.js` types, 79 entries carry one |
| 7 — symbol quiz + engineering notation | ✅ 59 level-3 entries, 15 `sym-*` skills, 4 quiz modes |
| 8 — polish | ✅ slips panel, MCQ worksheets, per-skill reset, JSON+CSV export |

**Skills with content: 56 / 64** — the 15 `sym-*` skills are drilled from the symbols
screen's "Test me" tab rather than the practice pool, so they show on the progress bars but
never in placement. Still empty: `polynomials`, `inequalities`, `conics`,
`numerical-methods`, `de-basics`, `de-particular`, `series-taylor`, `probability`.

### Known gaps, stated plainly

- **`matrix-det-inv` has no multiple choice, deliberately.** The question asks for `det A` *and*
  `A⁻¹` but the `answer` string carries only the determinant, so four determinants would not
  answer the question on screen. Fix properly by splitting it into two templates.
- **No CI.** The harnesses are all in `tools/test/` and run from one command (§5), but nothing
  runs them automatically. They need a windowed Electron, so a GitHub Actions runner would want
  `xvfb` or a Windows runner — the `node:true` suites would run anywhere as-is.
- **The recommender has never met a real student.** It is verified against synthetic attempt
  logs and Monte Carlo runs, which prove the maths, not the pedagogy. Whether "focus next"
  names skills a student agrees are their weak spots is unmeasured.
- **`formulas.js` is genuinely forked** between platforms — Android has the lazy-render and phone
  work, PC has `runSolve`/Enter-key/`optionalVars`. It is in the sync script's `DIVERGENT` list
  with the reason. Reconcile deliberately, never by copying.
- **Speech is Android-only in practice.** Web Speech can be silently mute inside a WebView, so
  the symbols page routes through a Kotlin `TextToSpeech` bridge and only shows the speaker
  where it exists. The written "say it" line is always present.
- **Settings writes can revert each other, and this is known and accepted.** `settings:set`
  replaces `settings.json` wholesale, and three renderers read-modify-write the whole object:
  `settings.js`, `engine.js` and `practice-ink.js`. Two of them hold a snapshot for the life of
  the window — `settings.js` loads one at startup and never refreshes it, and its window cannot
  be closed at all, since closing it quits the app. So the tutor saving `currentTopic`, or the
  Practice Studio saving a paper colour, can be silently undone by the next toggle in the
  settings window, which writes its launch-time copy back over the top.

  This is the same clobber the proficiency log is append-only to avoid — see the comment on
  `Store.profResetSkill` in `practice-store.js`, which says so in as many words.

  The fix is small: make `settings:set` merge over what is on disk instead of replacing it,
  and have `settings.js` re-read on `theme:changed`. It has not been done. Until it is,
  `tools/check-settings.js` pins the three writers by name so a fourth cannot appear by
  accident — if you need one, that is a decision, and the header of that file explains what
  you are accepting. Prefer routing a new setting through `settings.js`'s existing save path.

---

## 8. The remaining plan: Phases 6 and 7

Both are designed and unstarted. The full eight-phase plan lives in the session plan file; this
is the part still to build, with the decisions already made so you don't re-litigate them.

### Phase 6 — Symbol diagrams · ~1–2 days

The original brief asked for "pictures to get concepts across". Phase 5 shipped the words; this
is the pictures.

**Reuse `practice-viz.js`. Do not write a second renderer.** It already gives HiDPI scaling,
theme-awareness via `{bg, fg, accent}`, and the primitives you need: `makePlot(xmin, xmax, ymin,
ymax)` returning `{px, py, axes, curve, dot, openDot, dashedV, dashedH, label}`, plus
`drawArrow`, `niceStep`, `yRangeFromSamples` and `trim`. Symbol entries gain an optional `viz`
in exactly the shape practice questions already use, and `symbols.js` renders it into the open
card with the same lazy path.

Eight new spec types. Six are compositions of existing primitives; only the last two are
genuinely new drawing code (~100 lines together):

| Type | Draws | Serves |
|---|---|---|
| `numberline` | a line with open/closed endpoints and a shaded span | `< ≤ ∈ [a,b) \|x\|` — including that `\|x−3\|<2` **is** an interval |
| `setdiagram` | two or three overlapping circles with a region shaded | `∪ ∩ ⊂ ∅`, and `P(A∩B)` |
| `riemann` | rectangles under a curve, thinning left to right | the `Σ → ∫` connection, which is the whole idea behind the elongated S |
| `tree` | a two-level probability tree with branch labels | `P(A\|B)` — why "given" restricts you to one branch |
| `stack` | terms as blocks accumulating | `Σ` versus `Π` side by side |
| `contourpath` | a closed loop on a field with direction arrows | `∮` |
| `vectorfield` | arrows on a grid, longest up the steepest slope | `∇` |
| `surfaceslice` | a surface with one variable's slice highlighted | `∂` — the "hold the others still" idea |

Attach `viz` to roughly 50 of the 100 entries. Prioritise the ones where a picture does work
prose cannot: `∂ ∇ ∮ ∫ Σ ∈ ∪ ∩ P(A|B) |x| [a,b)`. Leave `=`, `π` and the Greek letters alone —
a diagram there is decoration.

**The one constraint that will bite.** `applyPaper(bg, fg)` is called **from Kotlin**
(`PracticeSpaceActivity.paintWeb`). Symbol diagrams want a fourth colour for a second series.
Add `colors.accent2` with a **derived default computed inside `renderVisual`**, e.g. a hue-shifted
`accent`. Changing the `applyPaper` signature would need a shared-file change and a Kotlin change
to land in lockstep across both platforms — avoidable, so avoid it.

**Verification.** Extend the existing render check: every symbol `viz` must name a type the
renderer implements, and must draw. Reuse the corner-sampling ink metric and the
distinct-totals assertion from §5 — a diagram test that cannot fail is worse than none.

**Cut order if it runs long:** `surfaceslice` and `vectorfield` first (substitute a static
diagram or drop the `viz` from those two entries); the other six are cheap.

### Phase 7 — Symbol quiz + engineering notation · ~1–2 days

**Reuse the existing machinery.** `symbols-quiz.js` should call `buildChoices` from
`practice-mcq.js` for option assembly, dedupe and the reordering guard, and record through
`attemptFrom` + `Store.profAppend` exactly as practice does. Almost nothing here is new
infrastructure; treating it as new is the main way this phase goes wrong.

Four question modes:

| Mode | Prompt | Options | Distractors from |
|---|---|---|---|
| glyph → meaning | the symbol | four meanings | `confusableWith` |
| meaning → glyph | the meaning | four glyphs | `confusableWith` |
| read the expression | a rendered expression | four spoken readings | other entries' `exampleSay` |
| spot the symbol | "which one means *given*?" | four glyphs | same category |

**Distractors come from `confusableWith`**, which already drives the "easily mixed up with"
card — one field, two jobs, and it is already resolved symmetrically at load. That is why a
wrong pick can say something useful rather than just "no".

**Scores feed the same bars — do not build a parallel progress system.** The skill graph already
has an empty `notation` area (`practice-skills.js`, order 10) waiting for this. Add `sym-*`
skills to it, one per category — `sym-relations`, `sym-calculus`, `sym-sets`, and so on — with
`prereqs: []`, since notation is not gated on anything. Symbol attempts then flow through
`computeProficiency` untouched, appear in "focus next" alongside quadratics, and get the
guessing correction for free. Set `flow: 'symbols'` so the log stays readable.

**Level-3 entries (~60 more), for first-year engineering.** `∂ ∇ ∇· ∇× ∮ ∬ ℒ ⟨·⟩ ≜ O(·)` and the
rest of the vector-calculus set. One entry earns a special mention: **`i` versus `j`** for the
imaginary unit. HSC teaches `i`; first-year electrical engineering uses `j` because `i` is
current; nobody tells students this and it costs them a week. Give it its own entry with both
glyphs and `confusableWith` linking them.

**Cut order if it runs long:** engineering symbols beyond the ~25 that actually appear in first
year; then the "spot the symbol" mode, which is the weakest of the four.

### If you only do one more thing

Neither of these. **Put it in front of a student and watch the progress screen** with them.

Everything below the UI is verified — 73 templates over ~130k generations, the mastery model
under Monte Carlo, 74 assertions on real hardware. What is *not* verified is the only claim the
product actually makes: that "focus next" names the three things a student would themselves say
they are worst at. That is checkable in an afternoon with one willing HSC student and a
12-question placement check, and it can invalidate design decisions that Phases 6–8 would
otherwise be built on top of.

If a second thing: Phase 6 before Phase 7. The diagrams make the symbols section teach, and the
quiz is worth much less without them.

---

## 9. Working on this with Claude Code

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
