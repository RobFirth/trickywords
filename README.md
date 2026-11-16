# Tricky Words

Word games for early readers, in the browser.

**https://trickywords.robertfirth.co.uk/**

- **Tricky words**: flashcards for the words children learn by sight in Reception, Year 1 and Year 2, one word at a time, large, in coloured decks. The Year 1 and Year 2 decks are the common exception words from the national curriculum. A grown-up can switch year groups, pick Focus words and mark decks "Passed in class" (press and hold the cog on the deck picker for two seconds).
- **Picture match**: a memory game pairing pictures with first words to sound out, in sets that follow the order sounds are usually taught.
- **Grown-ups corner**: press and hold the cog on the home screen for two seconds to turn Sound and the Timer on or off. The "i" buttons explain how to play.
- No accounts, adverts, tracking or cookies. Settings stay in the browser on that device, and nothing is sent anywhere. The site makes no requests to other sites.

## How it is built

Plain files, no build step. Served as-is by GitHub Pages from `main` (`.nojekyll` keeps files untouched). All URLs are relative, so the site works at any address.

| File | Holds |
|---|---|
| `index.html` | The page: menu (with the licence footer), game view, grown-ups corner |
| `shell.js` | Menu, game host, grown-ups corner, the "i" panel and About section, settings (localStorage, in-memory fallback), speech helper |
| `games/flashcards.js`, `games/match.js` | The games, copied unchanged from upstream |
| `data/words.js` | Flashcards year groups and decks; Match sets |
| `img/words/`, `img/card-back.svg` | Match pictures, copied unchanged from upstream (credits in `img/CREDITS.md`) |
| `trickywords.css` | Styles |
| `fonts/` | Andika (SIL Open Font Licence) |
| `img/`, `manifest.webmanifest` | Icons and the web app manifest |
| `LICENSE.txt` | A copy of `LICENSE` the site links to (a file with no extension would download) |

To try it locally, serve the folder with any static server, e.g. `python3 -m http.server`, and open it in a browser.

## Upstream

The games, pictures and icons are made and tested on the kids page of [RobFirth.github.io](https://github.com/RobFirth/RobFirth.github.io) first, then copied here byte for byte. `upstream.json` records the source commit and a hash of every copied file. See `UPSTREAM.md` for what is copied, what differs and why.

To bring in a new version, from a clean checkout of the source:

```bash
cd tests
npm run sync -- ../../RobFirth.github.io   # path to the checkout
npm test
```

`npm run sync` copies the files, updates `upstream.json` and `UPSTREAM.md`, and stops with an error if `data/words.js` needs a hand edit. The **Upstream check** workflow runs weekly (and on demand from the Actions tab) and fails if this copy has fallen behind the source.

## Tests

```bash
cd tests
npm install
npm test            # needs Chrome; set CHROME_PATH for another binary
```

The tests serve the site themselves, so no other server is needed. They check every copied file against `upstream.json`, play both games through (every Match set at every size), check the grown-ups corner, the settings, the "i" panels and the licence links, that no request leaves the site, and that every screen fits without scrolling from a 320 px phone to a 1280 px tablet. `UPSTREAM_SRC=<path> npm test` also compares with a source checkout. `npm run check-upstream -- <path>` runs just the upstream comparison. `npm run icons` remakes the PNG icons from `img/icon.svg`.

## Licence

Code: MIT (see `LICENSE`). Font: Andika by SIL Global, under the SIL Open Font Licence (`fonts/OFL.txt`). Some pictures are from Twemoji, © Twitter, Inc and other contributors, under CC-BY 4.0; the rest were drawn for the kids page (see `img/CREDITS.md`).

Feedback and ideas are welcome as [issues](https://github.com/RobFirth/trickywords/issues).
