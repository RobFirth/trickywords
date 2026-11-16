# Tricky Words

Free flashcards for the tricky words children learn in Reception, Year 1 and Year 2: one word at a time, large, in coloured decks.

**https://trickywords.robertfirth.co.uk/**

- The Year 1 and Year 2 decks are the common exception words from the national curriculum. Reception lists vary between schools, so check against your school's.
- A grown-up can switch year groups, pick Focus words and mark decks "Passed in class". Press and hold the cog for two seconds. The "i" button explains how to use it.
- No accounts, adverts, tracking or cookies. Settings stay in the browser on that device, and nothing is sent anywhere. The site makes no requests to other sites.

## How it is built

Plain files, no build step. Served as-is by GitHub Pages from `main` (`.nojekyll` keeps files untouched). All URLs are relative, so the site works at any address.

| File | Holds |
|---|---|
| `index.html` | The page: game view and Home button |
| `shell.js` | Settings (localStorage, in-memory fallback), speech helper, the About section, game host |
| `games/flashcards.js` | The game, copied unchanged from upstream (see `UPSTREAM.md`) |
| `data/words.js` | Year groups and decks |
| `trickywords.css` | Styles |
| `fonts/` | Andika (SIL Open Font Licence) |
| `img/`, `manifest.webmanifest` | Icons and the web app manifest |

To try it locally, serve the folder with any static server, e.g. `python3 -m http.server`, and open it in a browser.

## Tests

```bash
cd tests
npm install
npm test            # needs Chrome; set CHROME_PATH for another binary
```

The tests serve the site themselves, so no other server is needed. They check that the game file matches upstream, that no request leaves the site, that settings persist, and that it works without speech and on small screens. `npm run icons` remakes the PNG icons from `img/icon.svg`.

## Licence

Code: MIT (see `LICENSE`). Font: Andika by SIL Global, under the SIL Open Font Licence (`fonts/OFL.txt`).

Feedback and ideas are welcome as [issues](https://github.com/RobFirth/trickywords/issues).
