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
  diagrams, bar charts...). On Android, an S Pen ink canvas sits underneath to work
  it out by hand — palm rejection, a hold-the-button eraser, a toolbar eraser, and
  pinch-to-zoom for extra working space.
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

> **No prebuilt installer is published here yet** — this repo is source code, and
> each platform below is built locally from it. That's normal for a personal/small-
> group project distributed by sideloading rather than an app store.

---

## Install on Android (tablet or phone)

**Requirements:** [Android Studio](https://developer.android.com/studio) (any recent
version), a device running **Android 14 or newer**, and — only if you want live voice
tutoring — an [OpenAI API key](https://platform.openai.com/api-keys) with billing set
up. Practice Studio, the formula sheet, the timer, and ambient sound need no key at all.

1. **Clone the repo** and open the `VoiceMathTutor/` folder as a project in Android
   Studio (File → Open → select that folder). Let it finish syncing Gradle — this
   downloads everything needed automatically.
2. **Build the APK**: Build menu → **Generate Signed App Bundle / APK** → APK →
   create a new keystore the first time (save the `.jks` file and its passwords
   somewhere safe — you'll need the *same* keystore to sign every future update, or
   Android will refuse to overwrite the app). Build the **release** variant.
   *(For a quick test build without signing, `Build → Build Bundle(s)/APK(s) → Build APK(s)`
   with the debug variant works too, and can be installed the same way.)*
3. The finished APK lands in `VoiceMathTutor/app/release/` (or `app/debug/`).
   Copy it to the tablet/phone (USB, Drive, email — any method) and open it there.
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
3. **Package it into a real app:**
   ```bash
   npx @electron/packager . VoiceMathTutor --platform=win32 --arch=x64 --out=dist --overwrite
   ```
   This creates `VoiceMathTutorPC/dist/VoiceMathTutor-win32-x64/`, a folder containing
   `VoiceMathTutor.exe` and everything it needs — no installer, just a folder you can
   run from anywhere or move to `%LOCALAPPDATA%\Programs\VoiceMathTutor\` and pin to
   the Start Menu / taskbar like a normal app.

   *(For quick testing without packaging, skip step 3 and just run `npx electron .`
   from inside `VoiceMathTutorPC/` instead.)*
4. **Run `VoiceMathTutor.exe`.** First launch: paste your OpenAI API key → **Save
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
