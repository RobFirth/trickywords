// Tricky Words shell: menu, game host, grown-ups corner, settings, speech helper. No accounts, no server,
// nothing sent anywhere. Settings stay in this browser's localStorage (in memory if storage is blocked).
// Games are the source's modules, unchanged. A game gets only the ctx object.
import flashcards from './games/flashcards.js';
import match from './games/match.js';

// Registry: the shell sets each tile's label
const GAMES = [
  { game: flashcards, label: 'Tricky words' },
  { game: match, label: 'Picture match' }
];
const FEEDBACK_URL = 'https://github.com/RobFirth/trickywords/issues';

const $ = id => document.getElementById(id);
const VIEWS = ['menu', 'game'];
function showView(name) {
  VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== name));
}

// ── Settings: one localStorage key, in-memory fallback, nothing personal ──
// Shape: { sound, timer, games: { flashcards: { mode, deck, focus, rosettes }, match: { sets, size } } }
// Version 1 saved { sound: true, games: { flashcards } }, which reads as is (timer takes its default).
const SETTINGS_KEY = 'trickywords-settings';
const DEFAULTS = { sound: true, timer: true, games: {} };
let memorySettings = null;
function loadSettings() {
  let s = memorySettings;
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* storage blocked or bad JSON */ }
  s = s && typeof s === 'object' ? s : {};
  return {
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULTS.sound,
    timer: typeof s.timer === 'boolean' ? s.timer : DEFAULTS.timer,
    games: s.games && typeof s.games === 'object' ? s.games : {}
  };
}
function saveSettings(s) {
  memorySettings = s;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* keep the in-memory copy */ }
}
function updateSettings(patch) { const s = { ...loadSettings(), ...patch }; saveSettings(s); return s; }

// ── Speech helper: never throws, nothing depends on it ──
let voice = null;
function pickVoice() {
  try {
    const voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    voice = voices.find(v => /^en[-_]GB$/i.test(v.lang)) || voices.find(v => /^en\b/i.test(v.lang)) || null;
  } catch (e) { voice = null; }
}
try {
  if (window.speechSynthesis) {
    pickVoice();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickVoice);
    else speechSynthesis.onvoiceschanged = pickVoice;
  }
} catch (e) { voice = null; }
function canSpeak() {
  try { if (!voice) pickVoice(); return !!voice && typeof SpeechSynthesisUtterance === 'function'; } catch (e) { return false; }
}
function say(word) {
  try {
    if (!canSpeak()) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(word));
    u.voice = voice; u.lang = voice.lang; u.rate = 0.8;
    speechSynthesis.speak(u);
  } catch (e) { /* speech is a bonus */ }
}

// ── Info text: the About section (menu panel and the Flashcards bubble) and Match's how-to ──
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function strong(text) { return el('strong', text); }
function link(text, href) { const a = el('a', text); a.href = href; return a; }
function para(...parts) { const p = el('p'); p.append(...parts); return p; }
function about() {
  const d = el('details', undefined, 'flash-info-section flash-about');
  d.append(el('summary', 'About'));
  d.append(para('Word games for early readers. ', strong('Tricky words'), ' are flashcards for the words children learn by sight in Reception, Year 1 and Year 2. The Year 1 and Year 2 words are the common exception words from the national curriculum. ',
    strong('Picture match'), ' is a memory game with first words to sound out.'));
  d.append(para('This site has no accounts, no adverts and no tracking. Your settings are saved only on this device. Nothing you do here is sent to us or anyone else.'));
  d.append(para('To keep it on your home screen, choose "Install" or "Add to Home Screen" from your browser\'s menu. It still needs the internet to work.'));
  d.append(para('Code: ', link('MIT licence', 'LICENSE.txt'), '.'));
  d.append(para('Font: Andika by SIL Global, under the ', link('SIL Open Font Licence', 'fonts/OFL.txt'), '.'));
  d.append(para('Some pictures are from Twemoji, © Twitter, Inc and other contributors, CC-BY 4.0. ', link('Picture credits', 'img/CREDITS.md'), '.'));
  const feedback = link('Feedback', FEEDBACK_URL);
  feedback.target = '_blank'; feedback.rel = 'noopener noreferrer';
  d.append(para(feedback));
  return d;
}
function matchHowTo() {
  const d = el('details', undefined, 'flash-info-section match-how');
  d.open = true;
  const text = el('div', undefined, 'flash-info-text');
  const list = el('ul');
  list.append(...['Choose one or more sets of sounds, and how many pairs.', 'Tap two cards. A picture and its word make a pair.',
    'If they don\'t match, they turn back after a moment.', 'Find every pair to finish.'].map(t => el('li', t)));
  text.append(list,
    para('The sets follow the order sounds are usually taught. Each set only uses sounds from that set and the ones before it.'),
    para(strong('For grown-ups'), ': press and hold the cog on the home screen for two seconds to turn the sound and the timer on or off.'));
  d.append(el('summary', 'Picture match: how to play'), text);
  return d;
}

