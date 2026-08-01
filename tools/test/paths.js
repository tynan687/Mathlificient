// Where the harnesses find the app under test.
//
// Defaults to the repo itself, so a fresh clone works after one `npm install`
// in VoiceMathTutorPC (the pages load KaTeX from ../../node_modules).
//
// Set VMT_PC to point somewhere else — an installed build, or a packaging
// directory outside the repo — if that is how you work:
//
//   $env:VMT_PC = "$env:LOCALAPPDATA\vmt-build"     # PowerShell
//   VMT_PC=/path/to/build node tools/test/pc-mcq.js  # sh
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '..', '..');

/**
 * The pages load KaTeX from ../../node_modules, so the harnesses need an app
 * directory that actually has one. Prefer the repo; fall back to the local
 * packaging directory, which is where this project's dependencies have
 * historically lived (the repo sits in OneDrive, and npm install there was
 * avoided). Either way this works with no setup.
 */
function resolvePc() {
  if (process.env.VMT_PC) return process.env.VMT_PC;
  const inRepo = path.join(REPO, 'VoiceMathTutorPC');
  if (fs.existsSync(path.join(inRepo, 'node_modules', 'katex'))) return inRepo;
  const build = path.join(process.env.LOCALAPPDATA || '', 'vmt-build');
  if (fs.existsSync(path.join(build, 'node_modules', 'katex'))) return build;
  return inRepo; // no deps anywhere — let the harness fail with a clear error
}
const PC = resolvePc();

/**
 * If the app under test is NOT the repo, the harnesses load `renderer/` pages
 * from there — so an edit to the repo's renderer is not what they test, and a
 * stale copy reports green. A warning is not enough for that: it scrolls past.
 *
 * Compare the two renderer trees and refuse to run on any difference. Cheap
 * (a few dozen hashes) and it converts a silent false pass into a hard stop.
 */
function assertRendererMatchesRepo(pc) {
  const repoR = path.join(REPO, 'VoiceMathTutorPC', 'renderer');
  const buildR = path.join(pc, 'renderer');
  if (!fs.existsSync(buildR)) return [`no renderer/ in ${pc}`];

  const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory()
      ? walk(path.join(dir, e.name), `${base}${e.name}/`)
      : [base + e.name]));

  const drift = [];
  for (const rel of walk(repoR)) {
    const b = path.join(buildR, rel);
    if (!fs.existsSync(b)) drift.push(`missing from the build: ${rel}`);
    else if (!fs.readFileSync(path.join(repoR, rel)).equals(fs.readFileSync(b))) {
      drift.push(`differs: ${rel}`);
    }
  }
  return drift;
}

if (path.resolve(PC) !== path.resolve(REPO, 'VoiceMathTutorPC')) {
  const drift = assertRendererMatchesRepo(PC);
  if (drift.length) {
    console.error(`\n  STALE BUILD — ${PC}\n`);
    console.error('  The harnesses load renderer/ pages from there, so these files are NOT');
    console.error('  what would be tested. Copy them across before trusting any result:\n');
    for (const d of drift.slice(0, 20)) console.error(`    ${d}`);
    if (drift.length > 20) console.error(`    …and ${drift.length - 20} more`);
    console.error(`\n  robocopy "${path.join(REPO, 'VoiceMathTutorPC', 'renderer')}" \\`);
    console.error(`           "${path.join(PC, 'renderer')}" /MIR\n`);
    process.exit(1);
  }
  console.log(`  ! renderer matches the repo; running against ${PC} for its node_modules.\n`);
}

module.exports = {
  REPO,
  PC,
  PRELOAD: path.join(PC, 'preload.js'),
  MAIN: path.join(PC, 'main.js'),
  RENDERER: path.join(REPO, 'VoiceMathTutorPC', 'renderer'),
  ASSETS: path.join(REPO, 'VoiceMathTutor', 'app', 'src', 'main', 'assets', 'formulas'),
};
