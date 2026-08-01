# Mathlificient — working notes for Claude Code

Offline-first maths study app for HSC and first-year engineering. One shared JavaScript
question engine, shipped as an **Android APK** (WebView) and a **Windows Electron app**.

Read [HANDOVER.md](HANDOVER.md) for the full picture. This file is the short version that
matters while editing, plus the things that have already gone wrong.

---

## The one architectural fact

**The engine is plain `<script>` files sharing one global scope — no bundler, no modules —
and they exist as byte-identical copies in two trees.** The copies are not symlinked and the
paths do not line up.

| Shared source of truth | Android copy |
|---|---|
| `VoiceMathTutorPC/renderer/*.js` | `VoiceMathTutor/app/src/main/assets/formulas/*.js` |
| `VoiceMathTutorPC/renderer/tools/{practice,progress,symbols}.js` | same folder, **flat** |

**Edit the PC copy, then sync. Never edit the Android copy directly.**

```bash
node tools/sync-shared.js          # PC -> Android
node tools/sync-shared.js --check  # fails on drift; run before committing
```

New shared file? Add it to `PAIRS` in `tools/sync-shared.js`. That is the entire contract, and
`formulas.js` silently diverged for weeks before the script existed.

The three `*.html` pages are **intentionally divergent** (Android has 44px touch targets and
different asset paths) and live in `DIVERGENT`. `--check` still cross-checks that both
`practice.html` files load the same set of `<script>` tags, because nothing else would catch
adding a shared module to one page and forgetting the other.

## Environment guards

Every shared file runs in three places and must assume none of them:

```js
const isElectron = typeof window.tutor !== 'undefined';   // Electron IPC
const hasBridge  = typeof Android !== 'undefined';        // Android @JavascriptInterface
// ...and neither, under Node in tools/test/
```

End shared files with `if (typeof module !== 'undefined' && module.exports) { ... }` so the
harnesses can require them.

---

## Run the tests

There is no system `node` on this machine. **Electron is the JS runtime.**

```powershell
$env:ELECTRON_RUN_AS_NODE = 1
$e = "$env:LOCALAPPDATA\vmt-build\node_modules\electron\dist\electron.exe"

& $e tools\test\run-all.js            # everything that needs no tablet (~2 min)
& $e tools\test\run-all.js --fast     # skip the slow generator sweep (~30 s)
& $e tools\test\run-all.js pc         # just the PC suites
```

Individual checks, when you want the detail:

```powershell
& $e tools\check-practice.js                  # ~2000 generations per template
& $e tools\check-practice.js --runs 50 quad   # while authoring one template
& $e tools\check-practice.js --sample quad    # print an example option set
& $e tools\check-symbols.js --list            # read the symbol entries
```

`tools/test/device-*.js` need a **connected tablet and a debug build** — see
`tools/test/README.md`.

**The PC suites load pages from `%LOCALAPPDATA%\vmt-build`**, because the repo is in OneDrive and
`npm install` was never run there. After editing `VoiceMathTutorPC/renderer/`, copy it across —
`paths.js` hard-fails on drift, so a stale copy cannot report green:

```powershell
robocopy "VoiceMathTutorPC\renderer" "$env:LOCALAPPDATA\vmt-build\renderer" /MIR
```

---

## Adding a question generator