// ── Menu ──
function showMenu() {
  const tiles = $('game-tiles');
  tiles.replaceChildren(...GAMES.map(({ game, label }) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile'; b.dataset.game = game.id;
    const img = document.createElement('img');
    img.src = game.icon; img.alt = '';
    const span = document.createElement('span');
    span.textContent = label;
    b.append(img, span);
    b.addEventListener('click', () => startGame(game));
    return b;
  }));
  showView('menu');
}

// ── Game host ──
let cleanupGame = null;
function stopGame() {
  if (cleanupGame) { try { cleanupGame(); } catch (e) { console.error('Game cleanup failed:', e); } }
  cleanupGame = null;
  $('game-root').replaceChildren();
}
function startGame(game) {
  stopGame(); closeInfo(false); closeCorner();
  const root = $('game-root');
  const s = loadSettings();
  const settings = Object.freeze({
    sound: s.sound,
    timer: s.timer,
    load: () => { const g = loadSettings().games[game.id]; return g && typeof g === 'object' ? { ...g } : {}; },
    save: obj => { const all = loadSettings(); updateSettings({ games: { ...all.games, [game.id]: { ...obj } } }); }
  });
  const ctx = Object.freeze({ exit: goHome, settings, say, canSpeak, info: about });
  showView('game');
  try {
    const cleanup = game.mount(root, ctx);
    cleanupGame = typeof cleanup === 'function' ? cleanup : null;
  } catch (e) {
    console.error('Game failed to start:', e);
    goHome();
  }
}
function goHome() { stopGame(); showMenu(); }
$('btn-home').addEventListener('click', goHome);

// ── Grown-ups corner: opens only after a 2 s press-and-hold ──
const HOLD_MS = 2000;
const cog = $('btn-cog');
let holdTimer = null;
function startHold(e) {
  if (e.type === 'keydown') { if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); }
  if (e.type === 'pointerdown' && e.button !== 0) return;
  cancelHold();
  cog.classList.add('holding');
  holdTimer = setTimeout(() => { holdTimer = null; cog.classList.remove('holding'); openCorner(); }, HOLD_MS);
}
function cancelHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  cog.classList.remove('holding');
}
cog.addEventListener('pointerdown', startHold);
cog.addEventListener('keydown', startHold);
['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(t => cog.addEventListener(t, cancelHold));
cog.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') cancelHold(); });
cog.addEventListener('contextmenu', e => e.preventDefault());
cog.addEventListener('click', e => e.preventDefault()); // a tap does nothing

function renderCorner() {
  const s = loadSettings();
  $('set-sound').setAttribute('aria-pressed', String(s.sound));
  $('set-timer').setAttribute('aria-pressed', String(s.timer));
}
function openCorner() {
  closeInfo(false);
  renderCorner();
  $('corner').classList.remove('hidden');
  $('corner-close').focus();
}
function closeCorner() {
  const c = $('corner');
  if (c.classList.contains('hidden')) return;
  c.classList.add('hidden');
  if (!$('view-menu').classList.contains('hidden')) cog.focus();
}
$('set-sound').addEventListener('click', () => { updateSettings({ sound: !loadSettings().sound }); renderCorner(); });
$('set-timer').addEventListener('click', () => { updateSettings({ timer: !loadSettings().timer }); renderCorner(); });
$('corner-close').addEventListener('click', closeCorner);
$('corner').addEventListener('click', e => { if (e.target === e.currentTarget) closeCorner(); });

// ── Menu "i" panel: the same bubble as the Flashcards one. A plain tap opens it; ×, a tap outside,
// Escape or a second tap closes it. "Credits" in the footer opens it at About. ──
const infoBtn = $('btn-info');
let bubble = null;
function closeInfo(refocus = true) {
  if (!bubble) return;
  bubble.remove(); bubble = null;
  infoBtn.setAttribute('aria-expanded', 'false');
  if (refocus) infoBtn.focus({ preventScroll: true });
}
function openInfo(atAbout = false) {
  closeInfo(false);
  const box = el('div', undefined, 'flash-info menu-info');
  box.id = 'menu-info';
  box.tabIndex = -1;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Information');
  const x = el('button', '×', 'flash-info-close');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', () => closeInfo());
  const body = el('div', undefined, 'flash-info-body');
  const how = matchHowTo(), info = about();
  if (atAbout) { how.open = false; info.open = true; }
  body.append(how, info);
  box.append(x, body);
  $('view-menu').append(box);
  bubble = box;
  infoBtn.setAttribute('aria-expanded', 'true');
  box.focus({ preventScroll: true });
}
infoBtn.addEventListener('click', () => (bubble ? closeInfo() : openInfo()));
$('footer-credits').addEventListener('click', () => openInfo(true));
// A tap outside: focus goes back to "i" unless the tap lands on something that takes focus itself
document.addEventListener('pointerdown', e => {
  if (!bubble || bubble.contains(e.target) || infoBtn.contains(e.target) || $('footer-credits').contains(e.target)) return;
  closeInfo(false);
  if (!(e.target instanceof Element && e.target.closest('button, a, input, select, textarea, [tabindex]'))) setTimeout(() => infoBtn.focus({ preventScroll: true }), 0);
}, true);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('corner').classList.contains('hidden')) closeCorner();
  else if (bubble) { e.preventDefault(); closeInfo(); }
});

showMenu();
