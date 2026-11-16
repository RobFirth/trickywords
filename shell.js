// Tricky Words shell: hosts the Flashcards game. No accounts, no server, nothing sent anywhere.
// Settings stay in this browser's localStorage (in memory if storage is blocked).
import flashcards from './games/flashcards.js';

const $ = id => document.getElementById(id);
const FEEDBACK_URL = 'https://github.com/RobFirth/trickywords/issues';

// ── Settings: one localStorage key, in-memory fallback, nothing personal ──
// Shape: { sound: true, games: { flashcards: { mode, deck, focus, rosettes } } }
const SETTINGS_KEY = 'trickywords-settings';
let memorySettings = null;
function loadSettings() {
  let s = memorySettings;
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* storage blocked or bad JSON */ }
  s = s && typeof s === 'object' ? s : {};
  return { sound: true, games: s.games && typeof s.games === 'object' ? s.games : {} };
}
function saveSettings(s) {
  memorySettings = s;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* keep the in-memory copy */ }
}

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

// ── The "About" section for the game's info bubble, built afresh each time it opens ──
function el(tag, text) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; }
function about() {
  const d = document.createElement('details');
  d.className = 'flash-info-section flash-about';
  d.append(el('summary', 'About'));
  d.append(el('p', 'Free flashcards for the tricky words children learn in Reception, Year 1 and Year 2. The Year 1 and Year 2 words are the common exception words from the national curriculum. Reception lists vary between schools, so check against your school\'s.'));
  d.append(el('p', 'This site has no accounts, no adverts and no tracking. Your settings are saved only on this device. Nothing you do here is sent to us or anyone else.'));
  const credits = el('p', 'Font: Andika by SIL Global, under the ');
  const ofl = el('a', 'SIL Open Font Licence');
  ofl.href = 'fonts/OFL.txt';
  credits.append(ofl, '.');
  const feedback = el('p');
  const link = el('a', 'Feedback');
  link.href = FEEDBACK_URL; link.target = '_blank'; link.rel = 'noopener noreferrer';
  feedback.append(link);
  d.append(credits, feedback);
  return d;
}

// ── Game host: the Home button (and ctx.exit) remount the game, back at the deck picker ──
let cleanupGame = null;
function stopGame() {
  if (cleanupGame) { try { cleanupGame(); } catch (e) { console.error('Game cleanup failed:', e); } }
  cleanupGame = null;
  $('game-root').replaceChildren();
}
function startGame() {
  stopGame();
  const game = flashcards;
  const settings = Object.freeze({
    sound: true,
    load: () => { const g = loadSettings().games[game.id]; return g && typeof g === 'object' ? { ...g } : {}; },
    save: obj => { const all = loadSettings(); saveSettings({ ...all, games: { ...all.games, [game.id]: { ...obj } } }); }
  });
  const ctx = Object.freeze({ exit: startGame, settings, say, canSpeak, info: about });
  try {
    const cleanup = game.mount($('game-root'), ctx);
    cleanupGame = typeof cleanup === 'function' ? cleanup : null;
  } catch (e) {
    console.error('Game failed to start:', e);
  }
}
$('btn-home').addEventListener('click', startGame);
startGame();
