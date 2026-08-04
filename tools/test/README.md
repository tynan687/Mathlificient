# tools/test

Every automated check for Mathlificient. There is no test framework here — each file is a
script that prints `PASS`/`FAIL` lines and exits non-zero if any failed. That is deliberate:
the app has no build step, so neither do its tests.

## Running them

**There is no system `node` on the original dev machine — Electron is the JS runtime.**

```powershell
$env:ELECTRON_RUN_AS_NODE = 1
$e = "$env:LOCALAPPDATA\vmt-build\node_modules\electron\dist\electron.exe"
& $e tools\test\run-all.js
```

If you have a normal Node install, `node tools/test/run-all.js` works for the `.mjs`/`node:true`
suites, but the ones that open a window still need Electron. `run-all.js` finds Electron in
`VoiceMathTutorPC/node_modules` or `%LOCALAPPDATA%\vmt-build` and sets `ELECTRON_RUN_AS_NODE`
per suite, so it is the path of least resistance either way.

```
run-all.js              12 suites, ~2 min
run-all.js --fast       skip the generator sweep, ~30 s
run-all.js android      only suites whose name contains "android"
```

`run-all.js` deliberately **excludes** `device-*.js` — those need a tablet.

### From a Linux box, or a tablet driving one

The window suites need a display, not a desktop, so they run headless:

```sh
npm install --prefix VoiceMathTutorPC     # electron + katex + pdfjs-dist is enough
Xvfb :99 -screen 0 1400x1100x24 &
DISPLAY=:99 node tools/test/run-all.js
```

Nothing else changes — `paths.js` prefers the repo once it has a `node_modules`, and
`electronBinary()` already looks for the Linux binary. Two of the bugs fixed on this
branch were found this way and neither needed a device.

### What still cannot be checked without the SDK

The Kotlin has no offline path to a typecheck: `android.jar` comes from `dl.google.com`,
which a proxied environment may well refuse. `kotlinc` alone (from Maven Central or the
GitHub release) will still **parse** the sources, which catches structural mistakes:

```sh
kotlinc -nowarn -d /tmp/kout VoiceMathTutor/app/src/main/java/com/tynan/mathtutor/**/*.kt
```

Expect roughly a thousand `unresolved reference` errors — every `android.*`, `androidx.*`,
`org.json.*` and `kotlinx.*` symbol. That is the missing classpath, not the code. What
matters is that **no error mentions `expecting`, `unexpected token` or `unbalanced`**;
those are the parser talking, and they are real. Filter with:

```sh
grep -iE "error:.*(expecting|unexpected|unbalanced|syntax|illegal)" kotlinc.log
```

`tools/check-activities.js` covers the other half — that the Kotlin screens still agree
with the pages they host — and needs neither a compiler nor a device.

## Where the app under test comes from

`paths.js` resolves it: `$VMT_PC` → the repo (if `VoiceMathTutorPC/node_modules/katex` exists)
→ `%LOCALAPPDATA%\vmt-build`. The pages load KaTeX from `../../node_modules`, so the harnesses
need a directory that has one.

**On the original dev machine it resolves to `vmt-build`, and that is expected.** The repo lives
in OneDrive and `npm install` was deliberately never run there — Electron and KaTeX live in
`vmt-build` instead. So the PC suites load `renderer/` pages from `vmt-build`, which means an
edit to `VoiceMathTutorPC/renderer/` in the repo is *not* what they test until you copy it over:

```
robocopy "<repo>\VoiceMathTutorPC\renderer" "%LOCALAPPDATA%\vmt-build\renderer" /MIR
copy "<repo>\VoiceMathTutorPC\main.js" "<repo>\VoiceMathTutorPC\preload.js" "%LOCALAPPDATA%\vmt-build\"
```

You will not forget silently. `paths.js` hashes both renderer trees on every run and **exits 1
naming the drifted files** rather than reporting a green pass against stale code. If you would
rather test the source directly, `npm install` inside `VoiceMathTutorPC` makes the repo win the
resolution order and the check no longer applies.

