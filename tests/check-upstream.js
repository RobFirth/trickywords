// node check-upstream.js [path to a checkout of the source repo]
// Fails (exit 1) if any copied file differs from upstream.json, here or (given a checkout) in the source,
// or if the data fingerprint of data/words.js differs. Used by npm test and the "Upstream check" workflow.
const path = require('path');
const { ROOT, readLock, compareFiles, dataFingerprint } = require('./upstream-lib');

async function check(checkout) {
  const lock = readLock();
  const problems = compareFiles(lock, ROOT, 'this repo');
  const ours = await dataFingerprint(path.join(ROOT, 'data', 'words.js'));
  if (ours !== lock.data.fingerprint) problems.push(`this repo: data/words.js fingerprint ${ours.slice(0, 12)}… is not upstream.json's ${lock.data.fingerprint.slice(0, 12)}…`);
  if (checkout) {
    const src = path.join(path.resolve(checkout), lock.source.dir);
    problems.push(...compareFiles(lock, src, 'source'));
    let theirs = null;
    try { theirs = await dataFingerprint(path.join(src, 'data', 'words.js')); } catch (e) { problems.push(`source: cannot read data/words.js (${e.message})`); }
    if (theirs && theirs !== lock.data.fingerprint) problems.push(`source: data/words.js fingerprint ${theirs.slice(0, 12)}… is not upstream.json's ${lock.data.fingerprint.slice(0, 12)}…`);
  }
  return { lock, problems };
}
module.exports = { check };

if (require.main === module) {
  check(process.argv[2]).then(({ lock, problems }) => {
    if (problems.length) {
      console.error(`Upstream check failed (${problems.length}):\n` + problems.map(p => `  - ${p}`).join('\n'));
      console.error('To bring the copy up to date: cd tests && npm run sync -- <path to a clean checkout of the source>');
      process.exit(1);
    }
    console.log(`Upstream check passed: ${Object.keys(lock.files).length} files and the data fingerprint match${process.argv[2] ? ' the source' : ''} (recorded commit ${lock.source.commit.slice(0, 7)}).`);
  }).catch(e => { console.error(e); process.exit(2); });
}
