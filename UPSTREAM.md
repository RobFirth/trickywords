# Upstream

The Flashcards game comes from the kids page of [RobFirth/RobFirth.github.io](https://github.com/RobFirth/RobFirth.github.io), `static/kids/`.

- **Source commit**: `841f4d0` (2026-11-16, PR #18 merged: Year 1 words and the info bubble)
- **games/flashcards.js**: byte-for-byte copy of `static/kids/games/flashcards.js`
  - sha256: `0fc0eea48cbab3c267c48e7ae30b4101c9ac9684551188edeaf85a6f369120cf`
- **Deck data fingerprint**: `75d51c07cd0d34d00d3b90448ebf6ab96d19a49dd061d9ea32dda53c5f8be666`
  - sha256 of `JSON.stringify({ modes: flashModes.map(m => m.id), decks: flashDecks.map(({ label, ...d }) => d) })`
  - It covers mode ids and every deck's id, mode, colour, tint and words, but not the labels. The same value comes from the source's `static/kids/data/words.js`.

The tests check both hashes. To update: copy the new `flashcards.js` across unchanged, then record the new commit and hashes here.

## What differs from the source

| File | Difference |
|---|---|
| `games/flashcards.js` | None |
| `data/words.js` | Only `flashModes` and `flashDecks` (no Match sets). Labels: modes "Reception", "Year 1", "Year 2" (source: "Tricky (R)", "Tricky (1)", "Tricky (2)"); Reception decks "Tricky 1"–"Tricky 3" (source: "Yellow", "Purple", "Green"). Ids, words, colours and tints unchanged. |
| `shell.js` | New. No Firebase, sign-in, roles, menu or grown-ups corner. Settings code and speech helper reused from the source's `shell.js`; key `trickywords-settings`; `sound` is always `true`. `ctx.info` supplies the About section. Home remounts the game. |
| `index.html` | New. One view (the game) with the Home button; Andika and icons self-hosted; no `/family/` link. |
| `trickywords.css` | The shell and Flashcards rules from `static/kids/kids.css`, unchanged, minus Match, sign-in, menu, loading and picture-sheet rules. Adds local `@font-face`, and a final "This site only" section: Home hidden on the picker, centred mode labels, and on screens ≤ 380 px wide "Reception" on its own row and 22 px deck names. |
| `img/` | `icon.svg` is `static/kids/img/flashcards.svg`. The PNG icons and favicon are made from it by `tests/make-icons.js`. |
| `fonts/` | Andika 7.000 Regular and Bold woff2 and `OFL.txt`, unmodified, from SIL's release (github.com/silnrsi/font-andika). The source page loads Andika from Google Fonts. |