Note the asymmetry — `ASSETS` (the Android copies) always points at the **repo**, because
nothing else has a copy of those. Only the PC side follows `PC`.

## The suites

| File | Needs | What it proves |
|---|---|---|
| `skills.mjs` | node | Skill graph is acyclic, every prereq resolves, topic strings match |
| `model.mjs` | node | Mastery maths: decay, weighting, guessing correction, Monte Carlo convergence |
| `../check-practice.js` | node | ~2000 generations × 66 templates: no bad options, no artifacts |
| `../check-symbols.js` | node | Symbol entries, categories, cross-references, readings |
| `../sync-shared.js --check` | node | PC and Android shared copies are identical |
| `viz.js` | window | Every `viz` type actually draws something, and differently per template |
| `pc-progress.js` | window | Grading, quiz, placement, progress bars, recommender |
| `pc-mcq.js` | window | Multiple choice end to end, including the reveal-then-pick guard |
| `pc-symbols.js` | window | Symbols browse, search, read-aloud breakdown |
| `android-progress.js` | window | The Android page at 360 dp, through a fake bridge |
| `android-mcq.js` | window | Options at 360 dp, the `.mini` popup, `applyPaper` |
| `android-symbols.js` | window | Symbols at 360 dp |
| `device-core.js` | **tablet** | Practice, grading, persistence on real hardware |
| `device-placement.js` | **tablet** | The 12-question placement check on real hardware |
| `device-symbols.js` | **tablet** | Symbols screen on real hardware |
| `device-viz.js` | **tablet** | Every renderer draws on the real WebView — practice templates *and* symbol diagrams, with a check that no type is left undrawn |
| `device-phase8.js` | **tablet** | `Proficiency.resetSkill` and `Bridge.shareText` through the real bridge, the slips panel on device, and `markAnswer` in the real WebView. This is the only cover for that Kotlin — the stand-in proves the JS calls it, nothing more |

`android-bridge-preload.js` is not a suite — it is the fake `Android` object the three
`android-*` harnesses inject, backing `profAll`/`profAppend`/`profReset` with an in-memory store.

## Running the on-device suites

They attach to a real WebView over the Chrome DevTools Protocol. `cdp.js` is the client.

1. **Install a debug build.** Release builds are not debuggable — no devtools socket, no
   `run-as`. `isMinifyEnabled = false` for release, so debug and release run identical code.
   Debug and release do not install over each other:
   ```bash
   adb uninstall com.tynan.mathtutor
   ```
2. Open the screen you want to test on the tablet.
3. Run the suite. It resolves the socket, forwards it, and attaches.

Three traps, all of which have cost hours here:

- **The socket is named after the PID** (`webview_devtools_remote_<pid>`) and changes on every
  app restart. Re-read `/proc/net/unix` and re-run `adb forward` before *every* attach —
  `cdp.js` does this, don't cache it.
- **`/json/list` returns stale targets.** An activity left in the back stack keeps its WebView
  alive and listed. Take the **last** match, and `adb shell am force-stop` before reopening a
  screen you have already visited.
- **Screenshots**: `adb shell screencap -p /sdcard/x.png` then `adb pull`. PowerShell's `>`
  corrupts binary streams.

## Writing a new check

Follow the existing shape — `ok(name, condition, detail)`, and make `detail` say what the value
actually was, not just that it was wrong.

Two rules learned the hard way:

1. **Clear `localStorage` first.** The harnesses share the default Electron profile on disk, so
   a mode remembered by an earlier run leaks into the next and looks exactly like a product bug:
   ```js
   await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
   ```
2. **Make sure your check can fail.** Two here could not. A canvas test counted "non-white"
   pixels on a dark-themed page — every pixel qualified, and it reported the identical total for
   four different diagrams. And a shape rule demanded all four options match when the real
   property is only that the answer is not the *only* one of its form. Before trusting a green
   check, break the thing it watches and confirm it goes red.

`capturePage()` on a `show: false` window returns frames with glyphs missing while the DOM is
provably correct. Hidden windows are fine for assertions; use `show: true` for screenshots.
