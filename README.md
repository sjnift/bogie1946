# Credits Roll

Stats from a Letterboxd data export: most watched actors and directors, genres, countries, languages,
ratings, diary activity, milestones and top films. Film details and posters come from TMDB with your own API key.

- `docs/` is the site GitHub Pages serves. `index.html` opens `mobile.html` on phones and `desktop.html` elsewhere.
  Both share one import and one saved TMDB key per browser. Nothing you import leaves your browser except film titles sent to TMDB.
- `src/` holds the parts; `./build.sh` assembles `docs/` plus the Claude versions.

Not affiliated with Letterboxd. This product uses the TMDB API but is not endorsed or certified by TMDB.
