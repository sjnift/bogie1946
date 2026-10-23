# Credits Roll — handover notes

This file is everything a new session needs to keep working on Credits Roll. Read it fully before changing
anything. **This repository is public: never write API keys, tokens or the owner's email into any file here.**

## What it is

A Letterboxd stats site for its owner (GitHub `sjnift`, Letterboxd `bogie1946`). It reads a Letterboxd data
export (the ZIP from Letterboxd → Settings → Data) entirely in the browser and shows stats, insights,
comparisons with friends and more, in two layouts:

- **Desktop**: a "screening programme" look (dark, gold accents, Big Shoulders Display headings), inspired by
  boxd.megolo.com and Letterboxd Pro's year pages.
- **Phone**: styled like the Letterboxd app (slate background, green/blue/orange accents, tab bar, pushed
  screens, bottom sheets).

Where it lives:
- Live site (GitHub Pages, from `docs/` on `main`): https://sjnift.github.io/credits-roll/
  (`index.html` sends phones to `mobile.html`, others to `desktop.html`; both share one origin, so one import).
- Claude versions (private artifacts): desktop https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR,
  phone https://claude.ai/artifact/2RUkgC4dsysdz66WjJ6gzb. Inside Claude, outside sites are blocked, so the
  page uses the `sample` capability (Claude fills in film details) instead of TMDB, and downloads don't work.

## The owner, and how to work with them

- Not a developer. Explain in plain words, briefly, what changed and what to do. No jargon, no code in replies.
- They want changes **live without downloading files**: commit to `main` and push; Pages deploys `docs/`.
  This is a standing request — no need to ask before pushing site changes.
- After a change, tell them the footer stamp to look for ("Updated 23 Oct 2026, 04:40 UTC") and to refresh,
  or close and reopen the installed app.
- Every feature must work on **both** layouts.
- Things they have asked for that must stay true:
  - **Never double count** (see the section below). Check it every time.
  - Records (shortest, longest, oldest film) must be right. Films only *liked* (not logged) don't count as watched.
  - Reviews come in with their formatting (paragraphs, italics, bold, links).
  - Their TMDB key is saved in the browser for good, never asked for again.
  - They **can't pay for Apify**: stay inside Apify's free plan ($5 of credit a month).
  - Every number, chart bar, poster, person and sentence opens the data behind it: a pop-up (desktop) or a
    bottom sheet (phone) first, with "See all on one page" when the list is long. The back button works.
  - Links look classy: gold text in sentences (desktop), white semibold in sentences (phone), a faint thin
    underline under bare numbers, no underlines in tables (a "click any number" line under each table instead),
    rounded tags for genres, countries, languages and cast. No white dotted underlines.
  - They like charts and data views that are accurate, clear and consistent in light and dark mode.

## Always check double counting

The owner asked for this to be checked every time. A film, diary entry, person or genre must never count twice.

- After any change that touches the data or what is counted, run `./build.sh && npm test` and make sure
  `counts` passes. It audits every total and every list a click can open, on both layouts, over the example
  diary and an export written to trip it up. A new stat or list is covered automatically once it opens through
  `drill()`; if it counts something another way, add an assertion for it to `tests/counts.test.mjs`.
