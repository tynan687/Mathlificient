# Distributing Mathlificient to HSC students

A practical guide for handing the app to other students (sideload APK — not the
Play Store; see the caveat at the bottom).

**The quickest route is now the [Releases page](https://github.com/tynan687/Mathlificient/releases/latest)** —
send students that link and they download the APK directly. The build steps below
are only needed when cutting a *new* version.

## Build the release APK

**One-time setup**: generate a keystore (this is your permanent signing identity —
every future update must be signed with the *same* one, or Android refuses to
install it over the last version; back the `.jks` file and its passwords up
somewhere durable outside this machine):
```
keytool -genkeypair -v -keystore mathlificient-release.jks -alias mathlificient ^
  -keyalg RSA -keysize 2048 -validity 10000
```
Then create `VoiceMathTutor/keystore.properties` (gitignored — never committed):
```
storeFile=C:\\path\\to\\mathlificient-release.jks
storePassword=...
keyAlias=mathlificient
keyPassword=...
```

**Every build after that** is one command — no Android Studio GUI needed:
```
gradlew.bat assembleRelease
```
This produces a signed `app/build/outputs/apk/release/app-release.apk` directly,
ready to attach to a GitHub release (or share by Drive/USB). *(Alternative:
Android Studio's Build → Generate Signed App Bundle/APK wizard runs this same
Gradle task and picks up the same keystore.)*

**Before each new release, bump `versionCode` in `app/build.gradle.kts`.** Android
refuses to install an update whose `versionCode` isn't higher than the one already
installed, and the error it shows ("App not installed") doesn't say why.
`versionName` is the human-readable one (`1.0.0`); `versionCode` is just an
ever-increasing integer.

## What each student needs

- **An Android 10+ phone or tablet** (Samsung tablets with S Pen are ideal —
  the tutor reads handwriting on screen).
- **Their own OpenAI API key** (platform.openai.com → API keys, with billing set
  up). The key is stored encrypted on their device and never leaves it except to
  talk to OpenAI directly.
- **Cost expectations**: a typical tutoring hour costs **A$2–6** (GST incl.) —
  silence isn't billed, and the built-in budget guard lowers the model's
  reasoning effort if a session trends over the soft cap (default A$12/hr).
  Watch mode adds ~A$1–3/hr while enabled. The status card and notification
  show live spend; the study log records every session's cost.

## Per-student setup (5 minutes)

1. Install the APK (tap it in Files → allow "Install unknown apps").
2. Open the app → paste API key → Save.
3. **Course**: pick your course — `hsc-advanced`, `hsc-ext1`, `hsc-ext2` (or
   `engineering`). This tunes what the tutor expects you to be studying, along
   with the **Current topic** field (e.g. "differentiating trig functions").
4. Press **Start tutor** and grant: microphone, notifications, *Display over
   other apps*, and the screen-capture prompt (Android asks every session — by
   design).
5. **Samsung battery settings** (once): app battery → Unrestricted; add to
   Never-sleeping apps — otherwise One UI kills the session.

## Practice offline (no API key needed)

Open **Practice Studio** from the bubble menu or the Settings button. It's a full
in-app screen: a generated question up top and an **S Pen ink canvas** below to work
it out by hand (undo, clear, four ink colours) — no floating window, no leaving the
app. It generates unlimited questions with step-by-step worked solutions, completely
offline at no cost. Pick a topic or let it match what you've been working on; reveal
the steps one at a time after trying it. Copy any question as LaTeX (into Word's
equation editor) or as an image (into Samsung Notes).

Most questions come with a **visual** — the actual parabola with its roots marked,
the triangle drawn to scale, the sine curve with the solutions dotted, asymptotes
for partial fractions, bar charts for sequences and binomial probabilities, the
Argand diagram, and more, all drawn from the exact numbers in your question. Tap
**"📈 Visual available"** to drop the diagram down, tap again to tuck it away — it
lives inside the scrolling question pane so it never covers your drawing board or
the formulas.

The **paper (background) colour** is your choice: White, Grey, Sepia, Dark, or a
custom colour from the RGB picker — the ink automatically switches to a light or
dark colour so your writing always contrasts, and any open diagram recolours to
match the paper. The choice is remembered.

**Palm rejection**: rest your hand on the screen while you write — once the app has
seen the S Pen it ignores finger and palm touches entirely (the same rule Samsung
Notes uses), and each stroke follows only the pointer that started it. On a phone
with no stylus, finger drawing still works normally. Rotating the tablet keeps
your working and the current question.

**Erasing**: hold the S Pen's side button and rub over lines to erase them
(whole strokes, like Samsung Notes), or tap the **⌫ eraser** next to the ink
colours to erase with whatever you're drawing with. Undo and Clear still work
as before.

**More room to work**: pinch with two fingers to zoom the paper out (or in) and
drag with two fingers to move around — the sheet is much bigger than the screen,
so zoom out whenever you run out of space. A **"⤾ 1:1"** button appears while
you're zoomed to snap straight back.

During a live tutor session, asking for practice makes the tutor write a question
tailored to your conversation — it appears in a small popup so it doesn't pull you
out of your notes, and you can open it in the Studio.

## Themes

Settings → **App theme**: Slate, Parchment, Forest, or Plum — a warm, classical look
with serif headings that applies live across every screen. Handy for making the app
feel like the student's own.

## Focus tools (offline)

- **Ambient sound** (Focus timer screen, or bubble menu): rain / deep / soft / white
  noise, synthesised on-device — plays while you study in another app, no files, no
  data.
- **Focus timer**: Pomodoro with the countdown shown on the bubble.

## Privacy & the microphone

Use ambient sound with push-to-talk (the default) — steady synthesised noise near an
open hands-free mic can trigger voice detection.

The mic is **locked by default** — it only opens while you hold the bubble to talk.
Hands-free voice detection is off unless a student turns it on in Settings. This is
the right default for shared/school devices and keeps API cost down (nothing is sent
while you work silently). Watch-mode checks use a cheaper vision model, so watching
your working costs only about A$0.3–1/hour.

## How students use it

- Work in Samsung Notes / a PDF / GoodNotes with the S Pen. **Just talk** to
  ask questions — the tutor sees the page. It's Socratic: it never reads out
  final answers; it nudges.
- **Tap** the bubble = quick menu (radial ring on phones, list on tablets):
  hint · snapshot · practice · mute · watch mode · formula sheet · focus timer ·
  ambient sound.
- **Double-tap** the bubble = quick hint (or silent snapshot, per settings).
- **Hold** the bubble = talk (the mic is otherwise locked).
- The bubble takes a firm, deliberate drag to move — it won't wander while you tap.
- **Formula sheet**: 182 formulas with solvers. *Copy LaTeX* → paste into
  Word's equation editor; *Copy/Share image* → paste into Samsung Notes and
  annotate with the S Pen.
- **Watch mode**: checks your working as you write and speaks up on clear
  mistakes. **Focus timer**: Pomodoro with the countdown on the bubble.

## Privacy (worth telling students)

Everything personal stays on the device: the API key (encrypted), the tutor's
memory notes, study log, and spend history. Screenshots and voice go only to
OpenAI's API under the student's own key. No accounts, no server, no analytics.

## Play Store caveat

This app is built for sideloading among people you know. Publishing to the Play
Store is a separate project: data-safety declarations, content ratings, and —
the real blocker — the bring-your-own-API-key model is poor UX at store scale
(a hosted key-proxy with its own billing would be needed). Feasible, but a
deliberate second phase.
