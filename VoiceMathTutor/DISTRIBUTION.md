# Distributing Voice Math Tutor to HSC students

A practical guide for handing the app to other students (sideload APK — not the
Play Store; see the caveat at the bottom).

## Build the release APK (one-time per version)

1. Open `VoiceMathTutor/` in Android Studio.
2. Build → **Generate Signed App Bundle / APK** → APK → create (or reuse) your
   keystore (.jks — keep it safe; you must sign every future update with it).
3. Build **release**. Share the APK from `app/release/` (Drive link, USB, etc.).

## What each student needs

- **An Android 14+ tablet or phone** (Samsung tablets with S Pen are ideal —
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

The **paper (background) colour** is your choice: White, Grey, Sepia, Dark, or a
custom colour from the RGB picker — the ink automatically switches to a light or
dark colour so your writing always contrasts. The choice is remembered.

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
