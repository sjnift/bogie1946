# Credits Roll — handover notes

This file is everything a new session needs to keep working on Credits Roll. Read it fully before changing
anything. **This repository is public: never write API keys, tokens or the owner's email into any file here.**

## What it is

A Letterboxd stats site for its owner (GitHub `sjnift`, Letterboxd `bogie1946`). It reads a Letterboxd data
export (the ZIP from Letterboxd → Settings → Data) entirely in the browser and shows stats, insights,
comparisons with friends and more, in two layouts:

- **Desktop**: a "screening programme" look (dark, gold accents, Big Shoulders Display headings), inspired by
  boxd.megolo.com and Letterboxd Pro's year pages.
- **Phone**: the Letterboxd app, modernised (rebuilt Oct 2026 after the owner found the old one "wonky and
  creaky"): Letterboxd's slate background and green/orange/blue, a profile with a blurred poster backdrop, a
  see-through header that frosts as you scroll, big bold titles, rounded cards, white year chips that stay in
  reach, five tabs, screens that slide in, bottom sheets that swipe away. Dark only.

Where it lives:
- Repository `sjnift/bogie1946` (renamed from `credits-roll` in Oct 2026; the app is still called Credits Roll, as the
  owner wants). Live site (GitHub Pages, from `docs/` on `main`): https://sjnift.github.io/bogie1946/
  (`index.html` sends phones to `mobile.html`, others to `desktop.html`; both share one origin, so one import).
  The old address sjnift.github.io/credits-roll/ no longer works (GitHub doesn't forward a renamed project site);
  browser data stayed (same origin). `repoOfPage` reads the repository from the address, and a device that updates
  the diary on the site follows the repository's current name. A session made before the rename reaches it after
  `add_repo` for `sjnift/bogie1946` and `git remote set-url origin https://github.com/sjnift/bogie1946`.
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
  - Highest-rated actors over **all time** need **6 rated films** each (`CAST_MIN_RATED`, `s.castMinRated`); a single
    year, and every other kind of person, keeps `minRated` (2, or 3 for 150+ films).
  - The best-rated decade is featured with its films' posters (phone Breakdown and desktop "Released").
  - **Their diary lives on the site, locked with a password** (see "The diary on the site"), so no device needs an
    import. Never put it there unencrypted, and never with their email address or API keys.
  - **The main page is only stats.** Admin things (the export, lookups and their keys and small print, the diary on
    the site and its GitHub key, backups, deleting data, the disclaimers) live in Settings: the desktop's Settings
    page (`#/settings`) and the phone's Settings screen (gear). The desktop main page shows at most one line
    (`#lookup-mini`) while films are looked up or still lack cast and crew, linking to Settings.
  - **No example diary** (they got stuck in it and asked for it to go): with a diary saved, the app always shows
    it; with nothing saved it shows an import screen. The made-up example only appears with `?example` in the
    address and nothing imported (`SHOW_EXAMPLE`), which the checks use. There is no switch to it.

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
5. Wait for GitHub: `gh run list --repo sjnift/bogie1946 --limit 4` — the `Site` workflow (checks) and
   `pages-build-deployment` (publishing). Then confirm the live files match the build:
   `curl -s "https://sjnift.github.io/bogie1946/desktop.html?$(date +%s)" | cmp - docs/desktop.html` (same for mobile).
6. Update the Claude versions with the Artifact tool: publish `credits-roll.html` with
   `url: https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR` and `credits-roll-mobile.html` with
   `url: https://claude.ai/artifact/2RUkgC4dsysdz66WjJ6gzb` (in a new conversation read each one first;
   publishing without `url` would create new artifacts).
7. Tell the owner what changed, that the checks (including double counting) passed, and the footer stamp.

## How the code is laid out

`build.sh` concatenates these in order (shared files go into both layouts):

- Desktop: `01-head.html` (fonts, colour tokens, base CSS), `02-style.html` (all other desktop CSS),
  `03-body.html` (page skeleton), shared files, `07-render-a.js` (state, render(), hero, tiles, the Settings page `renderSettings`, the lookup box and its one-line
  version on the stats page `renderLookupMini`),
  `07-render-b.js` (Stats sections), `07c-insights.js`, `07d-compare.js`, `07e-reviews.js`,
  `07f-drill.js` (pop-up, full page, hash routes, back button), `08-events.js` (import, clicks, init).
- Phone: `m01-head.html` (all phone CSS), `m02-body.html` (header, five-tab bar), shared files,
  `m03-screens.js` (state, `memo`, `morph`, render(), header, `goTo`/`push`/`pop`, pieces, Profile, People),
  `m04-screens.js` (Diary, Films, Genres, Settings, Watch next, pushed screens, `SCREENS`), `m06-insights.js`,
  `m07-compare.js`, `m08-reviews.js`, `m09-drill.js` (bottom sheet with swipe-to-close, drill screens),
  `m10-route.js` (hash routes, back button), `m05-events.js` (import, taps, init).
- Shared, in order: `04-example.js` (the example diary and example friends), `05-core.js` (helpers, storage,
  reading the export, `buildLibrary`, `reviewParts`, `cleanMeta`, `computeStats`), `06-lookup.js` (TMDB,
  OMDb, Claude lookups, `fixMatch`), `06b-charts.js` (column chart, timeline, calendar heatmap),
  `06d-letterboxd.js` (Letterboxd averages through Apify), `06c-insights.js` (`computeInsights`,
  `computeYearInsights`, `yearDrill`, `crowdDrill`), `06e-compare.js` (friends, `tasteProfile`, `comparePair`,
  `compareGroup`, `habitRows`), `06f-reviews.js` (review insights), `06g-drill.js` (the drill system and the
  film card), `06h-more.js` (daily feed merge, backups, search, On this day, Watch next, filmographies),
  `06i-share.js` (the year picture), `06j-site.js` (the diary kept on the site, locked with a password).
- `src/site/`: `manifest.webmanifest`, `sw.js` (network-first service worker; skips TMDB, OMDb, Apify),
  icons (drawn by `tools/make_icons.py`).
- `scripts/feed.mjs` and `.github/workflows/`: the daily feed and the checks (below).

### Data

- `readExport(files)` reads the ZIP or CSVs into rows: `diary, watched, ratings, reviews, likes, watchlist,
  profile, files`. Only top-level files count, plus `likes/films.csv`; `likes/` (other people's reviews you
  liked), `lists/`, `deleted/` and `orphaned/` are skipped, and a `reviews.csv` must have a Review column.
  A `.json` file is a backup and is restored instead.
- Saving: `store.set` writes to IndexedDB 250 ms later; imports and restores call `await store.flush()`, and the
  page flushes when it's hidden or closed. If the database can't be opened at start, `store.failed` is set and the
  import screen says so; if the saved export can't be read, `LOAD_ERROR` says why. Neither falls back to the example.
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
  `cr-apify-key`; views `cr-view-v1`, `cr-mview-v1`; `cr-letterboxd-run`; the diary on the site `cr-site-v1`, `cr-site-pub-v1`, `cr-site-dirty`); big things in IndexedDB database
  `credits-roll`, store `kv` (`cr-rows-v1`, `cr-meta-v1`, `cr-photos-v1`, `cr-letterboxd-v1`, `cr-friends-v1`,
  `cr-filmo-v1`), read into memory by `await store.init()` at start (both `init()`s), moved over from
  localStorage automatically (a localStorage copy wins: only an older page version writes one).

### The phone app's structure and speed

- Tabs: **Profile** (hero, year chips, tiles for Reviews/Watch next/Liked/Rewatches, recently watched, On this
  day, ratings, most watched people; no "Top rated" row, removed at the owner's request; gear → Settings), **Diary**, **Stats** (a segmented control:
  `films`, `people`, `genres` are three views, the last labelled **Breakdown** because it also holds countries,
  languages and decades; it opens with the best-rated decade and its posters, and ranks decades with three
  posters each; the tab remembers the last view), **Insights** (the year chips pick
  all years or one; underlined section tabs: `state.insTab` / `state.yearTab`), **Compare** (friend chips,
  section tabs `state.cmpTab`). Pushed screens (`state.stack`): `data` (Settings: import, lookups, backups,
  footer stamp), `reviews`, `watchnext`, `cat`, `drill` ("See all").
- The year chips (`scopeBar()`, `#scopes`) are the one year picker everywhere, Insights included
  (`state.scope`; there is no separate insights year any more).
- Speed (the old app redrew everything on every tap): `memo(key, fn)` keeps stats, insights, comparisons and
  timelines until the data changes (`DATA_REV`, bumped by `scheduleRender`, imports, the feed, friends and
  fixes; also lib/META/LBX/FRIENDS identity). `render()` patches the screen with `morph()` when the same screen
  redraws (posters stay loaded, side scrolls keep their place; `data-k` keys rows that move) and replaces it
  when the screen changes. Insights are worked out ahead in idle time (`warmUp`). Long lists load more as you
  scroll (`data-auto`). Each tab remembers its scroll (`SCROLL`); tapping the current tab scrolls to the top.
- Motion respects reduced motion; the checks run with reduced motion, so sheets close at once there.
- Don't give an element both a phone class and a name used by the layout (a weekday bar called `.top` once
  became fixed to the top of the screen, because `.top` is the header).

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

