# Mathlificient

A math tutor app for HSC students and undergrad engineering math units, built for two
platforms from one shared design:

- **`VoiceMathTutor/`** — Android app (built for a Samsung Galaxy Tab S9 FE + S Pen,
  works on any Android 14+ phone/tablet)
- **`VoiceMathTutorPC/`** — Windows desktop app (Electron)

**Everything works fully offline and free, no account or API key needed:**
- **Practice Studio** — unlimited generated questions across 33 topics (algebra,
  quadratics, trig, calculus, vectors, matrices, stats, partial fractions, and
  more) with step-by-step worked solutions and an auto-drawn diagram per question
  (parabolas with roots marked, triangles to scale, sine curves, asymptotes, Argand
  diagrams, bar charts...). A drawing canvas sits underneath to work it out by
  hand on both platforms: **Android** with the S Pen (palm rejection, a
  hold-the-button eraser, a toolbar eraser, pinch-to-zoom); **PC** with a mouse
  or a plugged-in graphics tablet/pen (pressure, eraser end/barrel button, and
  scroll-wheel zoom all work automatically via the browser's Pointer Events —
  no drivers needed). PC also gets **Quiz mode** (a scored run of 5/10/20
  questions with a missed-question review) and a **printable worksheet**
  export (questions + working space + an answer key, via your system print
  dialog — "Microsoft Print to PDF" to save a file).
- **Formula sheet** — 182 formulas across 15 topic groups, 82 of them interactive
  solvers (type your values, get the answer + LaTeX you can copy into Word or
  Samsung Notes).
- **Focus timer** (Pomodoro) and **ambient background noise** (rain/brown/pink/fan,
  synthesised on-device).

**Optional live voice tutoring** (bring your own OpenAI API key, costs roughly
A$2–6/hour): a floating bubble that listens, watches your screen or handwriting,
and talks you through problems Socratically — it nudges rather than gives away
answers. Includes a cost meter with a hard budget cap, watch mode that flags
mistakes as you write, an "assessment mode" for early-intervention feedback on
longer written work (PC only), and a memory system so it remembers what you're
working on between sessions.

Full feature lists and screenshots-in-words live in each app's own docs:
[`VoiceMathTutor/DISTRIBUTION.md`](VoiceMathTutor/DISTRIBUTION.md) and
[`VoiceMathTutorPC/README.md`](VoiceMathTutorPC/README.md).

> **This repo holds source code, not binaries** — a signed Android APK and a
> Windows build are produced with a single command each (below) and are meant
> to be handed around directly (Drive link, USB) rather than committed to git
> or published to an app store. That's normal for a personal/small-group
> project distributed by sideloading.

---

## Install on Android (tablet or phone)

