// Shared tutor configuration — direct port of the Android app's TutorConfig/CostMeter.

const TutorConfig = {
  MODELS: ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini'],
  EFFORTS: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  EAGERNESS: ['low', 'medium', 'high', 'auto'],
  VOICES: ['marin', 'cedar'],
  TAP_ACTIONS: ['hint', 'snapshot'],
  WATCH_INTERVALS: [10, 20, 40],

  WATCH_CHECK_INSTRUCTIONS:
    "CHECK: Examine the newest screenshot of the student's working. Reply in text " +
    "only with exactly 'OK' or 'ALERT: <one short sentence naming the line and " +
    "the error>'. Do not speak.",

  basePrompt(topic) {
    return `You are a Socratic voice tutor for first-year undergraduate engineering mathematics.
You speak only - you NEVER read out or dictate final answers, and you never state the
final result of the student's problem. You guide by asking one focused question at a
time and giving small hints, at an easy, encouraging pace.

SCOPE: The student is an engineering student on pre-calculus foundations: most of
their working involves fractions, sign handling, factoring, and polynomials, building
toward functions, differentiation and integration. Watch especially for sign flips,
illegal cancellations, and factoring slips - the classic time-wasters. The student is
CURRENTLY WORKING ON: ${topic}. Center examples and hints there for now, but support
the whole course.

WHAT YOU SEE: You periodically receive a screenshot of the student's computer - either
the full screen or a single focused window, often Microsoft Word in the browser where
the student types out their equations. It may contain typed equation working, a PDF, a
textbook, or a math game. Read it carefully. Reference specific things you see ("I see
on the third line you factored the denominator as..."). If the image is unclear, say so
and ask them to zoom rather than guessing.

BEHAVIOUR UNDER SILENCE: The student is usually working silently. Do NOT speak unless the
student has just spoken to you or the app tells you they tapped for help. Never fill
silence. Never interrupt. When they do speak, respond concisely.

METHOD: Diagnose the likely misconception, then ask a leading question or suggest the
next small step. Praise correct steps. If they're stuck, escalate hints gradually: nudge
-> strategy -> a worked ANALOGOUS mini-example with different numbers (never their actual
answer). Comment on workflow ("try writing the setup before substituting").

REASONING: Reason before responding on multi-step diagnoses; answer simple check-ins
quickly. Keep spoken replies short and warm. Do not reveal your internal reasoning.`;
  },

  memoryGuidance:
    'MEMORY: You have a save_student_note tool. When you notice a DURABLE fact worth ' +
    'remembering across sessions - a recurring misconception, a skill they have clearly ' +
    'mastered, a learning preference, or that they have moved to a new topic - call it ' +
    'with one concise sentence. Use it sparingly (a few times per session at most), never ' +
    'for transcripts or one-off details, and do not announce that you are saving a note.',

  watchGuidance:
    "WATCH MODE: The app periodically sends you a screenshot of the student's working " +
    'together with a silent CHECK request. For a CHECK you must reply in TEXT ONLY with ' +
    'exactly "OK" if the visible working is correct, unfinished, or unclear - or ' +
    '"ALERT: <one short sentence naming the specific line and the error>" if there is a ' +
    'CLEAR mathematical mistake. Never flag half-written steps, style, or anything you ' +
    'are not sure about. When the app afterwards asks you to speak about a flagged ' +
    'mistake, deliver it as one brief, kind interruption.',

  textbookGuidance(textbook, hasReaderWindow) {
    let text = `TEXTBOOK: The student's course textbook is "${textbook}". When pointing them to
study material, cite this book's chapter/section NAMES (e.g., "the section on factoring
by grouping"). Give page numbers only if you are genuinely confident for that edition;
otherwise say "look up <topic> in the index". Never invent page numbers.`;
    if (hasReaderWindow) {
      text += `
The student keeps the book open in a reader window. Use the view_textbook tool to see
the page they currently have open. If you need a different section, ask them to navigate
there, then call the tool again. Reference only what you actually see on the page -
reading the real page number off the page beats guessing.`;
    }
    return text;
  },

  assessmentGuidance:
    'ASSESSMENT MODE: The student is writing up their own work and wants early ' +
    'intervention so they do not waste time down a wrong path. When the app asks you ' +
    'to speak about a flagged error, be DIRECT and brief: name the line, say what went ' +
    'wrong (e.g., "the sign flipped when you expanded the bracket") and how to get ' +
    'back on track - then let them continue. Do not expand into a full tutoring ' +
    'dialogue unless they engage you. If the same kind of mistake has been flagged ' +
    'more than once this session, add ONE pointer to the relevant textbook section or ' +
    'a short search phrase. If they ask for help directly, help genuinely with advice ' +
    'and reasoning support.',

  ASSESSMENT_REPORT_INSTRUCTIONS:
    'REPORT: In text only (no audio), write a short study report (under 200 words) ' +
    'from the mistakes flagged this session. Group them by topic, name the likely ' +
    'underlying misconception for each group, recommend the specific sections of the ' +
    "student's textbook to reread (or a well-known alternative book if none is set), " +
    'and finish with 2-3 search phrases they can look up. Plain text.',

  instructions(settings, memorySummary) {
    let text = this.basePrompt(settings.currentTopic || 'partial fraction decomposition');
    if (settings.personalisationEnabled) {
      text += '\n\n' + this.memoryGuidance;
      if (memorySummary) {
        text += '\n\nWHAT YOU KNOW ABOUT THIS STUDENT (saved in previous sessions, newest first):\n'
          + memorySummary;
      }
    }
    if (settings.watchMode || settings.assessmentMode) {
      text += '\n\n' + this.watchGuidance;
    }
    text += '\n\nSHOWING WORKING: You have a show_working tool that renders LaTeX in a '
      + 'panel the student can see and copy from. Whenever you demonstrate or walk '
      + 'through mathematical steps, push them there (one step per array item) while '
      + 'you speak — say the reasoning aloud, let the panel carry the symbols. Never '
      + 'read LaTeX syntax out loud.';
    if (settings.textbook || settings.textbookWindowName) {
      text += '\n\n' + this.textbookGuidance(
        settings.textbook || 'the course textbook (title not specified)',
        !!settings.textbookWindowName
      );
    }
    if (settings.assessmentMode) {
      text += '\n\n' + this.assessmentGuidance;
    }
    return text;
  },

  sessionObject(settings, { includeModel, effortOverride = null, memorySummary = null } = {}) {
    const session = {
      type: 'realtime',
      output_modalities: ['audio'],
      instructions: this.instructions(settings, memorySummary),
      audio: {
        input: {
          turn_detection: settings.pushToTalk ? null : {
            type: 'semantic_vad',
            eagerness: settings.vadEagerness,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice: settings.voice },
      },
      reasoning: { effort: effortOverride || settings.reasoningEffort },
      truncation: { type: 'retention_ratio', retention_ratio: 0.8 },
      max_output_tokens: 2048,
    };
    const tools = [];
    if (settings.personalisationEnabled) {
      tools.push({
        type: 'function',
        name: 'save_student_note',
        description:
          'Save a short durable observation about the student (a misconception, a ' +
          'mastered skill, a preference) and/or update the topic they are currently ' +
          'working on. One concise sentence per note; use sparingly.',
        parameters: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'One-sentence durable fact about the student' },
            current_topic: { type: 'string', description: 'The new current topic, if it has changed' },
          },
          required: [],
        },
      });
    }
    if (settings.textbookWindowName) {
      tools.push({
        type: 'function',
        name: 'view_textbook',
        description:
          "Capture the page currently open in the student's textbook reader window so " +
          'you can read it. Call it when you need to check the textbook - after asking ' +
          'the student to open the section you want, if needed.',
        parameters: { type: 'object', properties: {}, required: [] },
      });
    }
    tools.push({
      type: 'function',
      name: 'show_practice',
      description:
        'Display a practice question in the student\'s practice window: a question ' +
        'tailored to what you have been discussing, with worked steps they can reveal ' +
        'one at a time. Call when they ask for practice. All fields are LaTeX (no $ ' +
        'delimiters). Introduce it briefly aloud without reading the maths out.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question, LaTeX' },
          steps: { type: 'array', items: { type: 'string' }, description: 'Worked solution steps, one LaTeX line each' },
          answer: { type: 'string', description: 'Final answer, LaTeX' },
        },
        required: ['question', 'steps', 'answer'],
      },
    });
    tools.push({
      type: 'function',
      name: 'show_working',
      description:
        'Display step-by-step mathematical working to the student as rendered LaTeX ' +
        'in their Worked Examples panel. Call this whenever you demonstrate how to ' +
        'solve an equation while you talk — one LaTeX expression per step. Do not ' +
        'read the LaTeX aloud; speak naturally and let the panel show the maths.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title, e.g. "Solving x^2-5x+6=0"' },
          steps: {
            type: 'array', items: { type: 'string' },
            description: 'LaTeX expressions, one per line/step (no $ delimiters)',
          },
          note: { type: 'string', description: 'Optional one-line plain-text remark' },
        },
        required: ['steps'],
      },
    });
    tools.push({
      type: 'function',
      name: 'web_search',
      description:
        'Search the web (an encyclopedic reference source) for a concept, definition, ' +
        'or formula. Use it to check facts or find current information, then summarise ' +
        'concisely for the student and cite the source by name. Keep it brief.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The search query' } },
        required: ['query'],
      },
    });
    if (settings.hasPdfs) {
      tools.push({
        type: 'function',
        name: 'search_textbooks',
        description:
          "Search the student's uploaded textbooks to find where a topic is covered. " +
          'Returns the book title and page numbers with a short reason. Use it when the ' +
          'student keeps struggling or asks where something is in their book, then cite ' +
          'the book and page. Reading happens on-device; only page references come back.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The topic to locate' },
          },
          required: ['query'],
        },
      });
    }
    if (tools.length) session.tools = tools;
    if (includeModel) session.model = settings.model;
    return session;
  },

  memorySummary(memory, maxChars = 2400) {
    const lines = [];
    let length = 0;
    for (const note of [...(memory.notes || [])].reverse()) {
      const line = `- [${note.date}] ${note.text}`;
      if (length + line.length > maxChars) break;
      lines.push(line);
      length += line.length + 1;
    }
    return lines.join('\n');
  },
};