Desktop: `#/`, `#/2024`, `#/insights`, `#/insights/2024`, `#/compare/<friend>`, `#/list`, `#/settings`; `/film/<filmKey>`
on the end opens a card. The "Credits Roll" title (`#home-link`) goes to `#/` (the stats, all time) from any page. Phone: `#/profile`, `#/diary`, `#/films`, `#/people`, `#/genres`, `#/insights`,
`#/insights/2024`, `#/compare/<friend>` (tabs) and `#/data`, `#/reviews`, `#/watchnext`, `#/list` (pushed),
plus `/film/…`. Tabs, pop-ups, sheets and pushed screens are history entries; changing year, Stats section or
friend replaces the address instead.

## Features (all on both layouts)

- **Stats**: recently watched (8 latest entries on the desktop main page, `recentBlock`; 12 on the phone's Profile;
  a year shows its last ones), films, hours, diary, ratings, rewatches, reviews, most watched actors/directors/crew, genres,
  countries, languages, decades, milestones with posters, records, On this day, Watch next, Reviewed (search; the desktop
  main page shows the latest 3, cut short, and "All N reviews" opens the rest: `REVIEWS_SHOWN`).
- **Insights**: all years (at a glance, year by year, changing tastes, genres, people, against the crowd,
  reviews, habits) and each year (against the year before, months, best of, people, crowd, reviews, habits).
  "Against the crowd" uses Letterboxd (Apify), IMDb/Metacritic (OMDb) or TMDB scores.