**Requirements:** [Android Studio](https://developer.android.com/studio) (any recent
version), a device running **Android 14 or newer**, and — only if you want live voice
tutoring — an [OpenAI API key](https://platform.openai.com/api-keys) with billing set
up. Practice Studio, the formula sheet, the timer, and ambient sound need no key at all.

1. **Clone the repo.** A JDK is all you need for the CLI path below; Android
   Studio is only required if you'd rather use its GUI.
2. **One-time**: generate a signing keystore (this is your permanent app identity —
   back up the `.jks` and its password somewhere durable, losing it means every
   future update becomes a new, unrelated app to anyone who already installed):
   ```
   keytool -genkeypair -v -keystore mathlificient-release.jks -alias mathlificient -keyalg RSA -keysize 2048 -validity 10000
   ```
   Then create `VoiceMathTutor/keystore.properties` (gitignored, never committed):
   ```
   storeFile=C:\\path\\to\\mathlificient-release.jks
   storePassword=...
   keyAlias=mathlificient
   keyPassword=...
   ```
3. **Build**: `cd VoiceMathTutor` then `gradlew.bat assembleRelease` — produces a
   signed `app/build/outputs/apk/release/app-release.apk` directly, ready to
   copy to the tablet/phone (USB, Drive, email — any method) and install.
   *(Alternative: Android Studio's Build → Generate Signed App Bundle/APK wizard
   works too, and picks up the same keystore.)*
4. **On the device**, tap the APK file → Android will prompt to allow installs from
   that source (Files app, browser, etc.) → **Install**.
5. **Open the app**:
   - For **Practice Studio only** (offline, no key): tap **Practice** from the main
     screen — you're done, start generating questions.
   - For **live voice tutoring**: paste your OpenAI API key on the first screen →
     Save → pick your course (`hsc-advanced` / `hsc-ext1` / `hsc-ext2` / `engineering`)
     → **Start tutor**, and grant the microphone, notification, "Display over other
     apps", and screen-capture permissions when prompted (Android asks for screen
     capture every session by design — that's expected, not a bug).
   - **Samsung tablets**: go to Settings → Battery → this app → set to
     **Unrestricted** and add it to never-sleeping apps, otherwise One UI will kill
     a live session in the background.

Full walkthrough, cost expectations, and every feature explained:
[`VoiceMathTutor/DISTRIBUTION.md`](VoiceMathTutor/DISTRIBUTION.md).

---

## Install on Windows (PC)

**Requirements:** [Node.js](https://nodejs.org/) (LTS, v18+) to build it — nothing extra
is needed to *run* it afterwards. An OpenAI API key is only needed for live voice
tutoring; the offline tools (formula sheet, converter, timer) need nothing.

1. **Clone the repo**, then open a terminal in the `VoiceMathTutorPC/` folder.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Build a proper installer** (`Setup.exe` with a Start Menu shortcut and
   uninstaller):
   ```bash
   npm run dist
   ```
   Output: `dist/VoiceMathTutor Setup <version>.exe`. If this fails with
   `Cannot create symbolic link : A required privilege is not held by the client`,
   turn on **Settings → Privacy & security → For developers → Developer Mode**
   and re-run — Windows blocks a code-signing helper's download by default,
   even though nothing here is actually being signed.

   *(No installer needed / hit the privilege issue and can't flip Developer Mode?
   Use the portable fallback instead — same output either way:*
   ```bash
   npx @electron/packager . VoiceMathTutor --platform=win32 --arch=x64 --out=dist --overwrite --icon=icon.ico
   ```
   *creates `dist/VoiceMathTutor-win32-x64/VoiceMathTutor.exe` — copy the whole
   folder to `%LOCALAPPDATA%\Programs\VoiceMathTutor\` and shortcut it yourself.)*

   *(For quick dev testing without packaging either way, just run `npx electron .`
   from inside `VoiceMathTutorPC/`.)*
4. **Run the installer (or `VoiceMathTutor.exe`).** First launch: paste your OpenAI API key → **Save
   key** (it's encrypted on-device via Windows DPAPI) → **Start tutor**, allow the
   microphone if Windows asks. A small floating π bubble appears — drag it anywhere,
   tap it for the quick menu, hold it to talk.
   - To use the **offline tools only** (formula sheet, unit converter, focus timer),
     no API key is needed — open them straight from the bubble's right-click menu.

Full feature list (capture-target picker, textbook reference tools, assessment
mode, themes, and more): [`VoiceMathTutorPC/README.md`](VoiceMathTutorPC/README.md).

---

## Privacy

Everything personal — your API key, the tutor's memory of you, study logs, spend
history — stays on your own device (encrypted where it matters). Screenshots and
voice audio go only to OpenAI's API under *your own* key when you use live tutoring.
No accounts, no server, no analytics, nothing shared between the Android and PC
versions.

## A note on distribution

This project is meant to be shared by sideloading among people you know (classmates,
study groups) — not published to an app store. See the *Play Store caveat* section
at the bottom of [`VoiceMathTutor/DISTRIBUTION.md`](VoiceMathTutor/DISTRIBUTION.md)
for why.
