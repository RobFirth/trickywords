// Headless checks for the Tricky Words site. Serves the repo itself (at / and at a sub-path) and drives Chrome.
// Run: npm test   (CHROME_PATH for another Chrome; UPSTREAM_GAME=<path to the source flashcards.js> to compare bytes too)
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FEEDBACK = 'https://github.com/RobFirth/trickywords/issues';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
fs.mkdirSync(OUT, { recursive: true });

// ── A static server: the repo at / and again under /some/sub/path/ ──
const SUB = '/some/sub/path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
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

(async () => {
  // ══ Files ══
  const upstream = fs.readFileSync(path.join(ROOT, 'UPSTREAM.md'), 'utf8');
  const gameHash = (upstream.match(/sha256: `([0-9a-f]{64})`/) || [])[1];
  const dataHash = (upstream.match(/Deck data fingerprint\*\*: `([0-9a-f]{64})`/) || [])[1];
  const game = fs.readFileSync(path.join(ROOT, 'games', 'flashcards.js'));
  ok('files: games/flashcards.js matches the hash in UPSTREAM.md', !!gameHash && sha256(game) === gameHash, [gameHash, sha256(game)]);
  ok('files: UPSTREAM.md records the source commit', /Source commit\*\*: `[0-9a-f]{7,40}`/.test(upstream));
  if (process.env.UPSTREAM_GAME) ok('files: games/flashcards.js is byte-identical to UPSTREAM_GAME', Buffer.compare(game, fs.readFileSync(process.env.UPSTREAM_GAME)) === 0);

  // Every file in the repo (tracked or not yet committed, minus ignored), text only, outside UPSTREAM.md
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const text = files.filter(f => f !== 'UPSTREAM.md' && !/\.(png|woff2)$/.test(f) && fs.existsSync(path.join(ROOT, f)));
  const hits = [];
  for (const f of text) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8').toLowerCase(); for (const w of BANNED) if (s.includes(w)) hits.push(`${f}: ${w}`); }
  ok(`files: no banned words in ${text.length} files outside UPSTREAM.md`, text.length > 10 && hits.length === 0, hits);
  ok('files: no service worker', !files.some(f => /(^|\/)(sw|service-?worker)\.js$/i.test(f)) && text.filter(f => !f.startsWith('tests/')).every(f => !fs.readFileSync(path.join(ROOT, f), 'utf8').includes('serviceWorker')));
  ok('files: the spec files are all there', ['index.html', 'trickywords.css', 'shell.js', 'games/flashcards.js', 'data/words.js', 'fonts/Andika-Regular.woff2', 'fonts/Andika-Bold.woff2', 'fonts/OFL.txt',
    'img/icon.svg', 'img/favicon.svg', 'manifest.webmanifest', 'UPSTREAM.md', '.nojekyll', 'LICENSE', 'README.md'].every(f => fs.existsSync(path.join(ROOT, f))));
  ok('files: .nojekyll is empty, LICENSE is MIT', fs.statSync(path.join(ROOT, '.nojekyll')).size === 0 && fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8').startsWith('MIT License'));
  ok('files: the OFL is the SIL Open Font License 1.1', /SIL OPEN FONT LICENSE Version 1\.1/.test(fs.readFileSync(path.join(ROOT, 'fonts', 'OFL.txt'), 'utf8')));
  ok('files: fonts are woff2', ['Regular', 'Bold'].every(w => fs.readFileSync(path.join(ROOT, 'fonts', `Andika-${w}.woff2`)).subarray(0, 4).toString() === 'wOF2'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const pngSize = f => { const b = fs.readFileSync(path.join(ROOT, f)); return b.toString('ascii', 1, 4) === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : null; };
  ok('manifest: name, standalone, colours, relative start', manifest.name === 'Tricky Words' && manifest.display === 'standalone' && manifest.background_color === '#FFF8E7' && manifest.start_url === './' && manifest.scope === './');
  ok('manifest: every icon exists at its stated size', manifest.icons.every(i => fs.existsSync(path.join(ROOT, i.src)) && (i.type !== 'image/png' || pngSize(i.src) === i.sizes)) && manifest.icons.some(i => i.purpose === 'maskable'), manifest.icons.map(i => [i.src, pngSize(i.src)]));
  ok('icons: favicon 32 and apple-touch 180', pngSize('img/favicon-32.png') === '32x32' && pngSize('img/apple-touch-icon.png') === '180x180');
  ok('icons: favicon.svg is the app icon', fs.readFileSync(path.join(ROOT, 'img/favicon.svg'), 'utf8') === fs.readFileSync(path.join(ROOT, 'img/icon.svg'), 'utf8'));
  const absolute = text.filter(f => /\.(html|css|js|webmanifest)$/.test(f) && !f.startsWith('tests/')).flatMap(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return [...s.matchAll(/(?:href|src)=["'](\/[^"']*)|url\(['"]?(\/[^)'"]*)|"(?:src|start_url|scope)":\s*"(\/[^"]*)"|from\s+['"](\/[^'"]*)/g)].map(m => `${f}: ${m[1] || m[2] || m[3] || m[4]}`);
  });
  ok('files: relative URLs only', absolute.length === 0, absolute);
  const WEIGHT = files.filter(f => !f.startsWith('tests/') && fs.existsSync(path.join(ROOT, f))).reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
  ok(`files: the site is under 1 MB (${Math.round(WEIGHT / 1024)} KB)`, WEIGHT < 1024 * 1024);

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const ORIGIN = `http://127.0.0.1:${server.address().port}`;
  const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
  const allErrors = [];

  // One fresh page per scenario. Every request is logged; anything off-site is blocked and recorded.
  // speech: 'ok' | 'missing'; storage: true | false (localStorage throws)
  async function open({ w = 1000, h = 800, at = '/', speech = 'ok', storage = true, reduced = false } = {}) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    p.ctx = ctx;
    await p.setViewport({ width: w, height: h });
    if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    p.errors = []; p.requests = []; p.blocked = [];
    p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
    p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
    p.on('response', r => { if (r.status() >= 400) p.errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); p.requests.push(u);
      if (u.startsWith(ORIGIN + '/') || u.startsWith('data:')) return r.continue();
      p.blocked.push(u); r.abort(); });
    await p.evaluateOnNewDocument((speech, storage) => {
      window.__spoken = [];
      if (!storage) Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage blocked'); } });
      const def = v => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: v });
      if (speech === 'ok') {
        const voices = [{ lang: 'en-GB', name: 'GB' }];
        def({ getVoices: () => voices, cancel() {}, addEventListener() {}, speak: u => window.__spoken.push(u.text) });
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      } else { def(undefined); window.SpeechSynthesisUtterance = undefined; }
    }, speech, storage);
    await p.goto(ORIGIN + at, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(150);
    return p;
  }
  async function done(p) { allErrors.push(...p.errors); await p.close(); await p.ctx.close(); }
  const helpers = p => ({
    vis: sel => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel),
    txt: sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()),
    click: async (sel, ms = 40) => { await p.$eval(sel, e => e.click()); await sleep(ms); }
  });
  const deckTiles = p => p.$$eval('.deck-tile', ts => ts.map(t => `${t.dataset.deck}:${t.querySelector('.deck-name').textContent}:${t.querySelector('.deck-count').textContent}`).join('|'));
  async function holdCog(p) {
    await p.$eval('.flash-cog', e => e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))); await sleep(2100);
    await p.$eval('.flash-cog', e => e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); await sleep(40);
  }
  async function runThrough(p) {
    const seen = [];
    for (let k = 0; k < 100 && await p.$('.flash-card'); k++) { seen.push(await p.$eval('.flash-word', e => e.textContent)); await p.$eval('.flash-next', e => e.click()); await sleep(12); }
    return seen;
  }
  const offSite = p => p.requests.filter(u => !u.startsWith(ORIGIN + '/') && !u.startsWith('data:'));
  const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('trickywords-settings')));
  const layoutProblems = p => p.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [];
    const se = document.scrollingElement;
    if (se.scrollWidth > W + 1 || se.scrollHeight > H + 1) bad.push(`document ${se.scrollWidth}x${se.scrollHeight}`);
    const v = document.getElementById('view-game');
    if (v.scrollHeight > v.clientHeight + 1 || v.scrollWidth > v.clientWidth + 1) bad.push(`view overflows ${v.scrollWidth}x${v.scrollHeight}`);
    document.querySelectorAll('#view-game *').forEach(e => {
      if (e.closest('.flash-words') || e.closest('.flash-info-body')) return; // these scroll
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) return;
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${e.tagName}.${typeof e.className === 'string' ? e.className : ''} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    });
    document.querySelectorAll('.mode-btn, .deck-name').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) bad.push(`"${e.textContent}" overflows`); });
    return bad.slice(0, 6);
  });
  const smallTargets = p => p.evaluate(() => [...document.querySelectorAll('#view-game button, #view-game summary')]
    .filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { t: e.className || e.id || e.tagName, w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.w < 64 || x.h < 64));

  // ══ Network blocked: everything off-site is refused, and the picker still mounts ══
  let p = await open({ w: 1280, h: 800 }); let h = helpers(p);
  ok('blocked network: picker mounts', await h.vis('.flash-picker') && (await h.txt('.flash-mode')) === 'Reception');
  ok('blocked network: Andika 400 and 700 load from the site', await p.evaluate(() => document.fonts.check('400 20px Andika') && document.fonts.check('700 20px Andika'))
    && p.requests.some(u => u.endsWith('/fonts/Andika-Regular.woff2')) && p.requests.some(u => u.endsWith('/fonts/Andika-Bold.woff2')));
  ok('blocked network: the game uses Andika', await p.$eval('.deck-name', e => getComputedStyle(e).fontFamily.startsWith('Andika')));
  ok('blocked network: nothing tried to leave the site', p.blocked.length === 0, p.blocked);
  ok('head: title, description, en-GB, viewport, manifest, no robots meta', await p.evaluate(() => document.title === 'Tricky Words' && document.documentElement.lang === 'en-GB'
    && /Reception, Year 1 and Year 2/.test(document.querySelector('meta[name=description]').content) && !!document.querySelector('meta[name=viewport]')
    && document.querySelector('link[rel=manifest]').getAttribute('href') === 'manifest.webmanifest' && !document.querySelector('meta[name=robots]')));
  ok('head: an h1 for the page', (await p.$eval('h1', e => e.textContent)) === 'Tricky Words');
  ok('head: no scripts but the shell module', await p.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).join() === 'shell.js'));
  ok('privacy: no cookies', (await p.evaluate(() => document.cookie)) === '' && (await p.cookies()).length === 0);
  ok('page: no console errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ A full run: picker, info bubble, grown-ups, a deck to the end, Home ══
  p = await open({ w: 1280, h: 800 }); h = helpers(p);
  ok('picker: Reception decks Tricky 1, 2, 3 (colours kept), then All', (await deckTiles(p)) === 'yellow:Tricky 1:11 words|purple:Tricky 2:19 words|green:Tricky 3:16 words|all:All:46 words', await deckTiles(p));
  ok('picker: deck colours unchanged', await p.$$eval('.deck-tile:not(.all-tile)', ts => ts.map(t => getComputedStyle(t).borderTopColor).join('|')) === 'rgb(255, 192, 0)|rgb(177, 160, 199)|rgb(0, 176, 80)');
  ok('picker: no Home button (it would only reload the picker)', !(await h.vis('#btn-home')));
  ok('picker: "i" and cog top right', await h.vis('.flash-info-btn') && await h.vis('.flash-cog'));
  // Info bubble
  await h.click('.flash-info-btn', 80);
  ok('info: two sections, "How to use" open, "About" closed', await p.$$eval('.flash-info details', ds => ds.map(d => d.querySelector('summary').textContent + ':' + d.open).join()) === 'How to use:true,About:false');
  ok('info: "How to use" starts with the child\'s part', (await h.txt('.flash-info-text h3')) === 'For your child');
  await h.click('.flash-about summary', 40);
  ok('info: About opens, text word for word', await p.$$eval('.flash-about p', ps => ps.map(x => x.textContent).slice(0, 2).join('|')) ===
    'Free flashcards for the tricky words children learn in Reception, Year 1 and Year 2. The Year 1 and Year 2 words are the common exception words from the national curriculum. Reception lists vary between schools, so check against your school\'s.'
    + '|This site has no accounts, no adverts and no tracking. Your settings are saved only on this device. Nothing you do here is sent to us or anyone else.');
  ok('info: credits Andika under the SIL Open Font Licence, linked to the local OFL', (await h.txt('.flash-about p:nth-of-type(3)')) === 'Font: Andika by SIL Global, under the SIL Open Font Licence.'
    && await p.$eval('.flash-about p:nth-of-type(3) a', a => a.getAttribute('href') === 'fonts/OFL.txt'));
  ok('info: Feedback link to the issues, opening in a new tab', await p.$eval('.flash-about p:nth-of-type(4) a', a => a.textContent === 'Feedback' && a.target === '_blank' && /noopener/.test(a.rel)) && (await p.$eval('.flash-about p:nth-of-type(4) a', a => a.href)) === FEEDBACK);
  const links = await p.$$eval('a[href]', as => as.map(a => a.href));
  ok('info: Feedback is the only off-site link', links.filter(u => !u.startsWith(ORIGIN + '/')).join() === FEEDBACK && links.length === 2, links);
  ok('info: the OFL link works', (await (await p.evaluate(async () => (await fetch('fonts/OFL.txt')).status))) === 200);
  await h.click('.flash-info-close', 40);
  ok('info: closes', !(await p.$('.flash-info')));
  // Grown-ups: Year 1, two Focus words, a rosette
  await holdCog(p);
  ok('grown-ups: three modes, Reception, Year 1, Year 2', (await p.$$eval('.mode-btn', bs => bs.map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join('|'))) === 'Reception:true|Year 1:false|Year 2:false');
  await h.click('.mode-btn[data-mode="2"]');
  ok('grown-ups: Year 2 shows its 64 words', await p.$$eval('.word-chip', cs => cs.length) === 64);
  await h.click('.mode-btn[data-mode="1"]');
  ok('grown-ups: Year 1 shows its 45 words and four rosette toggles', await p.$$eval('.word-chip', cs => cs.length) === 45 && (await p.$$eval('.rosette-btn', bs => bs.map(b => b.textContent.trim()).join())) === 'Tricky 1,Tricky 2,Tricky 3,Tricky 4');
  for (const w of ['friend', 'said']) await h.click(`.word-chip[data-word="${w}"]`, 10);
  await h.click('.rosette-btn[data-deck="y1t3"]', 10);
  await h.click('.flash-done');
  ok('picker: Year 1 with Focus first, Tricky 1–4 and All', (await h.txt('.flash-mode')) === 'Year 1'
    && (await deckTiles(p)) === 'focus:Focus:2 words|y1t1:Tricky 1:11 words|y1t2:Tricky 2:12 words|y1t3:Tricky 3:11 words|y1t4:Tricky 4:11 words|all:All:45 words', await deckTiles(p));
  ok('picker: rosette on Tricky 3', (await p.$$eval('.deck-tile .rosette', r => r.map(x => x.closest('.deck-tile').dataset.deck).join())) === 'y1t3');
  const s1 = await stored(p);
  ok('settings: one key, the agreed shape', JSON.stringify(Object.keys(s1)) === '["sound","games"]' && s1.sound === true && JSON.stringify(Object.keys(s1.games)) === '["flashcards"]'
    && s1.games.flashcards.mode === '1' && JSON.stringify(s1.games.flashcards.focus['1']) === '["said","friend"]' && JSON.stringify(s1.games.flashcards.rosettes) === '["y1t3"]', s1);
  ok('settings: nothing else in storage', await p.evaluate(() => Object.keys(localStorage).join() === 'trickywords-settings' && sessionStorage.length === 0));
  // A deck to the end
  await h.click('.deck-tile[data-deck="y1t2"]', 60);
  ok('card: Home shown on the card screen', await h.vis('#btn-home') && await h.vis('.flash-card'));
  ok('card: speaker button shown (sound is always on)', await h.vis('.flash-speak'));
  await h.click('.flash-speak');
  ok('card: the speaker says the word', (await p.evaluate(() => __spoken.join())) === await p.$eval('.flash-word', e => e.textContent));
  const seen = await runThrough(p);
  ok('card: every Year 1 Tricky 2 word once, I keeps its capital', seen.length === 12 && new Set(seen).size === 12 && seen.includes('I'), seen);
  ok('end: All done!, with Home shown', await h.vis('.flash-end') && (await h.txt('.flash-end h2')) === 'All done!' && await h.vis('#btn-home'));
  await h.click('.flash-again', 60);
  ok('end: Again restarts the deck', (await h.txt('.flash-counter')) === '1 / 12');
  await h.click('.flash-next'); await h.click('#btn-home', 80);
  ok('Home mid-deck: back to the deck picker, last deck marked', await h.vis('.flash-picker') && !(await h.vis('#btn-home')) && (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'y1t2');
  ok('Home: keys afterwards do nothing and raise no errors', (await p.keyboard.press('ArrowRight'), await sleep(30), await h.vis('.flash-picker')) && p.errors.length === 0, p.errors);
  await h.click('.deck-tile[data-deck="focus"]', 60);
  ok('focus: the Focus deck is the chosen words', (await h.txt('.flash-counter')) === '1 / 2' && ['said', 'friend'].includes(await p.$eval('.flash-word', e => e.textContent)));
  await h.click('#btn-home', 60);
  ok('full run: every request stayed on the site', offSite(p).length === 0 && p.blocked.length === 0, offSite(p));
  ok('full run: the manifest and every icon the page names load from the site', await p.evaluate(async () => {
    const m = await (await fetch('manifest.webmanifest')).json();
    const urls = ['manifest.webmanifest', ...m.icons.map(i => i.src), ...[...document.querySelectorAll('link[rel~=icon], link[rel=apple-touch-icon]')].map(l => l.getAttribute('href'))];
    return (await Promise.all(urls.map(async u => (await fetch(u)).status))).every(st => st === 200) && urls.length === 8;
  }));
  ok('full run: no console errors', p.errors.length === 0, p.errors);
  // ── Reload: mode, Focus words and rosettes persist ──
  await p.reload({ waitUntil: 'load' }); await sleep(150);
  ok('reload: Year 1 kept', (await h.txt('.flash-mode')) === 'Year 1');
  ok('reload: Focus deck kept', (await deckTiles(p)).startsWith('focus:Focus:2 words|'));
  ok('reload: rosette and last deck kept', (await p.$$eval('.deck-tile .rosette', r => r.map(x => x.closest('.deck-tile').dataset.deck).join())) === 'y1t3'
    && (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'focus');
  await holdCog(p);
  ok('reload: Focus chips still pressed', (await p.$$eval('.word-chip[aria-pressed="true"]', cs => cs.map(c => c.dataset.word).join())) === 'said,friend');
  ok('reload: no console errors, nothing off-site', p.errors.length === 0 && offSite(p).length === 0, [p.errors, offSite(p)]);
  await done(p);

  // ══ Speech unavailable: no speaker, the game still works ══
  p = await open({ speech: 'missing' }); h = helpers(p);
  await h.click('.deck-tile[data-deck="yellow"]', 60);
  ok('no speech: no speaker button', !(await p.$('.flash-speak')) && await h.vis('.flash-next'));
  const seen2 = await runThrough(p);
  ok('no speech: deck completes', seen2.length === 11 && await h.vis('.flash-end'));
  ok('no speech: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Storage blocked: settings live in memory, nothing breaks ══
  p = await open({ storage: false }); h = helpers(p);
  ok('storage blocked: picker mounts', (await h.txt('.flash-mode')) === 'Reception');
  await holdCog(p); await h.click('.mode-btn[data-mode="2"]'); await h.click('.flash-done');
  await h.click('.deck-tile[data-deck="tricky1"]', 60); await h.click('#btn-home', 60);
  ok('storage blocked: the mode is kept in memory across Home', (await h.txt('.flash-mode')) === 'Year 2' && (await p.$$eval('.deck-tile.last', t => t.map(x => x.dataset.deck).join())) === 'tricky1');
  ok('storage blocked: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Bad stored settings fall back safely ══
  p = await open(); h = helpers(p);
  await p.evaluate(() => localStorage.setItem('trickywords-settings', '{"sound":false,"games":{"flashcards":{"mode":"x","deck":"nope","focus":{"r":["zzz","go"]},"rosettes":"bad"}}}'));
  await p.reload({ waitUntil: 'load' }); await sleep(120);
  ok('bad settings: Reception, Focus of the one real word, no rosettes', (await h.txt('.flash-mode')) === 'Reception' && (await deckTiles(p)).startsWith('focus:Focus:1 word|') && !(await p.$('.deck-tile .rosette')));
  await h.click('.deck-tile[data-deck="yellow"]', 60);
  ok('bad settings: sound stays on regardless', await h.vis('.flash-speak'));
  await p.evaluate(() => localStorage.setItem('trickywords-settings', 'not json')); await p.reload({ waitUntil: 'load' }); await sleep(120);
  ok('bad settings: broken JSON is ignored', (await h.txt('.flash-mode')) === 'Reception' && p.errors.length === 0, p.errors);
  await done(p);

  // ══ Served from a sub-path: relative URLs hold ══
  served.length = 0;
  p = await open({ at: SUB + '/' }); h = helpers(p);
  ok('sub-path: picker mounts with Andika', await h.vis('.flash-picker') && await p.evaluate(() => document.fonts.check('700 20px Andika')));
  ok('sub-path: every request is under the sub-path', p.requests.filter(u => u.startsWith(ORIGIN)).every(u => u.startsWith(ORIGIN + SUB + '/')), p.requests.filter(u => !u.startsWith(ORIGIN + SUB)));
  await h.click('.flash-info-btn'); await h.click('.flash-about summary');
  ok('sub-path: the OFL link stays under the sub-path', await p.$eval('.flash-about a[href="fonts/OFL.txt"]', a => a.href.endsWith('/some/sub/path/fonts/OFL.txt')));
  ok('sub-path: no errors', p.errors.length === 0, p.errors);
  await done(p);

  // ══ Reduced motion ══
  p = await open({ reduced: true }); h = helpers(p);
  await h.click('.flash-info-btn');
  ok('reduced motion: the bubble does not fade', await p.$eval('.flash-info', e => getComputedStyle(e).animationName === 'none'));
  await h.click('.flash-info-close'); await h.click('.deck-tile[data-deck="green"]', 60); await h.click('.flash-card', 10);
  ok('reduced motion: cards fade, not slide', await p.$eval('.flash-card', e => getComputedStyle(e).animationName === 'fade-in'));
  await done(p);

  // ══ Layout: no scrolling, nothing off screen, targets ≥ 64 px ══
  for (const [w, hh] of [[600, 1024], [1024, 600], [1280, 800], [800, 1280], [390, 844], [320, 568], [568, 320]]) {
    const tag = `${w}x${hh}`;
    p = await open({ w, h: hh }); h = helpers(p);
    const shoot = name => ['600x1024', '1280x800', '320x568'].includes(tag) && p.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
    ok(`${tag} picker: fits, targets ≥ 64px`, (await layoutProblems(p)).length === 0 && (await smallTargets(p)).length === 0, [await layoutProblems(p), await smallTargets(p)]);
    ok(`${tag} picker: heading clear of the buttons`, await p.evaluate(() => document.querySelector('.flash-mode').getBoundingClientRect().right <= document.querySelector('.flash-info-btn').getBoundingClientRect().left));
    await shoot('picker');
    await h.click('.flash-info-btn', 200); await h.click('.flash-about summary', 40);
    ok(`${tag} info: bubble fits, targets ≥ 64px`, (await layoutProblems(p)).length === 0 && (await smallTargets(p)).length === 0, [await layoutProblems(p), await smallTargets(p)]);
    await shoot('info');
    await h.click('.flash-info-close');
    if (hh >= 568) {
      await holdCog(p); await h.click('.mode-btn[data-mode="2"]');
      for (const x of ['every', 'Mr']) await h.click(`.word-chip[data-word="${x}"]`, 10);
      ok(`${tag} grown-ups: fits, mode labels inside, targets ≥ 64px`, (await layoutProblems(p)).length === 0 && (await smallTargets(p)).length === 0, [await layoutProblems(p), await smallTargets(p)]);
      await shoot('grown-ups');
      await h.click('.flash-done');
      ok(`${tag} picker, Year 2 with Focus: fits`, (await p.$$eval('.deck-tile', t => t.length)) === 7 && (await layoutProblems(p)).length === 0, await layoutProblems(p));
      await h.click('.deck-tile[data-deck="tricky2"]', 60);
      for (let k = 0; k < 13 && (await p.$eval('.flash-word', e => e.textContent)) !== 'everybody'; k++) await h.click('.flash-next', 10);
      await sleep(250);
      ok(`${tag} card: fits with Home, targets ≥ 64px`, (await layoutProblems(p)).length === 0 && (await smallTargets(p)).length === 0 && await h.vis('#btn-home'), [await layoutProblems(p), await smallTargets(p)]);
      await shoot('card');
      await runThrough(p);
      ok(`${tag} end: fits`, (await layoutProblems(p)).length === 0 && (await smallTargets(p)).length === 0, [await layoutProblems(p), await smallTargets(p)]);
    }
    ok(`${tag} page: no console errors`, p.errors.length === 0, p.errors);
    await done(p);
  }

  ok('zero console errors across all pages', allErrors.length === 0, allErrors.slice(0, 5));
  ok('the server never served a test file', !served.some(f => f.startsWith('/tests')));
  await b.close(); server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