- Match films across sources (export files, the daily feed, friends' exports) with `titleKey(name, year)`,
  never the exact spelling: Letterboxd writes the same title with curly or straight apostrophes, or as
  `&#039;` in its feed. `buildLibrary` already folds every spelling of a title into one film.
- Count a film's people, genres and countries once per film: wrap the lists in `new Set(...)`.
- Feed entries logged before the export's newest diary entry are already in the export and must not be added.
- Before telling the owner a change is done, say that the double-counting check passed.

## Building, checking, shipping

1. Edit files in `src/` (never edit `docs/*.html` or the built `credits-roll*.html` by hand).
2. `./build.sh` builds `docs/` (the site: both layouts, manifest, icons, service worker) and four local files
   (`credits-roll.html`, `credits-roll-mobile.html` for Claude; `*-standalone.html` to open in a browser).
   The local files are gitignored; a personal standalone build can take `TMDB_KEY=… ./build.sh` (ask the owner
   for the key; never commit it). The build refuses to finish if a key ends up in `docs/`. The footer stamp
   `<!--BUILD-->` is replaced with the build time.
3. `npm test` (first time: `npm ci`; browsers are preinstalled at `/opt/pw-browsers`, Playwright 1.56.1)
   runs `tests/*.test.mjs` against `docs/` with its own local server. `node tests/run.mjs counts feed` runs some.
   The `links` check takes about two minutes.
4. Commit with a message that says what changed for the owner; end it with the attribution lines the session
   gives you. Push to `main`.
5. Wait for GitHub: `gh run list --repo sjnift/credits-roll --limit 4` — the `Site` workflow (checks) and
   `pages-build-deployment` (publishing). Then confirm the live files match the build:
   `curl -s "https://sjnift.github.io/credits-roll/desktop.html?$(date +%s)" | cmp - docs/desktop.html` (same for mobile).
6. Update the Claude versions with the Artifact tool: publish `credits-roll.html` with
   `url: https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR` and `credits-roll-mobile.html` with
   `url: https://claude.ai/artifact/2RUkgC4dsysdz66WjJ6gzb` (in a new conversation read each one first;
   publishing without `url` would create new artifacts).
7. Tell the owner what changed, that the checks (including double counting) passed, and the footer stamp.

## How the code is laid out

`build.sh` concatenates these in order (shared files go into both layouts):

- Desktop: `01-head.html` (fonts, colour tokens, base CSS), `02-style.html` (all other desktop CSS),
  `03-body.html` (page skeleton), shared files, `07-render-a.js` (state, render(), hero, tiles, lookup box),
  `07-render-b.js` (Stats sections), `07c-insights.js`, `07d-compare.js`, `07e-reviews.js`,
  `07f-drill.js` (pop-up, full page, hash routes, back button), `08-events.js` (import, clicks, init).
- Phone: `m01-head.html` (all phone CSS), `m02-body.html`, shared files, `m03-screens.js` (state, render(),
  Profile, People), `m04-screens.js` (Diary, Films, Import, Watch next, pushed screens), `m06-insights.js`,
  `m07-compare.js`, `m08-reviews.js`, `m09-drill.js` (bottom sheet, drill screens), `m10-route.js` (hash
  routes, back button), `m05-events.js` (import, taps, init).
- Shared, in order: `04-example.js` (the example diary and example friends), `05-core.js` (helpers, storage,
  reading the export, `buildLibrary`, `reviewParts`, `cleanMeta`, `computeStats`), `06-lookup.js` (TMDB,
  OMDb, Claude lookups, `fixMatch`), `06b-charts.js` (column chart, timeline, calendar heatmap),
  `06d-letterboxd.js` (Letterboxd averages through Apify), `06c-insights.js` (`computeInsights`,
  `computeYearInsights`, `yearDrill`, `crowdDrill`), `06e-compare.js` (friends, `tasteProfile`, `comparePair`,
  `compareGroup`, `habitRows`), `06f-reviews.js` (review insights), `06g-drill.js` (the drill system and the
  film card), `06h-more.js` (daily feed merge, backups, search, On this day, Watch next, filmographies),
  `06i-share.js` (the year picture).
- `src/site/`: `manifest.webmanifest`, `sw.js` (network-first service worker; skips TMDB, OMDb, Apify),
  icons (drawn by `tools/make_icons.py`).
- `scripts/feed.mjs` and `.github/workflows/`: the daily feed and the checks (below).

### Data

- `readExport(files)` reads the ZIP or CSVs into rows: `diary, watched, ratings, reviews, likes, watchlist,
  profile, files`. Only top-level files count, plus `likes/films.csv`; `likes/` (other people's reviews you
  liked), `lists/`, `deleted/` and `orphaned/` are skipped, and a `reviews.csv` must have a Review column.
  A `.json` file is a backup and is restored instead.
- `buildLibrary(rows)` makes the library: `films` (one per film: key, name, year, rating, liked, entries,
  reviews, uri), `entries` (diary, oldest first), `reviews` (sanitised HTML + text), `profile`, `watchlistFilms`
  (film-like objects, minus films already watched). `watched.csv` and the diary decide what is seen; likes,
  ratings and reviews only mark films already there.
- `META[filmKey]`: film details from TMDB (or Claude in the artifact): `d` directors, `c` cast (top 15),
  `w` writers, `p` cinematographers, `m` composers, `g` genres, `k` countries, `l` language, `r` runtime,
  `poster`, `id`, `va/vc` TMDB score, `im` IMDb id, `ir/iv/mc/rt` IMDb, Metacritic, Rotten Tomatoes,
  `pin` (matched by hand). `metaOf(f)` reads it (example films use `EXAMPLE_META`).
- `LBX[filmKey]`: Letterboxd averages `{ r, n, slug }` or `{ tries, v: 2 }` when not found.
- `KNOWN_IDS[filmKey]`: exact TMDB ids from the feed; lookups use them first.
- Storage (`store` in `05-core.js`): small things in localStorage (API keys `cr-tmdb-key`, `cr-omdb-key`,
  `cr-apify-key`; views `cr-view-v1`, `cr-mview-v1`; `cr-letterboxd-run`); big things in IndexedDB database
  `credits-roll`, store `kv` (`cr-rows-v1`, `cr-meta-v1`, `cr-photos-v1`, `cr-letterboxd-v1`, `cr-friends-v1`,
  `cr-filmo-v1`), read into memory by `await store.init()` at start (both `init()`s), moved over from
  localStorage automatically (a localStorage copy wins: only an older page version writes one).

### Drill-downs (what a click opens)

`drill(d)` registers a description and returns an id for `data-list="…"`; `dl(d)` writes the attribute,
`dlink(d, html)` an inline link, `dline(d, html)` a clickable sentence. Kinds, built with `D.*`:
`films`, `entries`, `reviews`, `names` (people, genres, months…), `plain` (watchlist rows), `groups`
(several lists, e.g. this year against last), `film` (the film card), `search`, `share`. Ready-made ones are in
`DR.*` (streak, day, month, weekday, rating, decade, runtime…). `drillBody(d, cap)` renders any kind for both
layouts. Desktop opens them with `openDrill` (pop-up `#dlg`, Back stack, "See all" → page `#/list`);
phone with `openSheet` (sheet `#sheet`, "See all" → pushed screen). Links registered while the pop-up/sheet
paints go into `PANEL` (via `inPanel`), others into `LISTS`, which `render()` resets.

The film card shows every viewing, rating, like, review, details with linked director/genres/countries/cast,
crowd scores, links to Letterboxd, TMDB and IMDb, and "Wrong film?" (paste a TMDB or IMDb link; the match is
pinned). In Compare it shows each person's record.

### Addresses and the back button

Desktop: `#/`, `#/2024`, `#/insights`, `#/insights/2024`, `#/compare/<friend>`, `#/list`; `/film/<filmKey>`
on the end opens a card. Phone: `#/profile`, `#/diary`, `#/films`, `#/people`, `#/data`, `#/insights/2024`,
`#/compare`, `#/reviews`, `#/watchnext`, `#/list`, plus `/film/…`. Pop-ups, sheets and pushed screens are
history entries; changing year or period replaces the address instead.

## Features (all on both layouts)

- **Stats**: films, hours, diary, ratings, rewatches, reviews, most watched actors/directors/crew, genres,
  countries, languages, decades, milestones with posters, records, On this day, Watch next, Reviewed (search).
- **Insights**: all years (at a glance, year by year, changing tastes, genres, people, against the crowd,
  reviews, habits) and each year (against the year before, months, best of, people, crowd, reviews, habits).
  "Against the crowd" uses Letterboxd (Apify), IMDb/Metacritic (OMDb) or TMDB scores.
- **Compare**: add friends' export ZIPs (stored in the browser); taste match, overlap, agree/disagree, rating
  style, genres, people, watch next for each other, watch together, habits; Everyone view for 2+ friends.
- **Search** (desktop button or `/`; phone magnifier), **filmography progress** for people (TMDB person
  credits, cached 30 days), **Watch next** (watchlist ranked by a predicted rating with reasons, length filter),
  **year picture** (1080×1350 PNG, Share/Download), **backups** (download a file, import it on another device,
  optionally with API keys), **installable app** (PWA).

## Outside services

- **TMDB** (owner's key, saved in their browser): search with ±2-year tolerance and vote weighting
  (`pickHit`; Letterboxd and TMDB can disagree on a year, e.g. Brick 2005 vs 2006), details with credits.
  `TMDB_MATCH_VERSION` (3) re-looks-up films when matching changes. Watchlist films are looked up too.
- **OMDb** (free key, 1,000 films a day): IMDb, Metacritic, Rotten Tomatoes scores from the IMDb id.
- **Apify** actor `solidcode~letterboxd-scraper` for Letterboxd averages. $0.0036 per film + $0.005 per run;
  the free plan's $5 a month is about 1,300 films, so a run stops at `LB_RUN_CAP = 1300`. The first run reads
  the member's films page (`/<user>/films/`); follow-up runs ask for each missing film at both addresses
  (`/film/<slug>/` and `/film/<slug>-<year>/`, slugs built like Letterboxd's: 8½ → `8-half`). Matching is by
  title and year, then title alone, then the address asked for. Runs survive closing the page.
- **Letterboxd RSS feed** (daily, see below). Letterboxd itself has no API.

## Daily diary updates

`.github/workflows/feed.yml` runs at 06:23 UTC each day (and on demand: `gh workflow run feed.yml --repo
sjnift/credits-roll`). `scripts/feed.mjs` reads `https://letterboxd.com/<user>/rss/` for each name in
`feed-users.txt` (now `bogie1946`) into `docs/feed/<user>.json`, keeping up to 1,000 entries (the feed only
shows the latest ~50, so it accumulates), commits, and asks Pages to rebuild. The site loads
`feed/<username>.json` when the imported export's username matches and merges entries the export lacks
(`withFeed`/`myLibrary` in `06h-more.js`), never changing the saved export. The feed decodes character codes
(`&#039;`), keeps a viewing as one entry when a review is added (watch-123 → review-123), and gives exact TMDB ids.

## Checks and CI

`tests/`: `lib.mjs` (server, browser, stand-ins: papaparse/jszip served from `node_modules`, every outside
service cut off unless a check stands in for it, service worker off unless asked), `run.mjs`, and checks:
`apify`, `counts` (double counting), `extras` (year picture, On this day, Watch next, PWA), `feed`, `import`,
`links` (every link opens something), `pages` (nothing broken shows, no sideways scroll on the phone),
`routes`, `storage` (IndexedDB move, backup and restore), `tmdb` (fixing a match, filmography, search).

`.github/workflows/site.yml` runs the checks on every push. Pages currently deploys from the branch, so a
failed check only shows a red mark and an email. If the owner switches Settings → Pages → Source to GitHub
Actions (their choice; it can't be done through this environment's proxy), the same workflow publishes `docs/`
only after the checks pass, and `feed.yml` starts it after collecting new entries.

## This cloud environment's quirks

- `letterboxd.com` and `cdnjs.cloudflare.com` are blocked from the container (tests use local copies);
  TMDB, Apify's API and GitHub work. The GitHub Pages settings API is blocked through the proxy.
- GitHub Actions job logs live on blocked storage: scripts print `::error::…` lines, readable with
  `gh api repos/sjnift/credits-roll/check-runs/<job id>/annotations`.
- A background `python3 -m http.server` in `docs/` stops after two hours; the checks start their own server.
- Pushes made by a workflow's own token don't start other workflows (hence the explicit Pages rebuild).

## History worth knowing

- Brick showed as the shortest film because TMDB matched a short of the same name → year tolerance and vote
  weighting. Coney Island counted as watched because it was only liked → likes only mark logged films.
- Reviews went missing: an old cached app version dropped review text (service worker now always checks the
  server), then `likes/reviews.csv` (empty) overwrote the real `reviews.csv` → only top-level files count.
- 336 films lacked Letterboxd averages because one Apify run stops at 1,300 films → follow-up runs by address.
- Twilight's Last Gleaming counted twice in 2026: the feed wrote `Twilight&#039;s…` → `titleKey` everywhere,
  and the `counts` check now runs on every push.

## Known limits

- Inside the Claude artifacts, downloads (backup, year picture) don't work; backups are hidden there and the
  picture can be saved by right-click or long-press. Declaring the artifact `downloads` capability would fix it.
- The feed sees only the latest ~50 diary entries each day; more than that between runs needs a fresh export.
- Letterboxd averages for libraries over 1,300 films take more than one month of free Apify credit.
