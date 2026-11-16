# Upstream

Both games come from the kids page of [RobFirth/RobFirth.github.io](https://github.com/RobFirth/RobFirth.github.io), `static/kids/`. That page is the source: changes are made and tested there first, then copied here unchanged.

## Keeping the copy in step

- **`upstream.json`** is the lock file. It names the source (`source`), the files copied byte for byte (`copy`), and records the source commit, a SHA-256 for every copied file (`files`) and the data fingerprint (`data`).
- **`npm run sync -- <path to a checkout of RobFirth.github.io>`** (in `tests/`) copies the files from a clean checkout, removes any a pattern covers that the source no longer has, rewrites `upstream.json` and the summary below, and reports what changed. It refuses to run if the checkout has uncommitted changes.
- `data/words.js` is never copied, because its Flashcards labels differ. Sync compares its **data fingerprint** with the source's and, if they differ, says so and exits with an error so the change can be brought across by hand.
- **`npm test`** checks every copied file and the fingerprint against `upstream.json`.
- **The "Upstream check" workflow** (`.github/workflows/upstream-check.yml`) runs weekly and on demand. It fetches the source's `main` and fails if any copied file or the fingerprint differs. GitHub emails the failed run, which is the prompt to sync.

The data fingerprint is the sha256 of `JSON.stringify({ modes: flashModes.map(m => m.id), decks: flashDecks.map(({ label, ...d }) => d), matchSets })`. It covers the Flashcards mode ids and every deck's id, mode, colour, tint and words, but not their labels, and the Match sets whole.

## Summary

<!-- sync:start -->
_Written by `npm run sync`; do not edit by hand._

- **Source**: `RobFirth/RobFirth.github.io`, `static/kids/`, commit `841f4d0` (2026-11-16)
- **Copied files**: 44, each byte-for-byte
- **Data fingerprint**: `0a6adb6a84e906c6f7fa56025606d5928f5bf61ce0c4cdf8ede00b74786f3c20`

| File | sha256 |
|---|---|
| `games/flashcards.js` | `0fc0eea48cbab3c267c48e7ae30b4101c9ac9684551188edeaf85a6f369120cf` |
| `games/match.js` | `fad961e9db4d624a0d33e9a83eaf0b5c6eb5b7378541e342f65c99714ea7fa72` |
| `img/words/ant.svg` | `b7cfb5d596c82ab8d4c8af0e0f7cf7715bb644f0692bded2ab6e9c181c16dd1f` |
| `img/words/bag.svg` | `951d12e5b8a99a80533c33049699d3ebcb628e560b89d5597d8d814f17040658` |
| `img/words/ball.svg` | `52471c703b0e0c88c386be97d17eac544c0a98fe40e2c84ba4086a3343c7cd39` |
| `img/words/bat.svg` | `15e1e1bac9988be3960759f24289e3a5bfb04ad0a42a88f1ab10680df1bfa61c` |
| `img/words/bed.svg` | `dcc1fb41f2bf8d3a50e19e200cc288725d2b3f2190de8f3b50714e16ebb3b366` |
| `img/words/bell.svg` | `5f70fb8150f0a1f184b40f86d012db040d229056b9b0d8c681f08987cb124e5f` |
| `img/words/bin.svg` | `ce1798b308cf8bf8dfb8a6796e2680e37b57c153d5da2db4846ca8f14e7fc50a` |
| `img/words/bus.svg` | `7fce1e44dba22837c7c5a0f4c62ed4c01b79def2d3b962f6361c4169358c21cc` |
| `img/words/cap.svg` | `4c8de148f2e0ee1ac72587acd2e7d99d39042e1a87a07025a998bbac86014f8b` |
| `img/words/cat.svg` | `d292efbd5e00fcf7c8aee855a5ec5846553236dd8e6c28777832a82fb04d578c` |
| `img/words/cot.svg` | `85486d47474d0a865a10aea9270ad4f4b2ae560f9fa0692c15c09e264b85f085` |
| `img/words/cup.svg` | `8657c71a7c3f8583c25f5392db2c7fec00677c57a7ac955a367387b00d1c4f47` |
| `img/words/dog.svg` | `632fc09dba15d0701ede125193205b9f0968ba54927166e851a20c6f431965e2` |
| `img/words/doll.svg` | `622eb7ff5748a278ddf6b2ce5015951b5760efb143d54637df19dd4e04210e0e` |
| `img/words/duck.svg` | `74114f0e02acbd2a91b55f72e597c27d5c8da1fe2d03910ccd17a5180102c89b` |
| `img/words/fan.svg` | `74d4f0994e7eeac16e053520ab150ac268dff08d647c555aade107d876dfb425` |
| `img/words/hat.svg` | `1f83167c3b009f82b11d546976c0a8ef32834a3ca435a8751c113d96be1ad034` |
| `img/words/hill.svg` | `5fbe5a1e24f25483b738db8f7fbe642130d7e137c841739836afd6c44c793935` |
| `img/words/kiss.svg` | `a8b89a9cf527dda297f2f59c8bfbb5b9166f7c6a823ece83f1b60bb916f46572` |
| `img/words/leg.svg` | `9e1120c60d9de70ed4da95a3c06f5697ac5d9f7f62d37e239df27ef1fc2dac52` |
| `img/words/map.svg` | `b77fd1cd1c0e226cc02a9e52157529eb38267cc6a9a5b544e10488c606741eb5` |
| `img/words/mat.svg` | `a922f880b3e6fb3a42ec68b817375bf25c3d28cdd6e034c7113ee2b4aa1b8775` |
| `img/words/mop.svg` | `8f3db5a62f7bf40a831b7067b4c104998c18eedc4614ffb08373c99c2189ff36` |
| `img/words/nap.svg` | `f3f17ba0097e1445616e4540132d3f7ef3c203936cb250de9228aec8234630a3` |
| `img/words/net.svg` | `92227fae00ac35991744cd98d477d3b59089572099b6878420d4f3ffa9128138` |
| `img/words/pan.svg` | `7139ef622db6e2eca3c723a74e9b273b28b9464d480e86b0941057e988e30271` |
| `img/words/pen.svg` | `e443e632207b1bff6579fddd794cf95d957c0720ea6aa0d88d7ce4415c65d2df` |
| `img/words/pig.svg` | `0ff3bbb78d83d494ac21abbc63e95f1db5ea594c82f8efe4e3b08cf85d104642` |
| `img/words/pin.svg` | `227d1b1d41bb4059230bd8400e89f73ce79d7cb3fc35dd471a40683ba3a1d6fc` |
| `img/words/pot.svg` | `4ba490144d901f72243d4eba7a22b66f51515c13b794924268fdc64d93770fc7` |
| `img/words/rat.svg` | `8bfbece3bc1d503247a8f7ba2ea9539534998fdc196b1aab974eef66a1f97a61` |
| `img/words/sack.svg` | `0192a0c57f6462ed9051b49375b6a16c944a9b8e5f9eab405b6c5fc9e589bc80` |
| `img/words/sock.svg` | `6303c4d2170818213889bf9d2771b60574b89597f3ae6a6e96733f98c6b02f36` |
| `img/words/sun.svg` | `8f08ac47cae81db8f28d8845c09d0dade8c42d152449a0e11de302e6b2f17661` |
| `img/words/tap.svg` | `09872664315b217dd52cf5418038b6255ee7d57db03abdd732baa255ab573d3f` |
| `img/words/tick.svg` | `e98cb75b135ff35e1d3c27667101fc6ac910aa2c7e6b52ff09d06c537f4de8d6` |
| `img/words/tin.svg` | `50e6181df9a6f8a6a37ca3188d99a326fef1ea47c9da36f17d8895724e6d72da` |
| `img/words/well.svg` | `e3e2b98a21afd654f886a852384e3c77a8a297c022e5edc89dd9205aa236a669` |
| `img/card-back.svg` | `215e92f83cc182d5430981b1b46732f6214c112740714b0d887f05f3fbba5114` |
| `img/match.svg` | `bf8b6826015e4bdfb1be996794eceda8f30cd791bada8eb52bb8a9bd00013624` |
| `img/flashcards.svg` | `42d7c93beef7dc6a07e644fa00ec59d84da924d3fdd73ae7785a0bc7df103776` |
| `img/CREDITS.md` | `46756728c722e71f20afe0134ab4364439f17fad68222422fe1903bebffd0966` |
<!-- sync:end -->

## What differs from the source

| File | Difference |
|---|---|
| `games/*.js`, `img/words/*.svg`, `img/card-back.svg`, `img/match.svg`, `img/flashcards.svg`, `img/CREDITS.md` | None: byte-for-byte copies |
| `data/words.js` | `matchSets` and `pictureFor` unchanged. Flashcards labels: modes "Reception", "Year 1", "Year 2" (source: "Tricky (R)", "Tricky (1)", "Tricky (2)"); Reception decks "Tricky 1"–"Tricky 3" (source: "Yellow", "Purple", "Green"). Ids, words, colours and tints unchanged. |
| `shell.js` | New. No Firebase, sign-in, roles, family link or picture sheet. Settings, speech helper, menu, game host, grown-ups corner and its 2 s hold reused from the source's `shell.js`; key `trickywords-settings`. Menu tiles are labelled by the shell ("Tricky words", "Picture match"). Adds the menu's "i" panel and the About section, which Flashcards also shows through `ctx.info`. |
| `index.html` | New. Menu (with the licence footer) and game views, grown-ups corner with Sound and Timer only; Andika and icons self-hosted; no `/family/` link. |
| `trickywords.css` | `static/kids/kids.css` unchanged, minus the sign-in, loading and picture-sheet rules. Adds local `@font-face`, and a final "This site only" section: the menu "i" and its panel (the Flashcards bubble's classes, placed beside the menu cog), the licence footer, smaller menu tiles on screens ≤ 380 px wide or ≤ 420 px tall, centred mode labels; on screens ≤ 380 px wide "Reception" on its own row in the grown-ups panel, 22 px deck names and a tighter Match top bar (count and timer side by side; the source page overlaps them at 320 px); on screens ≤ 360 px an 18 px picker heading between Home and "i". |
| `img/icon.svg`, `img/favicon.svg`, PNG icons | `icon.svg` and `favicon.svg` equal `img/flashcards.svg`; the PNGs are made from it by `tests/make-icons.js`. |
| `fonts/` | Andika 7.000 Regular and Bold woff2 and `OFL.txt`, unmodified, from SIL's release (github.com/silnrsi/font-andika). The source page loads Andika from Google Fonts. |
| `LICENSE.txt` | A served copy of `LICENSE` (a file with no extension downloads instead of opening). |