- **Compare**: add friends' export ZIPs (stored in the browser); taste match, overlap, agree/disagree, rating
  style, genres, people, watch next for each other, watch together, habits; Everyone view for 2+ friends.
- **Search** (desktop button or `/`; phone magnifier), **filmography progress** for people (TMDB person
  credits, cached 30 days), **Watch next** (watchlist ranked by a predicted rating with reasons, length filter),
  **year picture** (1080×1350 PNG, Share/Download), **the diary on the site** (below), **backups** (download a file, import it on another device,
  optionally with API keys), **installable app** (PWA), **film data check** (in the lookup box / Settings:
  `dataCheck` in `06h-more.js`: "Worth a look" (TMDB year >2 years from Letterboxd's unless the match is pinned
  or from the feed, countries or language with nothing in common between TMDB and IMDb), "No TMDB match",
  "Corrected by hand" (`FILM_FIXES`), then small differences marked "not an error": TMDB a year or two apart,
  IMDb's year (OMDb gives the US release year: Spirited Away 2003, L'Âge d'or 1979), IMDb listing more
  co-producing countries or another language first. "Copy the list" gives the real problems in full and the
  small ones as counts. The app always uses Letterboxd's year and TMDB's (Letterboxd's) countries/language.)

## Outside services

- **TMDB** (owner's key, saved in their browser): search with ±2-year tolerance and vote weighting
  (`pickHit`; Letterboxd and TMDB can disagree on a year, e.g. Brick 2005 vs 2006), details with credits.
  A hit must have the same title, or nearly (`titleLike` ≥ 0.75 on the words that matter, in any script);
  beyond ±2 years only a single exact-title film is taken (`onlyTitled`: The Ear is 1970 on Letterboxd, 1990 on
  TMDB), and never one TMDB dates more than 2 years *earlier* (A Cop, 1972, had matched a 1947 film).
  `FILM_IDS` pins films TMDB's search can't find by title and year, by TMDB id (A Cop → Un flic 42741, The Ear →
  88953) or by IMDb id, turned into TMDB's through its find endpoint (Glass Onion tt11564570, Nathan for You: Finding
  Frances tt7277634, The Sorrow and the Pity tt0066904); the details then carry `via` (`fromKnownId`). A title that
  is half of TMDB's is matched too (`halfTitled`: "Glass Onion: A Knives Out Mystery"; Letterboxd's "Show: Episode"
  as TMDB's "Episode"), only as a whole title within a year. `TMDB_MISS_VERSION` (7) looks up again only films
  missed before, when matching learns to find more;
  `FILM_FIXES` (by TMDB id, with a `why`) corrects facts TMDB has wrong (The Prowler 1951 is American; Breaking
  the Waves is in English; The Battle of Algiers in French). A film's language is TMDB's original language unless
  it's spoken in exactly one other (`spokenIn`). Every TMDB country is kept (it used to stop at 6, which made
  lists differ from Letterboxd's). `TMDB_MATCH_VERSION` (6) re-looks-up films when matching changes; from 6 on, a
  film whose match is unchanged keeps its details without a second request. Watchlist films are looked up too.
- **OMDb** (free key, 1,000 films a day): IMDb, Metacritic, Rotten Tomatoes scores from the IMDb id, plus IMDb's
  year, countries and languages (`iy`, `ik`, `il`; `inf` when IMDb doesn't know the id). Films fetched before
  those were kept are fetched again, a day's allowance at a time.
- **Apify** actor `solidcode~letterboxd-scraper` for Letterboxd averages. $0.0036 per film + $0.005 per run;
  the free plan's $5 a month is about 1,300 films, so a run stops at `LB_RUN_CAP = 1300`. The first run reads
  the member's films page (`/<user>/films/`); follow-up runs ask for each missing film at both addresses
  (`/film/<slug>/` and `/film/<slug>-<year>/`, slugs built like Letterboxd's: 8½ → `8-half`). Matching is by
  title and year, then title alone, then the address asked for. Runs survive closing the page.
- **Letterboxd RSS feed** (daily, see below). Letterboxd itself has no API.

## The diary on the site (password-protected)

The owner wanted the site itself to hold their diary, so no device needs an import (a private-repo sync was built
first and replaced at their request). They chose: **only them, with a password**, put there by **a button in the
app**. `06j-site.js`:
- `docs/diary/` in this repository: `index.json` (in the clear: `user`, `imported`, `at`, `from`, PBKDF2 `salt`
  and `iter` (600,000), `check`, and when each part last changed) and three encrypted parts, `rows.bin` (the
  export), `meta.bin` (film details), `extra.bin` (photos, Letterboxd averages, friends). Each part is one byte of
  kind (2 = gzipped), a 12-byte IV, then AES-GCM. **Never** put the parts in the clear, the export's email address
  (`siteRows` keeps only Username, Date Joined, Given and Family Name, for friends too) or any API key on the
  site. The `site` check decrypts what goes up and fails on either.
- Putting it there: Settings (phone) or the foot of the page (desktop) → "Put my diary on the site": a password
  (10+ characters) and a fine-grained GitHub key for this repository (Contents: Read and write) that stays in that
  browser (`cr-site-pub-v1`). Each update is one commit through the git data API (`force: false`; on 422 it reads
  the repository again, brings in the other device's change, merges, retries). Only parts whose content hash
  (`canon` + SHA-256, compared with `SITE.sums`) changed are sent.
- Then it goes up by itself (`STORE_HOOK`): a new import or friend within seconds; film details and averages after
  lookups finish, at most twice a day (`SITE_META_EVERY`), because each update adds a copy to the repository's
  history. "Update the site now", "Change the password", "Take my diary off the site" (deletes `docs/diary/`;
  nothing goes up again until it's put back), "Forget the GitHub key".
- Opening it: any device with nothing imported shows "@user's diary is on this site" with a password box; the key
  made from it is kept (`cr-site-v1`), the parts are read from the site (`diary/<part>.bin?v=<when>`) and saved
  like an import, and later starts (and coming back to the app after 10 minutes) fetch only changed parts. A device
  with its own older import of the same user shows the box on Profile (phone) / at the top (desktop). The site's
  import replaces this device's when it is newer or came from the site; details, averages, photos and friends are
  merged (`mergeMeta` keeps the better match). The daily feed still adds new entries on top.
- The app commits to `main`, so **`git pull` before working here**. `site.yml` ignores `docs/diary/**`, the
  service worker leaves `diary/` alone, and `build.sh` never touches it. Hidden in the Claude artifacts and in
  files opened from disk (`SITE_ON`). Checks see no diary on the site unless they stand in for it (`lib.mjs`).

## Daily diary updates

`.github/workflows/feed.yml` runs at 06:23 UTC each day (and on demand: `gh workflow run feed.yml --repo
sjnift/bogie1946`). `scripts/feed.mjs` reads `https://letterboxd.com/<user>/rss/` for each name in
`feed-users.txt` (now `bogie1946`) into `docs/feed/<user>.json`, keeping up to 1,000 entries (the feed only
shows the latest ~50, so it accumulates), commits, and asks Pages to rebuild. The site loads
`feed/<username>.json` when the imported export's username matches and merges entries the export lacks
(`withFeed`/`myLibrary` in `06h-more.js`), never changing the saved export. The feed decodes character codes
(`&#039;`), keeps a viewing as one entry when a review is added (watch-123 → review-123), and gives exact TMDB ids.

## Checks and CI

`tests/`: `lib.mjs` (server, browser, stand-ins: papaparse/jszip served from `node_modules`, every outside
service cut off unless a check stands in for it, service worker off unless asked, reduced motion, pages opened
with `?example` (pass `example: false` for an empty browser; a check's own `goto` must add `?example` too),
`phoneTour()` which opens every phone tab, Stats view and Insights/Compare section), `run.mjs`, and checks:
`apify`, `check` (film data check), `counts` (double counting), `reviews` (missing review text spotted; six-film actors), `welcome` (no example diary; import saved at once), `extras` (year picture, On this day, Watch next, PWA), `feed`, `import`,
`links` (every link opens something), `pages` (nothing broken shows, no sideways scroll on the phone),
`routes`, `storage` (IndexedDB move, backup and restore), `site` (the diary on the site: a stand-in GitHub and site),
`tmdb` (fixing a match, filmography, search). `lib.mjs` also cuts off api.github.com and jsdelivr, and answers
`diary/` with "not found".

`.github/workflows/site.yml` runs the checks on every push. Pages currently deploys from the branch, so a
failed check only shows a red mark and an email. If the owner switches Settings → Pages → Source to GitHub
Actions (their choice; it can't be done through this environment's proxy), the same workflow publishes `docs/`
only after the checks pass, and `feed.yml` starts it after collecting new entries.

## Cross-checking film data from a session

The owner wants discrepancies (release year, country, language) between Letterboxd, TMDB and IMDb caught in
the chat too. Their diary only lives in their browser, so they upload the export ZIP (or a backup `.json`) to
the session. Keys come from the environment, set by the owner in the environment's settings: `TMDB_KEY` and
`OMDB_KEY` (OMDb is IMDb's data; imdb.com and letterboxd.com themselves are blocked here). Never ask for a key
in the chat and never write one into a file. Node's fetch needs `NODE_USE_ENV_PROXY=1` here. Match films the
way the app does (`pickHit`/`onlyTitled` in `06-lookup.js`), and remember OMDb's free key allows 1,000 films a
day, shared with the owner's own app. The in-app version is the "Check film data" box (`dataCheck`).

## This cloud environment's quirks

- `letterboxd.com` and `cdnjs.cloudflare.com` are blocked from the container (tests use local copies);
  TMDB, Apify's API and GitHub work. The GitHub Pages settings API is blocked through the proxy.
- GitHub Actions job logs live on blocked storage: scripts print `::error::…` lines, readable with
  `gh api repos/sjnift/bogie1946/check-runs/<job id>/annotations`.
- A background `python3 -m http.server` in `docs/` stops after two hours; the checks start their own server.
- Pushes made by a workflow's own token don't start other workflows (hence the explicit Pages rebuild).

## History worth knowing

- Brick showed as the shortest film because TMDB matched a short of the same name → year tolerance and vote
  weighting. Coney Island counted as watched because it was only liked → likes only mark logged films.
- Reviews went missing: an old cached app version dropped review text (service worker now always checks the
  server), then `likes/reviews.csv` (empty) overwrote the real `reviews.csv` → only top-level files count.
  Then again (Oct 2026): a saved export without review text went unnoticed because the daily feed's few reviews
  had words → `reviewTextMissing` looks only at the export's reviews (feed ones carry `feed: true`), the note
  says to download a fresh export, and the Review column is found whatever its spacing or capitals.
- 336 films lacked Letterboxd averages because one Apify run stops at 1,300 films → follow-up runs by address.
- Twilight's Last Gleaming counted twice in 2026: the feed wrote `Twilight&#039;s…` → `titleKey` everywhere,
  and the `counts` check now runs on every push.
- The Ear (1970) showed under UK and English: TMDB's search for "The Ear" in 1970 offered other films, and the
  matcher took the most-voted (When Dinosaurs Ruled the Earth) without checking the title → titles must
  match (version 4). Checked against 74 real titles (old noirs, foreign titles, punctuation): only The Ear changed.
- The owner's first full data check (1,556 films, Oct 2026) listed 445 differences; the real problems were A Cop
  (wrong match), The Prowler, Breaking the Waves, The Battle of Algiers (TMDB errors) and the 6-country cap.
  The rest were release-date conventions and co-production lists, now shown as "not an error".
- Three films had no TMDB match (Oct 2026): Glass Onion (TMDB adds ": A Knives Out Mystery"), Nathan for You:
  Finding Frances, The Sorrow and the Pity → pinned by IMDb id, plus half-title matching.
- The owner asked for admin things off the main page (Oct 2026) → the desktop Settings page.
- The phone app was rebuilt in Oct 2026 (new tabs, sections, speed). With a 1,400-film diary on a slowed CPU,
  opening Insights went from about 1.5 s to about 50 ms, and taps generally take under 0.1 s.

## Known limits

- Putting the diary on the site needs a GitHub key, which can expire (the owner was told to pick the longest
  expiry); when it does, the box says the key wasn't accepted and the owner makes a new one the same way.
- Each update of the diary on the site stays in the repository's history (a few hundred KB each, so maybe
  100–200 MB a year at most). If the repository ever gets too big, the history of `docs/diary/` can be squashed.
- A forgotten password can't be recovered: the device that puts the diary there changes it (it keeps the key).
- Inside the Claude artifacts, downloads (backup, year picture) don't work; backups are hidden there and the
  picture can be saved by right-click or long-press. Declaring the artifact `downloads` capability would fix it.
- The feed sees only the latest ~50 diary entries each day; more than that between runs needs a fresh export.
- Letterboxd averages for libraries over 1,300 films take more than one month of free Apify credit.
