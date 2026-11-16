// Shared by sync-upstream.js and check-upstream.js: what is copied from upstream, and how it is checked.
// upstream.json (repo root) is both the config ("source", "copy") and the lock file ("files", "data").
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const LOCK = path.join(ROOT, 'upstream.json');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readLock = () => JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const writeLock = lock => fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');

// Expand the "copy" patterns against a folder. Only a "*" in the last path part is supported, e.g. img/words/*.svg.
function expand(patterns, base) {
  const out = [];
  for (const pat of patterns) {
    if (!pat.includes('*')) { if (fs.existsSync(path.join(base, pat))) out.push(pat); continue; }
    const dir = path.posix.dirname(pat), glob = path.posix.basename(pat);
    const re = new RegExp('^' + glob.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    const abs = path.join(base, dir);
    if (!fs.existsSync(abs)) continue;
    out.push(...fs.readdirSync(abs).filter(f => re.test(f) && fs.statSync(path.join(abs, f)).isFile()).sort().map(f => `${dir}/${f}`));
  }
  return [...new Set(out)];
}

// The word-list fingerprint: everything in data/words.js that must match the source, but not the labels
// that differ by design (Flashcards mode and deck labels). Match sets are covered whole, labels included.
async function dataFingerprint(wordsFile) {
  const src = fs.readFileSync(wordsFile, 'utf8');
  const m = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const json = JSON.stringify({
    modes: m.flashModes.map(x => x.id),
    decks: m.flashDecks.map(({ label, ...d }) => d),
    matchSets: m.matchSets
  });
  return sha256(json);
}

// Compare the lock with a folder holding the copied files (this repo, or a source checkout's dir).
// Returns a list of problems; empty means everything matches.
function compareFiles(lock, base, label) {
  const problems = [];
  const want = Object.keys(lock.files).sort();
  const have = expand(lock.copy, base).sort();
  for (const f of want.filter(f => !have.includes(f))) problems.push(`${label}: ${f} is missing`);
  for (const f of have.filter(f => !want.includes(f))) problems.push(`${label}: ${f} is not in upstream.json`);
  for (const f of want.filter(f => have.includes(f))) {
    const h = sha256(fs.readFileSync(path.join(base, f)));
    if (h !== lock.files[f]) problems.push(`${label}: ${f} differs (sha256 ${h.slice(0, 12)}…, upstream.json ${lock.files[f].slice(0, 12)}…)`);
  }
  return problems;
}

module.exports = { ROOT, LOCK, sha256, readLock, writeLock, expand, dataFingerprint, compareFiles };