Full rules in [HANDOVER.md §4](HANDOVER.md#4-adding-a-question-generator). The five that bite:

1. **Always return a `w` workings bag** from `generate()`. It never gets stored — `buildQuestion`
   destructures it out — so it is free, and retrofitting it across 33 templates once was enough.

2. **Format with the `PR` helpers**, never raw interpolation:
   `PR.lead(n, v)` leading coefficient · `PR.xt(n, v)` signed mid-chain term · `PR.ct(n)` signed
   constant · `PR.par(n)` parenthesise negatives.
   Raw interpolation produces `0x`, `1x`, `(x + 0)` and — found on a tablet screen after four
   harness layers missed it — `\sqrt{-16^2 + 12^2}`, which reads as *minus sixteen squared*.

3. **Distractors are named misconceptions.** Every `why` must exist in `MISCONCEPTIONS`
   (`practice-data.js`), whose entries are `{ label, hint }` in **plain text, never LaTeX** —
   `label` completes "you keep …" and is rendered with `textContent`.

4. **Author distractors with the same template literal as the answer.** Otherwise options differ
   by formatting rather than by maths and the answer is pickable without doing any.

5. **Narrow the parameter range wherever a value makes the named mistake give the right answer.**
   Every such range in `practice-data.js` carries a comment saying which misconception it
   protects — `quad-formula` forces `a ≥ 2` because at `a = 1`, "forgot the *a* in b²−4ac" is
   correct. **Do not widen one without reading the comment.**

Then run `check-practice.js`. It fails on: an option that is secretly right (including
reorderings and `x^{0}` vs `1`), an answer identifiable by its *form* alone, coefficient
artifacts in any question/step/option, a negative raised to a power without brackets, non-finite
values, unknown or unreachable `why` keys, a `viz` type with no renderer, and a fallback rate
over 5%.

---

## Things that have already cost time

**Build**
- No `gradlew` in this repo and no `java` on PATH. Android builds need
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"` — note the **`1`**; the plain
  "Android Studio" folder is a broken install — and
  `& "$env:LOCALAPPDATA\vmt-tools\gradle-8.9\bin\gradle.bat" assembleRelease`.
  `apksigner` needs the same `JAVA_HOME`.
- Lint has no `@RequiresApi` anywhere, which makes `NewApi` the complete ground truth for the
  minSdk 29 floor. It is 0. Keep it there.

**Electron**
- `userData` derives from **`productName`**, not package `name`. A rename strands user data;
  `migrateLegacyUserData()` in `main.js` exists because that already happened.
- A window's real title comes from the page's `<title>`, which **overrides** the constructor
  option. `OWN_WINDOW_TITLES` is matched against the former.
- **`capturePage()` on a `show: false` window lies.** It returned a page with every KaTeX glyph
  missing while the DOM was provably correct. Hidden windows are fine for assertions;
  screenshots need `show: true`.

**Android / device testing**
- Release builds are **not debuggable** — no devtools socket, no `run-as`. `isMinifyEnabled = false`
  for release, so debug and release run identical code: install debug to instrument, then
  reinstall release. Neither installs over the other — `adb uninstall` first, every time.
- The devtools socket is named after the **PID** and changes on every restart. Re-read
  `/proc/net/unix` and re-run `adb forward` before *every* attach.
- `/json/list` returns **stale targets** — an activity left in the back stack keeps its WebView.
  Take the last match, and `force-stop` before reopening a screen you already visited.
- `adb shell screencap -p /sdcard/x.png` then `adb pull`. PowerShell's `>` corrupts binary.
- `WebView.setPadding` does **not** inset the viewport, and CSS `env(safe-area-inset-*)` is 0 in
  a WebView. Pad a wrapper `FrameLayout` instead.
- `domStorageEnabled` defaults to **false**; the practice/progress/symbols activities set it
  because the answering mode lives in `localStorage`.

**Harnesses**
- Every Electron harness clears `localStorage` at startup. They share the default profile on
  disk, so a mode remembered by one leaks into the next and looks exactly like a product bug.
- Watch for checks that cannot fail. Two happened here: a canvas test counting "non-white"
  pixels while the page was themed dark (every pixel counted; it reported the identical total
  for four different templates), and a shape rule demanding all four options match when what
  actually matters is only that **the answer is not the only one of its form**.

---

## House style

- British spelling in user-facing text ("factorise", "practise" the verb).
- Comments explain **why**, not what — especially every narrowed parameter range.
- Match the surrounding code: no framework, no TypeScript, no build step in the engine.
- The offline-first, no-account promise is the product. Anything that needs a network or a
  login belongs behind the optional bring-your-own-key tutoring, never in practice or progress.
