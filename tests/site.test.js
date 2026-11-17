// Headless checks for the Tricky Words site. Serves the repo itself (at / and at a sub-path) and drives Chrome.
// Run: npm test   (CHROME_PATH for another Chrome; UPSTREAM_SRC=<path to a checkout of the source repo> to compare with it too)
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
const { readLock, expand, sha256 } = require('./upstream-lib');
const { check } = require('./check-upstream');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FEEDBACK = 'https://github.com/RobFirth/trickywords/issues';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, f));
fs.mkdirSync(OUT, { recursive: true });

// ── A static server: the repo at / and again under /some/sub/path/. Types as GitHub Pages serves them. ──
const SUB = '/some/sub/path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const served = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith(SUB + '/')) p = p.slice(SUB.length);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  served.push(p);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}tests${path.sep}`) || file.includes(`${path.sep}.git`)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// Words assembled so this file does not itself contain them
const BANNED = [['fire', 'base'], ['google', 'apis'], ['gst', 'atic'], ['no', 'index'], ['/fam', 'ily'], ['/ki', 'ds']].map(a => a.join(''));
// Files that name the source repo's folder: the upstream record, by design
const SCAN_EXEMPT = ['UPSTREAM.md', 'upstream.json'];

// The spec's text, word for word
const ABOUT_1 = 'Word games for early readers. Tricky words are flashcards for the words children learn by sight in Reception, Year 1 and Year 2. The Year 1 and Year 2 words are the common exception words from the national curriculum. Picture match is a memory game with first words to sound out.';
const ABOUT_2 = 'This site has no accounts, no adverts and no tracking. Your settings are saved only on this device. Nothing you do here is sent to us or anyone else.';
const ABOUT_3 = 'To keep it on your home screen, choose "Install" or "Add to Home Screen" from your browser\'s menu. It still needs the internet to work.';
const CREDITS = ['Code: MIT licence.', 'Font: Andika by SIL Global, under the SIL Open Font Licence.', 'Some pictures are from Twemoji, © Twitter, Inc and other contributors, CC-BY 4.0. Picture credits.', 'Feedback'];
const HOW = ['Choose one or more sets of sounds, and how many pairs.', 'Tap two cards. A picture and its word make a pair.', 'If they don\'t match, they turn back after a moment.', 'Find every pair to finish.'];
const HOW_P = ['The sets follow the order sounds are usually taught. Each set only uses sounds from that set and the ones before it.',
  'For grown-ups: press and hold the cog on the home screen for two seconds to turn the sound and the timer on or off.'];
const SIZES = [[600, 1024], [1024, 600], [1280, 800], [800, 1280], [390, 844], [320, 568]];

