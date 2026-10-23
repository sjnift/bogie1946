# Credits Roll

Stats from a Letterboxd data export: most watched actors and directors, genres, countries, languages,
ratings, diary activity, milestones and top films. Film details and posters come from TMDB with your own API key.

Live at https://sjnift.github.io/bogie1946/.

- `docs/` is the site GitHub Pages serves. `index.html` opens `mobile.html` on phones and `desktop.html` elsewhere.
  Both share one import and one saved TMDB key per browser. Nothing you import leaves your browser except film titles sent to TMDB.
- `src/` holds the parts; `./build.sh` assembles `docs/` plus the Claude versions.

Not affiliated with Letterboxd. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Checks

`npm ci && npx playwright install chromium && ./build.sh && npm test` runs the checks in `tests/` against the built site.
They run on every push (`.github/workflows/site.yml`). To publish only after they pass, set Settings → Pages → Source to
GitHub Actions; the same workflow then deploys `docs/`.

## Daily diary updates

`.github/workflows/feed.yml` reads the public Letterboxd RSS feed of each username in `feed-users.txt` once a day into
`docs/feed/`, and the site adds those entries to a matching imported diary. Entries collected there are public on the site.
