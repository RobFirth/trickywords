// npm run sync -- <path to a checkout of the source repo>
// Copies the game files and pictures listed in upstream.json ("copy") from a clean checkout of the source,
// then records the source commit and a SHA-256 for every copied file in upstream.json, and rewrites the
// summary in UPSTREAM.md. data/words.js is not copied (its labels differ by design); its fingerprint is
// compared with the source's, and a difference is reported for a hand edit.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, sha256, readLock, writeLock, expand, dataFingerprint } = require('./upstream-lib');

const die = msg => { console.error(`sync: ${msg}`); process.exit(1); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

(async () => {
  const arg = process.argv[2];
  if (!arg) die('give the path to a checkout of the source repo: npm run sync -- <path>');
  const checkout = path.resolve(process.env.INIT_CWD || process.cwd(), arg);
  let top;
  try { top = git(checkout, 'rev-parse', '--show-toplevel'); } catch (e) { die(`${checkout} is not a git checkout`); }
  if (git(top, 'status', '--porcelain')) die(`${top} has uncommitted changes; commit or stash them first`);

  const lock = readLock();
  const srcDir = path.join(top, lock.source.dir);
  if (!fs.existsSync(srcDir)) die(`${lock.source.dir} not found in ${top}`);
  const commit = git(top, 'rev-parse', 'HEAD');
  const date = git(top, 'log', '-1', '--format=%cs');
  const branch = git(top, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== lock.source.branch) console.warn(`sync: note: the checkout is on ${branch}, not ${lock.source.branch}`);

  // Copy, and remove local files a pattern covers that the source no longer has
  const want = expand(lock.copy, srcDir);
  if (!want.length) die('no files matched the "copy" patterns in the source');
  const before = expand(lock.copy, ROOT);
  const report = { added: [], changed: [], removed: [], same: 0 };
  const files = {};
  for (const f of want) {
    const data = fs.readFileSync(path.join(srcDir, f));
    const dest = path.join(ROOT, f);
    const old = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
    if (!old) report.added.push(f); else if (Buffer.compare(old, data)) report.changed.push(f); else report.same++;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    files[f] = sha256(data);
  }
  for (const f of before.filter(f => !want.includes(f))) { fs.unlinkSync(path.join(ROOT, f)); report.removed.push(f); }

  // Word lists: compare, never copy
  const srcPrint = await dataFingerprint(path.join(srcDir, 'data', 'words.js'));
  const ourPrint = await dataFingerprint(path.join(ROOT, 'data', 'words.js'));

  lock.source.commit = commit;
  lock.source.date = date;
  lock.files = files;
  lock.data = { fingerprint: srcPrint };
  writeLock(lock);
  writeSummary(lock);

  console.log(`sync: source ${commit.slice(0, 7)} (${date}), ${want.length} files: ${report.same} unchanged`
    + `, ${report.added.length} added, ${report.changed.length} changed, ${report.removed.length} removed`);
  for (const k of ['added', 'changed', 'removed']) for (const f of report[k]) console.log(`  ${k}: ${f}`);
  console.log('sync: upstream.json and UPSTREAM.md updated');
  if (srcPrint !== ourPrint) {
    console.error('sync: data/words.js differs from the source (word lists, ids, colours or Match sets).'
      + ' Bring the change across by hand, keeping this site\'s labels, then run npm test.');
    process.exit(1);
  }
})().catch(e => die(e.stack || e.message));

// The generated part of UPSTREAM.md, between the two markers
function writeSummary(lock) {
  const file = path.join(ROOT, 'UPSTREAM.md');
  const START = '<!-- sync:start -->', END = '<!-- sync:end -->';
  const md = fs.readFileSync(file, 'utf8');
  const a = md.indexOf(START), b = md.indexOf(END);
  if (a < 0 || b < a) die('UPSTREAM.md has no sync markers');
  const rows = Object.entries(lock.files).map(([f, h]) => `| \`${f}\` | \`${h}\` |`);
  const body = [
    START,
    '_Written by `npm run sync`; do not edit by hand._',
    '',
    `- **Source**: \`${lock.source.repo}\`, \`${lock.source.dir}/\`, commit \`${lock.source.commit.slice(0, 7)}\` (${lock.source.date})`,
    `- **Copied files**: ${rows.length}, each byte-for-byte`,
    `- **Data fingerprint**: \`${lock.data.fingerprint}\``,
    '',
    '| File | sha256 |',
    '|---|---|',
    ...rows,
    END
  ].join('\n');
  fs.writeFileSync(file, md.slice(0, a) + body + md.slice(b + END.length));
}