(async () => {
  // ══ Files ══
  const lock = readLock();
  const { problems } = await check(process.env.UPSTREAM_SRC);
  ok(`files: every copied file (${Object.keys(lock.files).length}) and the data fingerprint match upstream.json${process.env.UPSTREAM_SRC ? ' and the source' : ''}`, problems.length === 0, problems);
  ok('files: upstream.json copies both games, the pictures, icons and credits', ['games/flashcards.js', 'games/match.js', 'img/card-back.svg', 'img/match.svg', 'img/flashcards.svg', 'img/CREDITS.md']
    .every(f => lock.files[f]) && Object.keys(lock.files).filter(f => f.startsWith('img/words/')).length === 38);
  ok('files: upstream.json records a full source commit', /^[0-9a-f]{40}$/.test(lock.source.commit));
  const upstreamMd = read('UPSTREAM.md').toString();
  ok('files: the UPSTREAM.md summary matches upstream.json', upstreamMd.includes(`commit \`${lock.source.commit.slice(0, 7)}\``) && upstreamMd.includes(`\`${lock.data.fingerprint}\``)
    && Object.entries(lock.files).every(([f, h]) => upstreamMd.includes(`| \`${f}\` | \`${h}\` |`)));
  ok('files: LICENSE.txt is identical to LICENSE', Buffer.compare(read('LICENSE'), read('LICENSE.txt')) === 0);
  ok('files: img/icon.svg and favicon.svg are the Flashcards icon', Buffer.compare(read('img/icon.svg'), read('img/flashcards.svg')) === 0 && Buffer.compare(read('img/favicon.svg'), read('img/icon.svg')) === 0);

  // Every file in the repo (tracked or not yet committed, minus ignored), text only
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && fs.existsSync(path.join(ROOT, f)));
  const text = files.filter(f => !SCAN_EXEMPT.includes(f) && !/\.(png|woff2)$/.test(f));
  const hits = [];
  for (const f of text) { const s = read(f).toString().toLowerCase(); for (const w of BANNED) if (s.includes(w)) hits.push(`${f}: ${w}`); }
  ok(`files: no banned words in ${text.length} files outside ${SCAN_EXEMPT.join(' and ')}`, text.length > 50 && hits.length === 0, hits);
  ok('files: no service worker', !files.some(f => /(^|\/)(sw|service-?worker)\.js$/i.test(f)) && text.filter(f => !f.startsWith('tests/')).every(f => !read(f).toString().includes('serviceWorker')));
  ok('files: the spec files are all there', ['index.html', 'trickywords.css', 'shell.js', 'games/flashcards.js', 'games/match.js', 'data/words.js', 'fonts/Andika-Regular.woff2', 'fonts/Andika-Bold.woff2', 'fonts/OFL.txt',
    'img/icon.svg', 'img/favicon.svg', 'img/CREDITS.md', 'img/card-back.svg', 'manifest.webmanifest', 'UPSTREAM.md', 'upstream.json', '.nojekyll', 'LICENSE', 'LICENSE.txt', 'README.md',
    'tests/sync-upstream.js', 'tests/check-upstream.js', '.github/workflows/upstream-check.yml'].every(f => fs.existsSync(path.join(ROOT, f))));
  ok('files: .nojekyll is empty, LICENSE is MIT', fs.statSync(path.join(ROOT, '.nojekyll')).size === 0 && read('LICENSE').toString().startsWith('MIT License'));
  ok('files: the OFL is the SIL Open Font License 1.1', /SIL OPEN FONT LICENSE Version 1\.1/.test(read('fonts/OFL.txt').toString()));
  ok('files: fonts are woff2', ['Regular', 'Bold'].every(w => read(`fonts/Andika-${w}.woff2`).subarray(0, 4).toString() === 'wOF2'));
  ok('files: CREDITS.md credits Twemoji under CC-BY 4.0', /Twemoji[\s\S]*CC-BY 4\.0/.test(read('img/CREDITS.md').toString()));

  // Match data: every word has its picture, and every picture is used
  const words = await import('data:text/javascript;base64,' + read('data/words.js').toString('base64'));
  const matchWords = [...new Set(words.matchSets.flatMap(s => s.words))];
  const pics = expand(['img/words/*.svg'], ROOT);
  ok('data: every Match word has a picture, and every picture is a Match word', matchWords.every(w => fs.existsSync(path.join(ROOT, words.pictureFor(w))))
    && pics.length === matchWords.length && pics.every(f => matchWords.includes(path.basename(f, '.svg'))), [matchWords.length, pics.length]);
  ok('data: four Match sets with the source labels', words.matchSets.map(s => s.label).join('|') === 's a t p i n|m d g o c k ck|e u r h b f l|ff ll ss');

  // The upstream workflow: weekly and on demand, read-only, actions pinned to commit SHAs
  const wf = read('.github/workflows/upstream-check.yml').toString();
  const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
  ok('workflow: weekly schedule and workflow_dispatch', /schedule:\s*\n\s*- cron:/.test(wf) && /workflow_dispatch/.test(wf));
  ok('workflow: read-only token', /permissions:\s*\n\s*contents: read/.test(wf) && !/write/.test(wf));
  ok('workflow: every action pinned to a commit SHA', uses.length > 0 && uses.every(u => /@[0-9a-f]{40}$/.test(u)), uses);
  ok('workflow: runs check-upstream against the source', /check-upstream\.js/.test(wf));

  const manifest = JSON.parse(read('manifest.webmanifest'));
  const pngSize = f => { const b = read(f); return b.toString('ascii', 1, 4) === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : null; };
  ok('manifest: name, standalone, colours, relative start', manifest.name === 'Tricky Words' && manifest.display === 'standalone' && manifest.background_color === '#FFF8E7' && manifest.start_url === './' && manifest.scope === './');
  ok('manifest: every icon exists at its stated size', manifest.icons.every(i => fs.existsSync(path.join(ROOT, i.src)) && (i.type !== 'image/png' || pngSize(i.src) === i.sizes)) && manifest.icons.some(i => i.purpose === 'maskable'));
  ok('icons: favicon 32 and apple-touch 180', pngSize('img/favicon-32.png') === '32x32' && pngSize('img/apple-touch-icon.png') === '180x180');
  const absolute = text.filter(f => /\.(html|css|js|webmanifest)$/.test(f) && !f.startsWith('tests/')).flatMap(f => {
    const s = read(f).toString();
    return [...s.matchAll(/(?:href|src)=["'](\/[^"']*)|url\(['"]?(\/[^)'"]*)|"(?:src|start_url|scope)":\s*"(\/[^"]*)"|from\s+['"](\/[^'"]*)|\.src = ['"`](\/[^'"`]*)/g)].map(m => `${f}: ${m.slice(1).find(Boolean)}`);
  });
  ok('files: relative URLs only', absolute.length === 0, absolute);
  const WEIGHT = files.filter(f => !f.startsWith('tests/') && !f.startsWith('.github/')).reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
  ok(`files: the site is under 1 MB (${Math.round(WEIGHT / 1024)} KB)`, WEIGHT < 1024 * 1024);

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const ORIGIN = `http://127.0.0.1:${server.address().port}`;
  const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
  const allErrors = [], allOffSite = [];

  // One fresh page per scenario. Every request is logged; anything off-site is blocked and recorded.
  // speech: 'ok' | 'missing'; storage: true | false (localStorage throws); settings: a value to store first
  async function open({ w = 1000, h = 800, at = '/', speech = 'ok', storage = true, reduced = false, settings } = {}) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    p.ctx = ctx;
    await p.setViewport({ width: w, height: h });
    if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    p.errors = []; p.requests = []; p.blocked = [];
    p.on('console', m => { if (m.type() === 'error' && !(m.location().url || '').endsWith('/favicon.ico')) p.errors.push(m.text()); });
    p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
    // A text page (the licence) makes the browser ask for /favicon.ico, which GitHub Pages also answers with 404
    p.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) p.errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); p.requests.push(u);
      if (u.startsWith(ORIGIN + '/') || u.startsWith('data:')) return r.continue();
      p.blocked.push(u); r.abort(); });
    await p.evaluateOnNewDocument((speech, storage, settings) => {
      window.__spoken = [];
      if (settings !== undefined && !sessionStorage.getItem('__seeded')) { localStorage.setItem('trickywords-settings', settings); sessionStorage.setItem('__seeded', '1'); }
      if (!storage) Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage blocked'); } });
      const def = v => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: v });
      if (speech === 'ok') {
        const voices = [{ lang: 'en-GB', name: 'GB' }];
        def({ getVoices: () => voices, cancel() {}, addEventListener() {}, speak: u => window.__spoken.push(u.text) });
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      } else { def(undefined); window.SpeechSynthesisUtterance = undefined; }
    }, speech, storage, settings);
    await p.goto(ORIGIN + at, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(150);
    return p;
  }
  const offSite = p => p.requests.filter(u => !u.startsWith(ORIGIN + '/') && !u.startsWith('data:'));
  async function done(p) { allErrors.push(...p.errors); allOffSite.push(...offSite(p)); await p.close(); await p.ctx.close(); }
  const helpers = p => ({
    vis: sel => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel),
    txt: sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()),
    click: async (sel, ms = 40) => { await p.$eval(sel, e => e.click()); await sleep(ms); }
  });
  const game = async (p, id) => { await p.$eval(`.tile[data-game="${id}"]`, e => e.click()); await sleep(80); };
  const home = async p => { await p.$eval('#btn-home', e => e.click()); await sleep(60); };
  const onMenu = p => p.evaluate(() => !document.getElementById('view-menu').classList.contains('hidden') && document.getElementById('view-game').classList.contains('hidden')
    && document.querySelectorAll('.tile').length === 2 && document.getElementById('game-root').children.length === 0);
  const deckTiles = p => p.$$eval('.deck-tile', ts => ts.map(t => `${t.dataset.deck}:${t.querySelector('.deck-name').textContent}:${t.querySelector('.deck-count').textContent}`).join('|'));
  async function hold(p, sel, ms = 2100) {
    await p.$eval(sel, e => e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))); await sleep(ms);
    await p.$eval(sel, e => e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); await sleep(40);
  }
  const cornerOpen = p => p.evaluate(() => !document.getElementById('corner').classList.contains('hidden'));
  const switches = p => p.evaluate(() => ['set-sound', 'set-timer'].map(id => document.getElementById(id).getAttribute('aria-pressed')).join());
  async function runThrough(p) {
    const seen = [];
    for (let k = 0; k < 100 && await p.$('.flash-card'); k++) { seen.push(await p.$eval('.flash-word', e => e.textContent)); await p.$eval('.flash-next', e => e.click()); await sleep(12); }
    return seen;
  }
  // Match: choose exactly one set (or 'mix'), a size, and play
  const chooseSet = (p, id) => p.evaluate(id => {
    const t = s => document.querySelector(`.set-tile[data-set="${s}"]`);
    if (id === 'mix') return t('mix').click();
    if (t(id).getAttribute('aria-pressed') !== 'true') t(id).click();
    document.querySelectorAll('.set-tile:not(.mix-tile)').forEach(x => { if (x.dataset.set !== id && x.getAttribute('aria-pressed') === 'true') x.click(); });
  }, id);
  const sizeButtons = p => p.$$eval('.size-btn', bs => bs.map(x => +x.dataset.size));
  async function solve(p) {
    const cards = await p.$$eval('.card', cs => cs.map(c => ({ i: c.dataset.index, w: c.dataset.word })));
    for (const w of [...new Set(cards.map(c => c.w))]) for (const c of cards.filter(c => c.w === w)) await p.$eval(`.card[data-index="${c.i}"]`, e => e.click());
    return cards;
  }
  const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('trickywords-settings')));
  const layoutProblems = p => p.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [];
    const se = document.scrollingElement;
    if (se.scrollWidth > W + 1 || se.scrollHeight > H + 1) bad.push(`document ${se.scrollWidth}x${se.scrollHeight}`);
    const v = [...document.querySelectorAll('.view')].find(x => !x.classList.contains('hidden'));
    if (v.scrollHeight > v.clientHeight + 1 || v.scrollWidth > v.clientWidth + 1) bad.push(`view overflows ${v.scrollWidth}x${v.scrollHeight}`);
    const corner = document.getElementById('corner');
    [...v.querySelectorAll('*'), ...(corner.classList.contains('hidden') ? [] : corner.querySelectorAll('*'))].forEach(e => {
      if (e.closest('.flash-words, .flash-info-body, .confetti, noscript')) return; // these scroll, fall or never show
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${e.tagName}.${typeof e.className === 'string' ? e.className : ''} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    });
    document.querySelectorAll('.mode-btn, .deck-name').forEach(e => { if (e.getClientRects().length && e.scrollWidth > e.clientWidth + 1) bad.push(`"${e.textContent}" overflows`); });
    // Text clear of the buttons beside it: the Flashcards heading (Home, "i"), the Match count (the timer)
    const textBox = sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
    const box = sel => { const e = document.querySelector(sel); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
    const mode = textBox('.flash-picker .flash-mode'), info = box('.flash-picker .flash-info-btn'), homeB = box('#btn-home');
    if (mode && info && mode.right > info.left) bad.push(`heading text under "i" by ${Math.round(mode.right - info.left)}px`);
    if (mode && homeB && mode.left < homeB.right) bad.push('heading text under Home');
    const count = textBox('.progress-text'), timer = box('.match-timer'), track = box('.progress-track');
    if (count && timer && count.right > timer.left) bad.push(`pairs count under the timer by ${Math.round(count.right - timer.left)}px`);
    if (track && track.width < 40) bad.push(`progress track only ${Math.round(track.width)}px`);
    // The menu: tiles clear of the footer, heading clear of "i"
    if (v.id === 'view-menu') {
      const f = document.querySelector('.menu-footer').getBoundingClientRect();
      document.querySelectorAll('.tile').forEach(t => { if (t.getBoundingClientRect().bottom + 6 > f.top) bad.push('tile reaches the footer'); });
      const hRange = document.createRange(); hRange.selectNodeContents(document.querySelector('.hello'));
      if (hRange.getBoundingClientRect().right > document.getElementById('btn-info').getBoundingClientRect().left) bad.push('heading under "i"');
    }
    return bad.slice(0, 6);
  });
  const smallTargets = p => p.evaluate(() => {
    const v = [...document.querySelectorAll('.view')].find(x => !x.classList.contains('hidden'));
    const corner = document.getElementById('corner');
    return [...v.querySelectorAll('button, summary'), ...(corner.classList.contains('hidden') ? [] : corner.querySelectorAll('button'))]
      .filter(e => e.getClientRects().length && !e.classList.contains('footer-link')).map(e => { const r = e.getBoundingClientRect(); return { t: e.className || e.id || e.tagName, w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.w < 64 || x.h < 64);
  });
  const fits = async (p, name) => { const l = await layoutProblems(p), s = await smallTargets(p); ok(name, l.length === 0 && s.length === 0, [l, s]); };
  const aboutOf = (p, sel) => p.$eval(sel, d => ({ summary: d.querySelector('summary').textContent, paras: [...d.querySelectorAll('p')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
    bold: [...d.querySelectorAll('strong')].map(x => x.textContent), links: [...d.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]), html: d.innerHTML }));

  // ══ Network blocked: everything off-site is refused, and the menu still shows ══
  let p = await open({ w: 1280, h: 800 }); let h = helpers(p);
  ok('menu: the start screen, heading "Tricky Words"', await onMenu(p) && (await h.txt('h1')) === 'Tricky Words' && await p.$$eval('h1', x => x.length) === 1);
  ok('menu: two tiles, labelled by the shell, each with its icon', await p.$$eval('.tile', ts => ts.map(t => `${t.dataset.game}:${t.textContent.trim()}:${t.querySelector('img').getAttribute('src')}`).join('|'))
    === 'flashcards:Tricky words:img/flashcards.svg|match:Picture match:img/match.svg');
  ok('menu: both icons load', await p.$$eval('.tile img', is => is.every(i => i.complete && i.naturalWidth > 0)));
  ok('menu: "i" left of the cog, footer at the bottom', await h.vis('#btn-info') && await h.vis('#btn-cog') && await h.vis('.menu-footer')
    && await p.evaluate(() => document.getElementById('btn-info').getBoundingClientRect().right <= document.getElementById('btn-cog').getBoundingClientRect().left));
  ok('footer: "MIT licence · Credits", 14 px, soft ink, centred', (await h.txt('.menu-footer')) === 'MIT licence · Credits' && await p.$eval('.menu-footer', f => {
    const cs = getComputedStyle(f); return cs.fontSize === '14px' && cs.color === 'rgb(59, 71, 102)' && cs.textAlign === 'center'; }));
  ok('footer: same colour and size for both links', await p.$$eval('.menu-footer a, .menu-footer button', es => es.length === 2 && es.every(e => getComputedStyle(e).color === 'rgb(59, 71, 102)' && getComputedStyle(e).fontSize === '14px')));
  ok('footer: one line', await p.$eval('.menu-footer', f => f.getBoundingClientRect().height < 28));
  ok('blocked network: Andika 400 and 700 load from the site', await p.evaluate(() => document.fonts.check('400 20px Andika') && document.fonts.check('700 20px Andika'))
    && p.requests.some(u => u.endsWith('/fonts/Andika-Regular.woff2')) && p.requests.some(u => u.endsWith('/fonts/Andika-Bold.woff2')));
  ok('blocked network: the menu uses Andika', await p.$eval('.tile', e => getComputedStyle(e).fontFamily.startsWith('Andika')));
  ok('blocked network: nothing tried to leave the site', p.blocked.length === 0, p.blocked);
  ok('head: title, description naming both games, en-GB, viewport, manifest, no robots meta', await p.evaluate(() => document.title === 'Tricky Words' && document.documentElement.lang === 'en-GB'
    && /Reception, Year 1 and Year 2/.test(document.querySelector('meta[name=description]').content) && /picture match/i.test(document.querySelector('meta[name=description]').content)
    && !!document.querySelector('meta[name=viewport]') && document.querySelector('link[rel=manifest]').getAttribute('href') === 'manifest.webmanifest' && !document.querySelector('meta[name=robots]')));
  ok('text: no "free" and no word about other schools\' lists, in the page, manifest or About', await p.evaluate(async () => {
    const m = await (await fetch('manifest.webmanifest')).text();
    return ![document.querySelector('meta[name=description]').content, m, document.body.innerHTML].some(t => /\bfree\b|vary between schools/i.test(t)); }));
  ok('head: no scripts but the shell module', await p.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).join() === 'shell.js'));
  ok('privacy: no cookies', (await p.evaluate(() => document.cookie)) === '' && (await p.cookies()).length === 0);
  ok('page: no console errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Each game mounts, and Home returns to the menu from every screen ══
  p = await open({ w: 1280, h: 800, reduced: true }); h = helpers(p);
  await game(p, 'flashcards');
  ok('flashcards: mounts at the deck picker, Home shown there (version 1 hid it)', await h.vis('.flash-picker') && (await h.txt('.flash-mode')) === 'Reception' && await h.vis('#btn-home'));
  ok('flashcards: Home is labelled Home', await p.$eval('#btn-home', e => e.getAttribute('aria-label') === 'Home'));
  ok('flashcards: picker heading clears Home', await p.evaluate(() => document.querySelector('.flash-mode').getBoundingClientRect().left >= document.getElementById('btn-home').getBoundingClientRect().right));
  ok('footer: not on the game screen', !(await h.vis('.menu-footer')) && !(await h.vis('#btn-info')) && !(await h.vis('#btn-cog')));
  await home(p);
  ok('Home: from the Flashcards picker to the menu', await onMenu(p) && await h.vis('.menu-footer'));
  await game(p, 'flashcards'); await h.click('.deck-tile[data-deck="yellow"]', 60); await h.click('.flash-next');
  ok('flashcards: card screen', await h.vis('.flash-card') && !(await h.vis('.menu-footer')));
  await home(p);
  ok('Home: from a Flashcards card to the menu', await onMenu(p));
  await game(p, 'flashcards');
  ok('flashcards: back at the picker, last deck marked', (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'yellow');
  await h.click('.deck-tile[data-deck="yellow"]', 60); await runThrough(p);
  ok('flashcards: end screen', await h.vis('.flash-end') && !(await h.vis('.menu-footer')));
  await home(p);
  ok('Home: from the Flashcards end screen to the menu', await onMenu(p));
  ok('Home: keys afterwards do nothing and raise no errors', (await p.keyboard.press('ArrowRight'), await sleep(30), await onMenu(p)) && p.errors.length === 0, p.errors);
  await game(p, 'match');
  ok('match: mounts at its setup, Home shown', await h.vis('.match-setup') && await h.vis('#btn-home') && !(await h.vis('.menu-footer')));
  ok('match: four sets and mix, set 1 chosen, 6 pairs', (await p.$$eval('.set-tile', ts => ts.map(t => `${t.dataset.set}:${t.getAttribute('aria-pressed')}`).join())) === 'set1:true,set2:false,set3:false,set4:false,mix:false'
    && (await sizeButtons(p)).join() === '6');
  await home(p);
  ok('Home: from the Match setup to the menu', await onMenu(p));
  await game(p, 'match'); await h.click('.match-start', 80);
  ok('match: board of 12 cards, all face down', await p.$$eval('.card', cs => cs.length === 12 && cs.every(c => !c.classList.contains('up'))) && !(await h.vis('.menu-footer')));
  const firstTwo = await p.$$eval('.card', cs => { const a = cs[0]; const bIdx = cs.findIndex(c => c.dataset.word !== a.dataset.word); return [0, bIdx]; });
  for (const i of firstTwo) await h.click(`.card[data-index="${i}"]`, 10);
  ok('match: a miss shows both cards', await p.$$eval('.card.up', cs => cs.length) === 2);
  await sleep(1900);
  ok('match: after a moment they turn back', await p.$$eval('.card.up', cs => cs.length) === 0);
  await h.click(`.card[data-index="${firstTwo[0]}"]`, 10);
  await home(p);
  ok('Home: from the Match board mid-game to the menu', await onMenu(p));
  await sleep(1700);
  ok('Home: no timers left running after leaving the board', p.errors.length === 0 && await onMenu(p), p.errors);
  await game(p, 'match'); await h.click('.match-start', 80); await solve(p); await sleep(400);
  ok('match: finish screen', await h.vis('.match-finish') && (await h.txt('.finish-card h2')) === 'You found all 6 pairs!');
  await home(p);
  ok('Home: from the Match finish screen to the menu', await onMenu(p));
  ok('home run: no console errors, nothing off-site', p.errors.length === 0 && offSite(p).length === 0, [p.errors, offSite(p)]);
  await done(p);

  // ══ Grown-ups corner: 2 s hold only; Sound and Timer persist and take effect on the next game ══
  p = await open({ w: 1280, h: 800, reduced: true }); h = helpers(p);
  await h.click('#btn-cog');
  ok('corner: a tap on the cog does nothing', !(await cornerOpen(p)));
  await hold(p, '#btn-cog', 1200);
  ok('corner: a 1.2 s hold does nothing', !(await cornerOpen(p)));
  await p.$eval('#btn-cog', e => e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))); await sleep(500);
  ok('corner: the ring fills while holding', await p.$eval('#btn-cog', e => e.classList.contains('holding')));
  await p.$eval('#btn-cog', e => e.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))); await sleep(1800);
  ok('corner: sliding off the cog cancels the hold', !(await cornerOpen(p)) && !(await p.$eval('#btn-cog', e => e.classList.contains('holding'))));
  await hold(p, '#btn-cog');
  ok('corner: opens after a 2 s hold', await cornerOpen(p));
  ok('corner: Sound and Timer (both on by default), and Done; nothing else', (await p.$$eval('.corner-panel button', bs => bs.map(x => x.textContent.trim()).join('|'))) === 'Sound|Timer|Done'
    && (await switches(p)) === 'true,true' && (await p.$$eval('.corner-panel a', a => a.length)) === 0);
  ok('corner: focus on Done', await p.evaluate(() => document.activeElement.id === 'corner-close'));
  await h.click('#set-sound'); await h.click('#set-timer');
  ok('corner: both switched off', (await switches(p)) === 'false,false');
  let s = await stored(p);
  ok('settings: sound and timer saved', s.sound === false && s.timer === false, s);
  await h.click('#corner-close');
  ok('corner: Done closes it, focus back on the cog', !(await cornerOpen(p)) && await p.evaluate(() => document.activeElement.id === 'btn-cog'));
  await p.reload({ waitUntil: 'load' }); await sleep(150);
  await hold(p, '#btn-cog');
  ok('corner: the switches persist across a reload', (await switches(p)) === 'false,false');
  await p.keyboard.press('Escape'); await sleep(30);
  ok('corner: Escape closes it', !(await cornerOpen(p)));
  // Sound off and Timer off
  await game(p, 'match'); await chooseSet(p, 'mix'); await h.click('.size-btn[data-size="10"]'); await h.click('.match-start', 80);
  ok('timer off: Match shows no timer', !(await p.$('.match-timer')));
  await solve(p); await sleep(400);
  ok('sound off: a whole Match game says nothing', (await p.evaluate(() => __spoken.length)) === 0 && await h.vis('.match-finish'));
  ok('timer off: no time on the finish card', !(await p.$('.finish-time')));
  await home(p); await game(p, 'flashcards'); await h.click('.deck-tile[data-deck="purple"]', 60);
  ok('sound off: Flashcards hides the speaker', !(await p.$('.flash-speak')) && await h.vis('.flash-card'));
  await home(p);
  // Switched on again: the next game picks it up
  await hold(p, '#btn-cog'); await h.click('#set-sound'); await h.click('#set-timer'); await h.click('#corner-close');
  await game(p, 'match'); await h.click('.match-start', 80);
  ok('timer on: Match shows a timer', await h.vis('.match-timer'));
  const solved = await solve(p); await sleep(400);
  ok('sound on: Match says each word as its pair is found', (await p.evaluate(() => __spoken.join())) === [...new Set(solved.map(c => c.w))].join());
  ok('timer on: time on the finish card', /^Time \d+:\d\d$/.test(await h.txt('.finish-time')));
  await home(p); await game(p, 'flashcards'); await h.click('.deck-tile[data-deck="purple"]', 60);
  ok('sound on: Flashcards shows the speaker, which says the word', await h.vis('.flash-speak') && (await h.click('.flash-speak'), (await p.evaluate(() => __spoken.pop())) === await p.$eval('.flash-word', e => e.textContent)));
  s = await stored(p);
  ok('settings: one key, the version 2 shape', JSON.stringify(Object.keys(s)) === '["sound","timer","games"]' && s.sound === true && s.timer === true
    && JSON.stringify(s.games.match) === '{"sets":["set1","set2","set3","set4"],"size":10}' && s.games.flashcards.deck === 'purple', s);
  ok('settings: nothing else in storage', await p.evaluate(() => Object.keys(localStorage).join() === 'trickywords-settings' && sessionStorage.length === 0));
  ok('corner run: no console errors, nothing off-site', p.errors.length === 0 && offSite(p).length === 0, [p.errors, offSite(p)]);
  await done(p);

  // ══ Saved version 1 settings still load ══
  const V1 = JSON.stringify({ sound: true, games: { flashcards: { mode: '1', deck: 'y1t2', focus: { r: [], 1: ['said', 'friend'], 2: [] }, rosettes: ['y1t3'] } } });
  p = await open({ settings: V1 }); h = helpers(p);
  await hold(p, '#btn-cog');
  ok('version 1 settings: Sound on, Timer on by default', (await switches(p)) === 'true,true');
  await h.click('#corner-close'); await game(p, 'flashcards');
  ok('version 1 settings: Year 1 with its Focus deck, rosette and last deck', (await h.txt('.flash-mode')) === 'Year 1'
    && (await deckTiles(p)) === 'focus:Focus:2 words|y1t1:Tricky 1:11 words|y1t2:Tricky 2:12 words|y1t3:Tricky 3:11 words|y1t4:Tricky 4:11 words|all:All:45 words'
    && (await p.$$eval('.deck-tile .rosette', r => r.map(x => x.closest('.deck-tile').dataset.deck).join())) === 'y1t3'
    && (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'y1t2', await deckTiles(p));
  await h.click('.deck-tile[data-deck="y1t1"]', 60);
  ok('version 1 settings: the speaker shows', await h.vis('.flash-speak'));
  s = await stored(p);
  ok('version 1 settings: kept when saved again', s.games.flashcards.mode === '1' && JSON.stringify(s.games.flashcards.focus['1']) === '["said","friend"]' && s.games.flashcards.deck === 'y1t1', s);
  ok('version 1 settings: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ A full Match game with every set at every size; every picture loads ══
  p = await open({ w: 1280, h: 800, reduced: true }); h = helpers(p);
  ok('pictures: all 38 and the card back load as images', await p.evaluate(async list => (await Promise.all(list.map(u => new Promise(res => {
    const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; })))).every(Boolean), [...pics, 'img/card-back.svg']));
  await game(p, 'match');
  const plan = { set1: [6], set2: [6, 8, 10], set3: [6, 8, 10], set4: [6], mix: [6, 8, 10] };
  const games = [], gameProblems = [];
  for (const [set, sizes] of Object.entries(plan)) {
    await chooseSet(p, set); await sleep(20);
    const offered = await sizeButtons(p);
    if (offered.join() !== sizes.join()) gameProblems.push(`${set}: sizes ${offered}`);
    for (const n of offered) {
      await h.click(`.size-btn[data-size="${n}"]`, 10); await h.click('.match-start', 120);
      const pool = set === 'mix' ? matchWords : words.matchSets.find(x => x.id === set).words;
      const cards = await p.$$eval('.card', cs => cs.map(c => ({ w: c.dataset.word, k: c.dataset.kind })));
      const imgsOk = await p.$$eval('.card img', is => is.every(i => i.complete && i.naturalWidth > 0));
      if (cards.length !== 2 * n || !cards.every(c => pool.includes(c.w)) || new Set(cards.map(c => c.w + c.k)).size !== 2 * n || !imgsOk) gameProblems.push(`${set}/${n}: bad deal or picture`);
      await solve(p); await sleep(350);
      const fin = await p.evaluate(() => ({ h: (document.querySelector('.finish-card h2') || {}).textContent, matched: document.querySelectorAll('.card.matched').length, prog: document.querySelector('.progress-text').textContent }));
      if (fin.h !== `You found all ${n} pairs!` || fin.matched !== 2 * n || fin.prog !== `${n} / ${n}`) gameProblems.push(`${set}/${n}: ${JSON.stringify(fin)}`);
      games.push(`${set}/${n}`);
      await h.click('.finish-buttons .btn-teal', 60); // Choose another
    }
  }
  ok(`match: ${games.length} full games, every set at every size, each finishes`, games.length === 11 && gameProblems.length === 0, gameProblems);
  ok('match: every picture shown on a board loaded', await p.evaluate(() => performance.getEntriesByType('resource').filter(e => /img\/words\//.test(e.name)).length) >= 1);
  await h.click('.match-start', 80); await solve(p); await sleep(350); await h.click('.finish-buttons .btn-primary', 80);
  ok('match: Play again deals a fresh board', await p.$$eval('.card', cs => cs.length === 20 && cs.every(c => !c.classList.contains('matched'))) && !(await p.$('.match-finish')));
  ok('match run: no console errors, nothing off-site', p.errors.length === 0 && offSite(p).length === 0, [p.errors, offSite(p)]);
  await done(p);
  // Without reduced motion: confetti, then the finish card
  p = await open({ w: 1280, h: 800 }); h = helpers(p);
  await game(p, 'match'); await h.click('.match-start', 80); await solve(p); await sleep(200);
  ok('match: confetti on finishing', !!(await p.$('.confetti')));
  await sleep(1500);
  ok('match: then the finish card', await h.vis('.match-finish'));
  await done(p);

  // ══ The menu "i" panel, the Flashcards bubble, and the footer ══
  p = await open({ w: 1280, h: 800 }); h = helpers(p);
  await h.click('#btn-info', 80);
  ok('info: opens on a plain tap, "i" marked expanded', await h.vis('#menu-info') && await p.$eval('#btn-info', e => e.getAttribute('aria-expanded') === 'true'));
  ok('info: "Picture match: how to play" open, "About" closed', (await p.$$eval('#menu-info details', ds => ds.map(d => d.querySelector('summary').textContent + ':' + d.open).join())) === 'Picture match: how to play:true,About:false');
  ok('info: how to play, word for word', JSON.stringify(await p.$$eval('#menu-info .match-how li', ls => ls.map(l => l.textContent))) === JSON.stringify(HOW)
    && JSON.stringify(await p.$$eval('#menu-info .match-how p', ps => ps.map(x => x.textContent))) === JSON.stringify(HOW_P)
    && (await p.$eval('#menu-info .match-how p:last-child strong', e => e.textContent)) === 'For grown-ups');
  await h.click('#menu-info .flash-about summary');
  const menuAbout = await aboutOf(p, '#menu-info .flash-about');
  ok('info: About, word for word, with the two game names in bold', menuAbout.summary === 'About' && menuAbout.paras[0] === ABOUT_1 && menuAbout.paras[1] === ABOUT_2 && menuAbout.bold.join() === 'Tricky words,Picture match', menuAbout.paras.slice(0, 2));
  ok('info: About says how to add the site to a home screen, and that it needs a connection', menuAbout.paras[2] === ABOUT_3, menuAbout.paras[2]);
  ok('info: credits for the code, the font and the pictures, then Feedback', JSON.stringify(menuAbout.paras.slice(3)) === JSON.stringify(CREDITS), menuAbout.paras.slice(3));
  ok('info: credit links go to LICENSE.txt, fonts/OFL.txt, img/CREDITS.md; Feedback to the issues in a new tab', JSON.stringify(menuAbout.links) === JSON.stringify([['MIT licence', 'LICENSE.txt'], ['SIL Open Font Licence', 'fonts/OFL.txt'], ['Picture credits', 'img/CREDITS.md'], ['Feedback', FEEDBACK]])
    && await p.$eval('#menu-info a[href^="https"]', a => a.target === '_blank' && /noopener/.test(a.rel)));
  await h.click('#menu-info .flash-info-close', 40);
  ok('info: × closes it, focus back on "i"', !(await p.$('#menu-info')) && await p.evaluate(() => document.activeElement.id === 'btn-info'));
  await h.click('#btn-info', 40); await p.keyboard.press('Escape'); await sleep(30);
  ok('info: Escape closes it', !(await p.$('#menu-info')));
  await h.click('#btn-info', 40); await p.mouse.click(200, 700); await sleep(40);
  ok('info: a tap outside closes it', !(await p.$('#menu-info')));
  await h.click('#btn-info', 40); await h.click('#btn-info', 40);
  ok('info: a second tap on "i" closes it', !(await p.$('#menu-info')));
  // Footer
  await h.click('#footer-credits', 80);
  ok('footer: Credits opens the panel with About expanded', await h.vis('#menu-info') && (await p.$$eval('#menu-info details', ds => ds.map(d => d.open).join())) === 'false,true');
  ok('footer: About in view in the panel', await p.$eval('#menu-info .flash-about summary', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await h.click('#footer-credits', 40);
  ok('footer: Credits again keeps it open at About', await h.vis('#menu-info') && (await p.$$eval('#menu-info details', ds => ds.map(d => d.open).join())) === 'false,true');
  await h.click('#menu-info .flash-info-close', 40);
  ok('footer: "MIT licence" links to LICENSE.txt', await p.$eval('.menu-footer a', a => a.getAttribute('href') === 'LICENSE.txt' && !a.target));
  // Every licence and credit link: same-origin, served as text; LICENSE.txt the same bytes as LICENSE
  await h.click('#footer-credits', 60);
  const creditLinks = await p.$$eval('.menu-footer a, #menu-info a', as => as.map(a => a.href).filter(u => !u.startsWith('https://github.com/RobFirth/trickywords/issues')));
  const fetched = await p.evaluate(async urls => Promise.all(urls.map(async u => { const r = await fetch(u); return { u, status: r.status, type: r.headers.get('content-type'), body: await r.text() }; })), creditLinks);
  ok('links: four licence and credit links, all same-origin', creditLinks.length === 4 && creditLinks.every(u => u.startsWith(ORIGIN + '/')), creditLinks);
  ok('links: each one is served as text', fetched.every(f => f.status === 200 && /^text\/(plain|markdown)/.test(f.type)), fetched.map(f => [f.u, f.status, f.type]));
  ok('links: LICENSE.txt as served is identical to LICENSE', fetched.find(f => f.u.endsWith('/LICENSE.txt')).body === read('LICENSE').toString());
  const allLinks = await p.$$eval('a[href]', as => as.map(a => a.href));
  ok('links: Feedback is the only off-site link', allLinks.filter(u => !u.startsWith(ORIGIN + '/')).join() === FEEDBACK, allLinks);
  await h.click('#menu-info .flash-info-close', 40);
  for (const href of ['LICENSE.txt', 'img/CREDITS.md']) {
    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.$eval(`a[href="${href}"]`, a => a.click()).catch(async () => { await h.click('#footer-credits', 60); await p.$eval(`a[href="${href}"]`, a => a.click()); })]);
    ok(`links: ${href} opens in the browser as text`, p.url() === `${ORIGIN}/${href}` && (await p.evaluate(() => document.contentType)).startsWith('text/') && (await p.evaluate(() => document.body.innerText.length)) > 100);
    await p.goBack({ waitUntil: 'load' }); await sleep(120);
  }
  ok('links: back on the menu after reading', await onMenu(p));
  // The Flashcards bubble shows the same About section
  await game(p, 'flashcards'); await h.click('.flash-picker .flash-info-btn', 80);
  ok('flashcards info: "How to use" open, then the About section closed', (await p.$$eval('.flash-picker .flash-info details', ds => ds.map(d => d.querySelector('summary').textContent + ':' + d.open).join())) === 'How to use:true,About:false');
  const flashAbout = await aboutOf(p, '.flash-picker .flash-info .flash-about');
  ok('flashcards info: About is identical to the menu panel\'s', flashAbout.html === menuAbout.html && flashAbout.paras[0] === ABOUT_1);
  ok('info run: every request stayed on the site, no console errors', offSite(p).length === 0 && p.blocked.length === 0 && p.errors.length === 0, [offSite(p), p.errors]);
  await done(p);

  // ══ Flashcards, as in version 1: grown-ups, Focus, rosettes, a deck, reload ══
  p = await open({ w: 1280, h: 800 }); h = helpers(p);
  await game(p, 'flashcards');
  ok('picker: Reception decks Tricky 1, 2, 3 (colours kept), then All', (await deckTiles(p)) === 'yellow:Tricky 1:11 words|purple:Tricky 2:19 words|green:Tricky 3:16 words|all:All:46 words', await deckTiles(p));
  ok('picker: deck colours unchanged', await p.$$eval('.deck-tile:not(.all-tile)', ts => ts.map(t => getComputedStyle(t).borderTopColor).join('|')) === 'rgb(255, 192, 0)|rgb(177, 160, 199)|rgb(0, 176, 80)');
  await hold(p, '.flash-cog');
  ok('grown-ups: three modes, Reception, Year 1, Year 2', (await p.$$eval('.mode-btn', bs => bs.map(x => x.textContent + ':' + x.getAttribute('aria-pressed')).join('|'))) === 'Reception:true|Year 1:false|Year 2:false');
  await h.click('.mode-btn[data-mode="2"]');
  ok('grown-ups: Year 2 shows its 64 words', await p.$$eval('.word-chip', cs => cs.length) === 64);
  await h.click('.mode-btn[data-mode="1"]');
  for (const w of ['friend', 'said']) await h.click(`.word-chip[data-word="${w}"]`, 10);
  await h.click('.rosette-btn[data-deck="y1t3"]', 10);
  await h.click('.flash-done');
  ok('picker: Year 1 with Focus first, Tricky 1–4 and All, rosette on Tricky 3', (await h.txt('.flash-mode')) === 'Year 1' && (await deckTiles(p)).startsWith('focus:Focus:2 words|y1t1:Tricky 1')
    && (await p.$$eval('.deck-tile .rosette', r => r.map(x => x.closest('.deck-tile').dataset.deck).join())) === 'y1t3');
  await h.click('.deck-tile[data-deck="y1t2"]', 60);
  const seen = await runThrough(p);
  ok('card: every Year 1 Tricky 2 word once, I keeps its capital', seen.length === 12 && new Set(seen).size === 12 && seen.includes('I'), seen);
  ok('end: All done!', (await h.txt('.flash-end h2')) === 'All done!');
  await home(p);
  await p.reload({ waitUntil: 'load' }); await sleep(150);
  ok('reload: back on the menu', await onMenu(p));
  await game(p, 'flashcards');
  ok('reload: Year 1, Focus, rosette and last deck kept', (await h.txt('.flash-mode')) === 'Year 1' && (await deckTiles(p)).startsWith('focus:Focus:2 words|')
    && (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'y1t2');
  ok('flashcards run: no console errors, nothing off-site', p.errors.length === 0 && offSite(p).length === 0, [p.errors, offSite(p)]);
  await done(p);

  // ══ Speech unavailable: no speaker, Match plays silently ══
  p = await open({ speech: 'missing', reduced: true }); h = helpers(p);
  await game(p, 'flashcards'); await h.click('.deck-tile[data-deck="yellow"]', 60);
  ok('no speech: no speaker button', !(await p.$('.flash-speak')) && await h.vis('.flash-next'));
  ok('no speech: deck completes', (await runThrough(p)).length === 11 && await h.vis('.flash-end'));
  await home(p); await game(p, 'match'); await h.click('.match-start', 80); await solve(p); await sleep(350);
  ok('no speech: Match finishes', await h.vis('.match-finish'));
  ok('no speech: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Storage blocked: settings live in memory, nothing breaks ══
  p = await open({ storage: false }); h = helpers(p);
  await hold(p, '#btn-cog'); await h.click('#set-timer'); await h.click('#corner-close');
  await game(p, 'match'); await h.click('.match-start', 80);
  ok('storage blocked: Timer off held in memory', !(await p.$('.match-timer')));
  await home(p); await game(p, 'flashcards');
  await hold(p, '.flash-cog'); await h.click('.mode-btn[data-mode="2"]'); await h.click('.flash-done');
  await home(p); await game(p, 'flashcards');
  ok('storage blocked: the mode is kept in memory across Home', (await h.txt('.flash-mode')) === 'Year 2');
  ok('storage blocked: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Bad stored settings fall back safely ══
  p = await open({ settings: '{"sound":"yes","timer":7,"games":{"flashcards":{"mode":"x","deck":"nope","focus":{"r":["zzz","go"]},"rosettes":"bad"},"match":{"sets":["zzz"],"size":99}}}' }); h = helpers(p);
  await hold(p, '#btn-cog');
  ok('bad settings: Sound and Timer fall back to on', (await switches(p)) === 'true,true');
  await h.click('#corner-close'); await game(p, 'flashcards');
  ok('bad settings: Reception, Focus of the one real word, no rosettes', (await h.txt('.flash-mode')) === 'Reception' && (await deckTiles(p)).startsWith('focus:Focus:1 word|') && !(await p.$('.deck-tile .rosette')));
  await home(p); await game(p, 'match');
  ok('bad settings: Match falls back to set 1, 6 pairs', (await p.$$eval('.set-tile[aria-pressed="true"]', ts => ts.map(t => t.dataset.set).join())) === 'set1' && (await sizeButtons(p)).join() === '6');
  await p.evaluate(() => localStorage.setItem('trickywords-settings', 'not json')); await p.reload({ waitUntil: 'load' }); await sleep(120);
  ok('bad settings: broken JSON is ignored', await onMenu(p) && p.errors.length === 0, p.errors);
  await done(p);

  // ══ Served from a sub-path: relative URLs hold ══
  served.length = 0;
  p = await open({ at: SUB + '/', reduced: true }); h = helpers(p);
  ok('sub-path: menu with Andika', await onMenu(p) && await p.evaluate(() => document.fonts.check('700 20px Andika')));
  await game(p, 'match'); await chooseSet(p, 'mix'); await h.click('.size-btn[data-size="10"]'); await h.click('.match-start', 200);
  ok('sub-path: Match pictures load', await p.$$eval('.card img', is => is.length > 20 && is.every(i => i.complete && i.naturalWidth > 0)));
  await home(p); await h.click('#footer-credits', 40);
  ok('sub-path: licence and credit links stay under the sub-path', await p.$$eval('.menu-footer a, #menu-info a:not([target])', as => as.every(a => a.href.includes('/some/sub/path/'))));
  ok('sub-path: every request is under the sub-path', p.requests.filter(u => u.startsWith(ORIGIN)).every(u => u.startsWith(ORIGIN + SUB + '/')), p.requests.filter(u => !u.startsWith(ORIGIN + SUB)));
  ok('sub-path: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Reduced motion ══
  p = await open({ reduced: true }); h = helpers(p);
  await h.click('#btn-info');
  ok('reduced motion: the menu panel does not fade', await p.$eval('#menu-info', e => getComputedStyle(e).animationName === 'none'));
  await h.click('#menu-info .flash-info-close'); await game(p, 'flashcards'); await h.click('.deck-tile[data-deck="green"]', 60); await h.click('.flash-card', 10);
  ok('reduced motion: cards fade, not slide', await p.$eval('.flash-card', e => getComputedStyle(e).animationName === 'fade-in'));
  await done(p);

  // ══ Layout: no scrolling, nothing off screen, targets ≥ 64 px (the footer's links excepted, by the spec) ══
  for (const [w, hh] of [...SIZES, [568, 320]]) {
    const tag = `${w}x${hh}`, full = hh >= 568;
    p = await open({ w, h: hh, reduced: true }); h = helpers(p);
    const shoot = name => ['600x1024', '1280x800', '320x568', '1024x600'].includes(tag) && p.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
    await fits(p, `${tag} menu with footer: fits, targets ≥ 64px`); await shoot('menu');
    ok(`${tag} menu: footer on screen`, await p.$eval('.menu-footer', f => { const r = f.getBoundingClientRect(); return r.bottom <= innerHeight && r.height > 0; }));
    await h.click('#btn-info', 60);
    await fits(p, `${tag} menu panel: fits`); await shoot('menu-info');
    await h.click('#menu-info .flash-info-close'); await h.click('#footer-credits', 60);
    await fits(p, `${tag} menu panel at About (Credits): fits`); await shoot('credits');
    await h.click('#menu-info .flash-info-close');
    if (full) { await hold(p, '#btn-cog'); await fits(p, `${tag} grown-ups corner: fits`); await shoot('corner'); await h.click('#corner-close'); }
    // Flashcards
    await game(p, 'flashcards');
    await fits(p, `${tag} flashcards picker: fits with Home, targets ≥ 64px`); await shoot('picker');
    ok(`${tag} flashcards picker: heading between Home and "i"`, await p.evaluate(() => { const m = document.querySelector('.flash-mode').getBoundingClientRect();
      return m.left >= document.getElementById('btn-home').getBoundingClientRect().right && m.right <= document.querySelector('.flash-picker .flash-info-btn').getBoundingClientRect().left; }));
    await h.click('.flash-picker .flash-info-btn', 120); await h.click('.flash-picker .flash-about summary', 40);
    await fits(p, `${tag} flashcards bubble with About: fits`); await shoot('flash-info');
    await h.click('.flash-picker .flash-info-close');
    if (full) {
      await hold(p, '.flash-cog'); await h.click('.mode-btn[data-mode="2"]');
      for (const x of ['every', 'Mr']) await h.click(`.word-chip[data-word="${x}"]`, 10);
      await fits(p, `${tag} flashcards grown-ups: fits`);
      await h.click('.flash-done');
      await fits(p, `${tag} flashcards picker, Year 2 with Focus: fits`);
      await h.click('.deck-tile[data-deck="tricky2"]', 60);
      for (let k = 0; k < 13 && (await p.$eval('.flash-word', e => e.textContent)) !== 'everybody'; k++) await h.click('.flash-next', 10);
      await sleep(250);
      await fits(p, `${tag} flashcards card (longest word): fits`); await shoot('card');
      await runThrough(p);
      await fits(p, `${tag} flashcards end: fits`);
    }
    await home(p);
    // Match
    // Match is not checked at 568x320 (not one of the spec's sizes): its setup is 13 px too tall there, as on the source page
    if (full) {
      await game(p, 'match'); await chooseSet(p, 'mix');
      await fits(p, `${tag} match setup (all sizes offered): fits`); await shoot('match-setup');
      await h.click('.size-btn[data-size="10"]'); await h.click('.match-start', 250);
      await fits(p, `${tag} match board, 10 pairs with timer: fits`); await shoot('match-board');
      await h.click('.card[data-index="0"]', 300);
      await fits(p, `${tag} match board, a card face up: fits`);
      await solve(p); await sleep(350);
      await fits(p, `${tag} match finish: fits`); await shoot('match-finish');
    }
    ok(`${tag} page: no console errors`, p.errors.length === 0, p.errors);
    await done(p);
  }

  ok('every request across all pages stayed on the site (Feedback is never fetched)', allOffSite.length === 0, allOffSite.slice(0, 5));
  ok('zero console errors across all pages', allErrors.length === 0, allErrors.slice(0, 5));
  ok('the server never served a test file', !served.some(f => f.startsWith('/tests')));
  await b.close(); server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