// USD per single token (published per-1M rates / 1e6), July 2026.
const PRICING = {
  flagship: {
    audioIn: 32e-6, audioInCached: 0.4e-6, audioOut: 64e-6,
    textIn: 4e-6, textInCached: 0.4e-6, textOut: 24e-6,
    imageIn: 5e-6, imageInCached: 0.5e-6,
  },
  mini: {
    audioIn: 10e-6, audioInCached: 0.3e-6, audioOut: 20e-6,
    textIn: 0.6e-6, textInCached: 0.06e-6, textOut: 2.4e-6,
    imageIn: 0.8e-6, imageInCached: 0.08e-6,
  },
};

const AUD_PER_USD = 1 / 0.6982; // AUD/USD 0.6982 (17 Jul 2026)
const GST_MULTIPLIER = 1.10;

class CostMeter {
  constructor(model) {
    this.rates = model.includes('mini') ? PRICING.mini : PRICING.flagship;
    this.startMs = Date.now();
    this.totalUsd = 0;
  }

  addUsage(usage) {
    const input = usage.input_token_details || {};
    const cached = input.cached_tokens_details || {};
    const output = usage.output_token_details || {};
    const cachedText = cached.text_tokens || 0;
    const cachedAudio = cached.audio_tokens || 0;
    const cachedImage = cached.image_tokens || 0;
    const freshText = Math.max((input.text_tokens || 0) - cachedText, 0);
    const freshAudio = Math.max((input.audio_tokens || 0) - cachedAudio, 0);
    const freshImage = Math.max((input.image_tokens || 0) - cachedImage, 0);
    this.totalUsd +=
      freshText * this.rates.textIn +
      freshAudio * this.rates.audioIn +
      freshImage * this.rates.imageIn +
      cachedText * this.rates.textInCached +
      cachedAudio * this.rates.audioInCached +
      cachedImage * this.rates.imageInCached +
      (output.text_tokens || 0) * this.rates.textOut +
      (output.audio_tokens || 0) * this.rates.audioOut;
  }

  totalAud() {
    return this.totalUsd * AUD_PER_USD * GST_MULTIPLIER;
  }

  projectedHourlyAud() {
    const elapsedHours = (Date.now() - this.startMs) / 3_600_000;
    return this.totalAud() / Math.max(elapsedHours, 5 / 60);
  }
}
