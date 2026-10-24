# Credits Roll — handover notes

This file is everything a new session needs to keep working on Credits Roll. Read it fully before changing
anything. **This repository is public: never write API keys, tokens or the owner's email into any file here** — the one
exception, at the owner's request (Oct 2026), is their TMDB, OMDb, Apify and GitHub keys inside the *encrypted* diary
on the site (`docs/diary/keys.bin`). Never in the clear, with one more exception the owner asked for (Oct 2026): their
**TMDB key only**, in `docs/share.json`, put there by the app when they turn on "Share my TMDB key with visitors" in
Settings (see "Sharing the TMDB key with visitors"). Never write it there yourself, and never any other key. And one
in-the-clear file of diary data the owner asked for (Oct 2026): `docs/taste.json`, their films with ratings and likes
and their username only, put there by the app when they turn on "Let visitors compare with me" (see "Comparing with
the owner"). Never write it yourself.

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
  - Their TMDB key is saved in the browser for good, never asked for again. Their TMDB, OMDb and Apify keys travel to
    every device that opens the diary on the site, so they never type them twice.
  - They **can't pay for Apify**: stay inside Apify's free plan ($5 of credit a month).
  - **Visitors use the owner's TMDB key** (asked Oct 2026): anyone who opens the site and imports their own export gets
    cast & crew looked up with it, without typing a key, once the owner has turned sharing on in Settings. Only the
    TMDB key is shared, never OMDb (its 1,000-a-day allowance is theirs), Apify (it costs money) or GitHub.
  - Every number, chart bar, poster, person and sentence opens the data behind it: a pop-up (desktop) or a
    bottom sheet (phone) first, with "See all on one page" when the list is long. The back button works.
  - Links look classy: gold text in sentences (desktop), white semibold in sentences (phone), a faint thin
    underline under bare numbers, no underlines in tables (a "click any number" line under each table instead),
    rounded tags for genres, countries, languages and cast. No white dotted underlines.
  - They like charts and data views that are accurate, clear and consistent in light and dark mode.
  - Highest-rated actors over **all time** need **6 rated films** each (`CAST_MIN_RATED`, `s.castMinRated`); a single
    year, and every other kind of person, keeps `minRated` (2, or 3 for 150+ films).
  - The best-rated decade is featured with its films' posters (phone Breakdown and desktop "Released").
  - **Insights is a study of the diary, not a repeat of the Stats page** (they found the old one inadequate and
    repetitive, Oct 2026): what stood apart and when, how taste moved, what ratings follow and why, how one film led to
    another, and habits with what they explain. No counts or top lists the Stats page already shows (the `study` check
    looks for them). It's worked out in the browser with no AI: they were offered Claude writing it through an
    Anthropic API key (about 20–50 cents a study) and chose to keep it free.
  - **The Stats page has every number; Insights has only findings** (asked Oct 2026): the numbers the old Insights page
    had (year by year, genres year by year and as you rate them, people over the years, against the crowd, habits,
    review numbers; for a year, against the year before and what was new) moved to the Stats page on both layouts, and
    are not shown again on Insights.
  - **Their diary lives on the site, locked with a password** (see "The diary on the site"), so no device needs an
    import. Never put it there unencrypted, and never with their email address (the keys go in their own encrypted part).
  - **No "main computer"**: every device where the password was typed is equal. It updates the site, and what any
    device looks up (TMDB, OMDb) reaches the others, so nothing is looked up twice and their allowances aren't spent
    on films another device already found.
  - **The main page is only stats.** Admin things (the export, lookups and their keys and small print, the diary on
    the site and its GitHub key, backups, deleting data, the disclaimers) live in Settings: the desktop's Settings
    page (`#/settings`) and the phone's Settings screen (gear). The desktop main page shows at most one line
    (`#lookup-mini`) while films are looked up or still lack cast and crew, linking to Settings.
  - **Friends use the site too** (Oct 2026: "personal record keeping and sharing with my friends so that they can
    analyse their own Letterboxd data"). A first visit leads with importing your own export and a privacy line; the
    owner's password box is folded into "Are you @user? Open your diary" below it (`owner-open`), and owner-only things
    (the daily feed's GitHub step, "Put your diary on this site" without the GitHub key) stay hidden or folded for
    others. Shared links show a preview (title, line, `og.png`).
  - **Sharing with friends** (asked Oct 2026): pictures as a feed post (1080×1350) or a story (1080×1920) of a year,
    of all time and of a taste match with a friend; the year (or all time) as a tap-through story; and, if the owner
    turns it on, visitors compare with the owner in one tap.
  - **Filters** (asked Oct 2026): genre, decade, country, language narrow every stat and list on the desktop main page
    and the phone's Profile, Diary and Stats (and what they open), never Insights or Compare (`06l-filter.js`).
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
  `07-render-b.js` (Stats sections, placed in chapters by `renderSections` with the menu that stays at the top,
  `#jump`; `foldTies` turns four or more with the same count into one row), `07-render-c.js` (more Stats sections, the numbers from the old Insights page:
  `moreSections` places year by year, genres year by year, genres as you rate them, people over the years, against
  the crowd, habits, review numbers, and for a year against the year before and new in the year; `homeInsights`
  keeps `computeInsights`/`computeYearInsights` in `HOME_INS` until the data changes), `07c-insights.js` (the study),
  `07d-compare.js`, `07e-reviews.js`,
  `07f-drill.js` (pop-up, full page, hash routes, back button), `08-events.js` (import, clicks, init).
- Phone: `m01-head.html` (all phone CSS), `m02-body.html` (header, five-tab bar), shared files,
  `m03-screens.js` (state, `memo`, `morph`, render(), header, `goTo`/`push`/`pop`, pieces, Profile, People),
  `m04-screens.js` (Diary, Films, Genres, Settings, Watch next, pushed screens, `SCREENS`), `m04b-stats.js` (Stats ›
  Years and Stats › Crowd, genres as you rate them for Breakdown, habits for Films; `allInsights`/`yearInsights`),
  `m06-insights.js` (the study),
  `m07-compare.js`, `m08-reviews.js`, `m09-drill.js` (bottom sheet with swipe-to-close, drill screens),
  `m10-route.js` (hash routes, back button), `m05-events.js` (import, taps, init).
- Shared, in order: `04-example.js` (the example diary and example friends), `05-core.js` (helpers, storage,
  reading the export, `buildLibrary`, `reviewParts`, `cleanMeta`, `computeStats`), `06-lookup.js` (TMDB,
  OMDb, Claude lookups, `fixMatch`), `06b-charts.js` (column chart, timeline, calendar heatmap),
  `06d-letterboxd.js` (Letterboxd averages through Apify), `06c-insights.js` (`CROWDS`, `crowdDrill`, `defaultCrowd`,
  and `computeInsights`/`computeYearInsights`, the numbers behind the Stats page's moved sections and the year picture), `06e-compare.js` (friends, `tasteProfile`, `comparePair`,
  `compareGroup`, `habitRows`), `06f-reviews.js` (review insights), `06g-drill.js` (the drill system and the
  film card), `06h-more.js` (daily feed merge, backups, search, On this day, Watch next, filmographies),
  `06i-share.js` (the pictures to share: `D.share(year or "all")`, `D.shareMatch(friend)`, `drawYear`, `drawMatch`,
  `SHARE_SIZE` feed or story, always the whole diary via `shareLib`), `06j-site.js` (the diary kept on the site, locked with a password),
  `06k-study.js` (Insights: `computeStudy`, `computeYearStudy`, and the pieces both layouts draw, `driftCols`,
  `chapterStrip`; see "Insights, the study"; also `crowdOf`, the Stats page's against-the-crowd numbers),
  `06l-filter.js` (filters: `FILTER`, `filteredLib`, `filterBar`, `filterText`; see "Filters"), `06m-story.js` (the
  story: `D.story`, `storyBodyHtml`, `fillStory`, `storyFindings`).
- `src/site/`: `manifest.webmanifest`, `sw.js` (network-first service worker; skips TMDB, OMDb, Apify),
  icons (drawn by `tools/make_icons.py`), `og.png` (the link preview, 1200×630, drawn from `tools/og.html` by
  `node tools/make_og.mjs`; `build.sh` puts its tags, `PREVIEW`, on all three pages).
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
  day, ratings, most watched people; no "Top rated" row, removed at the owner's request; gear → Settings), **Diary**, **Stats** (a segmented control
  of five views: `films` (highest and lowest rated, milestones, rewatched, records, habits, review numbers),
  `people`, `genres` labelled **Breakdown** because it also holds countries, languages, decades and genres as you
  rate them (it opens with the best-rated decade and its posters, and ranks decades with three posters each),
  `years` (year by year, genres year by year, people over the years; for a year, against the year before and what
  was new) and `crowd` (labelled **vs. Others**); the tab remembers the last view), **Insights** (the year chips pick
  all years or one; underlined section tabs: `state.insTab` (`INS_TABS`) / `state.yearTab` (`YEAR_TABS`)), **Compare** (friend chips,
  section tabs `state.cmpTab`). Pushed screens (`state.stack`): `data` (Settings: import, lookups, backups,
  footer stamp), `reviews`, `watchnext`, `cat`, `drill` ("See all").
- The year chips (`scopeBar()`, `#scopes`) are the one year picker everywhere, Insights included
  (`state.scope`; there is no separate insights year any more). On Profile, Diary and Stats the filters follow them
  (`FILTER_VIEWS`); `render()` keeps the whole diary in `BASE_LIB` and narrows `state.lib`.
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
`#/years`, `#/crowd`, `#/insights/2024`, `#/compare/<friend>` (tabs) and `#/data`, `#/reviews`, `#/watchnext`, `#/list` (pushed),
plus `/film/…`. Tabs, pop-ups, sheets and pushed screens are history entries; changing year, Stats section or
friend replaces the address instead.

## Features (all on both layouts)

- **Stats**: recently watched (8 latest entries on the desktop main page, `recentBlock`; 12 on the phone's Profile;
  a year shows its last ones), films, hours, diary, ratings, rewatches, reviews, most watched actors/directors/crew, genres,
  countries, languages, decades, milestones with posters, records, highest and lowest rated, On this day, Watch next,
  Reviewed (search; the desktop main page shows the latest 3, cut short, and "All N reviews" opens the rest:
  `REVIEWS_SHOWN`) and, from the old Insights page, year by year, genres year by year and as you rate them, people over
  the years, against the crowd, habits, review numbers, and for a year against the year before and new in the year.
  "Against the crowd" uses Letterboxd (Apify), IMDb/Metacritic (OMDb) or TMDB scores.
- **Filters**: genre, decade, country and language menus (each choice says how many films it leaves, given the other
  filters; genres, countries and languages need cast & crew) under the year chips. `filteredLib` gives a library of the
  films that pass, with their entries, reviews and watchlist, kept as the same object while nothing changes so the
  pages' caches hold; everything is worked out from it as from the whole diary. They last until the page is closed.
  The `counts` check picks the commonest genre and decade on both layouts and proves every list holds only films that
  pass, each once.
- **Insights**: a study of the diary (below), findings only: all years (in short, chapters, how taste has moved, what
  ratings follow, one film to the next, habits) and each year against the rest of the diary (in short, what set it
  apart, its months, ratings, threads, habits, the year picture).

### Insights, the study (`06k-study.js`)

Taste is read from first watches (`studyBase`: each film once, as first seen; `newDir` when none of its directors
had been seen), habits from every entry. A finding is said only when it's big enough to matter and `STUDY_Z` (3)
standard errors or more from what the rest of the diary gives; every sentence opens its films through `drill()`.
- Periods (`pickUnit`, `studyPeriods`): quarters, halves or years, whichever holds a few dozen films each.
- Chapters: periods whose films stand out against the rest of the diary (`standouts`: a genre, decade, language,
  country, director or actor far over its usual share) are joined while they stand out for the same thing; up to six
  months is a "season", longer a "phase". A seasonal habit (horror every October) isn't also a chapter (`notSeasonal`).
- Drifts: shares and typical values per period (genres, not in English, languages, new releases, new directors, age
  when watched, length, popularity, the crowd's score, range of countries), fitted with a weighted line for whether
  it's real (`fitLine`, t ≥ 3), but said with what was actually watched in the first and last third.
- Ratings: what they follow (each film's rating guessed from the others sharing a director, decade…, never itself;
  the share of the ups and downs that removes), what's liked beyond reputation (rating against the one the crowd's
  score predicts, by genre, decade, language, country, a director, length, popularity…), tougher or choosier (your
  ratings and the crowd's view of the same films, early against late; a lower bar, t ≥ 2.5), directors who never let
  you down or divide you.
- Threads: doors that opened (four or more by one person within 120 days), chains (each film sharing someone with one
  seen in the ten days before). Habits: weekends, a genre's month, a month for
  rewatching, comfort after a break, busy against quiet months, marathon days, logging and rating over time, second looks.
- It works for any account's export. Without film details (no TMDB key) it still finds decades, release-year
  drifts, ratings by decade and timing, and every habit; genres, countries, people and threads need cast & crew.
- Speed: about 0.5 s for 2,000 films on a phone slowed four times; the phone works it out in idle time (`warmUp`) and
  keeps it (`memo`: `study|crowd`, `ystudy|year|crowd`); the desktop keeps it until the data changes (`STUDY_CACHE`).
- **Compare**: add friends' export ZIPs (stored in the browser); taste match, overlap, agree/disagree, rating
  style, genres, people, watch next for each other, watch together, habits; Everyone view for 2+ friends.
- **Charts** (`colChart`): `{ unit }` names what the gridline counts ("20 films", "50 h", "20%"); averages (rating by
  year) are drawn with `{ values, base }`, their numbers over columns that start just under the lowest (`valuesBase`).
  Poster title cards shrink long words instead of breaking them (`titleFit`).
- **Pictures to share** (`06i-share.js`): a year, all time (desktop hero and phone Profile, "share it as a picture";
  the desktop's Insights year, the phone's Insights year) or a taste match (Compare, both layouts), as a feed post or a
  story, chosen with two chips over the picture. Drawn on a canvas; posters that can't be copied leave title cards.
- **The story** (`06m-story.js`, "▶ Play … as a story" beside the picture links): cards for the numbers, the highest
  rated, the director and the face of the year, genres, when you watched, what stood out (the study's headline
  findings, worked out after the first card shows) and a last card that makes the picture. It opens in the pop-up
  or the sheet like any list (so Back and Close work); a tap on the right or → goes on, on the left or ← goes back.
- **iPhone and iPad tip** (`iosTipDue`): in Safari (not the Home Screen app) a dismissible line says to add the site to
  the Home Screen, since Safari clears a site's data when it isn't opened for about a week.
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
- `docs/diary/` in this repository: `index.json` (in the clear: `v` 2, `user`, `imported`, `at`, `from`, PBKDF2 `salt`
  and `iter` (600,000), `check`, and when each part last changed) and encrypted parts (`SITE_PARTS`): `rows` (the
  export), `keys` (`SITE_KEYS` TMDB, OMDb, Apify, plus `github` and `repo`), `lbx`, `friends`, and film details and
  people's photos spread over 16 parts each (`m0`–`m15`, `p0`–`p15`, by `siteShard` = FNV-1a `hash32` of the key), so a
  few newly found films send a few small parts. Each part is one byte of kind (2 = gzipped), a 12-byte IV, then
  AES-GCM. Version 1 diaries (`rows`, `meta`, `extra`, `keys`) are read, and replaced by the new layout on the next
  update. **Never** put anything there in the clear, the export's email address (`siteRows` keeps only Username, Date
  Joined, Given and Family Name, for friends too), or a key outside `keys`. The `site` check decrypts everything and
  fails on any of these.
- Every unlocked device has the GitHub key (from `keys`) and keeps the site up to date. Merging (`siteTake`) always
  lets the site's copy win unless this device's is strictly better (`metaBetter`: pinned, found, newer match, more
  filled in, then the newer look-up time `t`; averages with a rating; the newer friend export), so devices settle on
  one version instead of sending their own back and forth; the `site` check proves two devices converge.
- Nothing is looked up twice: at start a device brings in what the site has before any lookup (`siteSettled` in both
  `init()`s), and what it finds goes up a minute after lookups finish. Two devices fetching OMDb the same day go
  through films in different orders (`deviceSeed`), so they mostly ask for different ones.
- Keys: a key typed or changed on any device goes up within seconds (`SITE_SOON`); the site's keys replace a device's
  own unless a change made there hasn't gone up yet. When the GitHub key expires, "Use a new GitHub key" on any device
  sends the new one to all. Taken off the site from one device, the others stop sending (`SITE` cleared) and keep
  their copy.
- Putting it there: Settings (phone) or the foot of the page (desktop) → "Put my diary on the site": a password
  (10+ characters) and a fine-grained GitHub key for this repository (Contents: Read and write), kept in the browser
  (`cr-site-pub-v1`) and, through `keys`, on every unlocked device. Each update is one commit through the git data API (`force: false`; on 422 it reads
  the repository again, brings in the other device's change, merges, retries). Only parts whose content hash
  (`canon` + SHA-256, compared with `SITE.sums`) changed are sent.
- Then it goes up by itself (`STORE_HOOK`): a new import, friend or key within seconds; film details, photos and
  averages a minute after lookups finish (only the parts that changed). "Update the site now", "Change the password",
  "Use a new GitHub key", "Take my diary off the site" (deletes `docs/diary/`; nothing goes up again until it's put
  back), and, where the password is asked for, "Forgot the password?" (see "Known limits"). The boxes keep what's
  typed and which sections are open across redraws, unless something just worked (`siteRedraw`). At start a device sends whatever the site lacks or has differently (`siteDiffers`).
- Opening it: any device with nothing imported shows, under the import box, "Are you @user? Open your diary", folded
  (most people there are friends with their own export), which unfolds to the password box; the key
  made from it is kept (`cr-site-v1`), the parts are read from the site (`diary/<part>.bin?v=<when>`) and saved
  like an import, and later starts (and coming back to the app after 10 minutes) fetch only changed parts. A device
  with its own older import of the same user shows the box on Profile (phone) / at the top (desktop). The site's
  import replaces this device's when it is newer or came from the site; details, averages, photos and friends are
  merged (`mergeMeta` keeps the better match). The daily feed still adds new entries on top.
- The app commits to `main`, so **`git pull` before working here**. `site.yml` ignores `docs/diary/**`, the
  service worker leaves `diary/` alone, and `build.sh` never touches it.
- Someone else's export imported on a device that has the diary (`siteSameUser`: the export's Username against the
  site's `user`) never goes up in its place and isn't replaced by it: nothing is sent or brought in, and Settings says
  so. (Before Oct 2026 it would have gone up and replaced the owner's diary on every device; the `site` check covers it.) Hidden in the Claude artifacts and in
  files opened from disk (`SITE_ON`). Checks see no diary on the site unless they stand in for it (`lib.mjs`).

## Sharing the TMDB key with visitors

The owner wanted other people's imports to get cast & crew with their TMDB key, without a key of their own.
- Owner side (`06j-site.js`, `shareBox`, in Settings under the diary on the site, both layouts; shown on a device with
  the GitHub key, its own diary and a TMDB key): "Share my TMDB key with visitors" commits `docs/share.json`
  (`{ tmdb, at }`, nothing else) through the same git data API (`commitFiles` with base `docs/`), optionally a different
  key ("Share a different TMDB key instead"); "Stop sharing" deletes it. Whether it's shared is asked of GitHub once a
  page (`shareCheck`; `share.on` is `"?"` when GitHub can't be asked, never retried in a loop). The box says the key
  becomes public and that TMDB could switch it off if misused.
- Visitor side (`06-lookup.js`): `loadSharedKey()` at start (both `init()`s) reads `share.json` when this browser has
  no key of its own, into `SHARED_TMDB`, in memory only (never saved, never in a backup or the diary on the site);
  `tmdbKey()` falls back to it, `ownTmdbKey()` doesn't. `autoLookup` waits for it, so an import starts looking up at
  once. The key boxes say "Using this site's shared TMDB key" and never show it; "Use your own key" lets a visitor type
  theirs.
- `site.yml` ignores `docs/share.json`; checks answer `share.json` with "not found" unless they stand in for it
  (`lib.mjs`); the `site` check shares, looks up as a visitor, makes sure nothing was saved, and stops sharing.

## Comparing with the owner

The owner wanted friends to compare with them without swapping export files.
- Owner side (`06j-site.js`, `tasteBox`, in Settings under the shared key; a device with the GitHub key and its own
  diary): "Let visitors compare with me" commits `docs/taste.json`: `{ v, user, from, at, films: [[name, year, rating,
  liked]] }`, nothing else (no dates, reviews, watchlist, email or keys); "Stop it" deletes it. It follows a newer
  import on the owner's device (`tasteFollow`, only forward: the card's `from` is the import's date).
- Visitor side (`06e-compare.js`): `loadTasteCard()` at start reads it into `TASTE` (`safeTaste`); a visitor with their
  own export (not the owner) sees "Compare with @user" in Compare on both layouts (`tasteOfferHtml`); one tap adds the
  owner as a friend with id `site` (`addSiteOwner`, saved like any friend), kept up to date with a newer card.
- `site.yml` ignores `docs/taste.json`; checks answer it with "not found" unless they stand in for it; the `site`
  check turns it on, checks what went up, compares as a visitor, and turns it off.

## Security (reviewed Oct 2026; keep it this way)

- **Nothing from outside can run code.** Every value from outside (the export, TMDB, OMDb, Apify, friends, the feed,
  the diary on the site, search, the address) is escaped with `esc()` when written into markup; numbers and ids that
  go into links are coerced (`Number(...)`, `/^tt\d+$/`). Reviews are rebuilt from an allowlist (`reviewParts`).
  Data arriving from the site or a backup passes `safeMeta`/`safePhotos`/`safeLbx`/`safeFriends` first; a backup may
  set only the TMDB, OMDb and Apify keys. The `xss` check fills every source with booby-trapped text and opens every
  screen on both layouts (about a minute): run it after any change to what's shown.
- **Content security policy** on the site's pages (`tools/csp.mjs`, run by `build.sh`): only the pages' own inline
  scripts (by SHA-256) and same-origin files run; images, fonts and calls only from the places the app uses
  (`connect-src`: TMDB, OMDb, Apify, GitHub's API). So **no inline `on…=` handlers** in markup: image errors and the
  phone's fade-in are handled by listeners in `05-core.js`. A new outside service needs adding to the policy. Checks
  count anything the policy blocks as an error (`lib.mjs`). Pages refuse to show inside another site's frame, and
  send no referrer. Papa Parse and JSZip are served from the site (`src/site/vendor/`), not a CDN; the Claude
  artifacts still use cdnjs (allowed there).
- **The diary on the site is signed and can't be rolled back**: `index.json` carries `sig` (the diary key sealing the
  SHA-256 of the rest) and an update count `n`; parts are sealed tied to `name|when` (kinds 3 and 4; 1 and 2 are the
  untied ones from before). A device refuses an index that doesn't verify, counts fewer updates than it has seen, or
  (once it has seen a signed one) isn't signed; its next update then puts its own copy back whole. The `site` check
  covers an edited index, an older copy put back, a swapped part, and the repair.
- **Commits the app makes** are signed `Credits Roll <owner@users.noreply.github.com>`, never the account's email.
  (Eleven older commits carry the owner's email; see "Known limits".)
- What is in the clear on the site: `index.json` (`user`, `at`, `from`, `n`, salt, iterations, `check`, part times),
  `share.json` (the TMDB key) while the owner shares it, and `taste.json` (films, ratings, likes, username) while the
  owner lets visitors compare with them.
  Anyone can download the encrypted parts and try passwords offline; PBKDF2 at 600,000 iterations and a 10+
  character password are what stand in the way, and the password guards the GitHub key (which can change the site).
- Everything secret on a device (keys, GitHub key, the diary key) is in that browser's storage for the origin
  `sjnift.github.io`, which every GitHub Pages site of the owner's account shares.
- The owner's decision (24 Oct 2026), after being offered each fix with its cost: **keep** the lock as it is
  (600,000 iterations, 10+ characters), the diary in this repository with a key for this repository, and the
  `github.io` address; **no** stronger lock, separate diary repository or own domain. Don't offer these again unless
  they ask. They turned on GitHub's email privacy setting themselves. The diary on the site was upgraded to the
  signed layout with all keys on 24 Oct 2026 (12:20 IST, from their first computer), and taken off the site with
  "Take my diary off the site" from a computer on 24 Oct 2026, 14:44 IST (the owner was told; their devices keep it).

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
`phoneTour()` which opens every phone tab, every Stats view for all time and for a year, and every Insights/Compare section), `run.mjs`, and checks:
`apify`, `check` (film data check), `counts` (double counting, also with filters on), `reviews` (missing review text spotted; six-film actors), `welcome` (no example diary; import saved at once), `extras` (year picture, On this day, Watch next, PWA), `feed`, `import`,
`links` (every link opens something), `pages` (nothing broken shows, no sideways scroll on the phone),
`routes`, `storage` (IndexedDB move, backup and restore), `site` (the diary on the site: a stand-in GitHub and site),
`tmdb` (fixing a match, filmography, search), `extras` also covers the story and every kind and shape of picture, `xss` (nothing from outside can run code, about a minute), `study` (a
five-year diary with patterns planted in it: the study finds them on both layouts and for a year, repeats nothing from
the Stats page, and every list it opens holds each film once). `lib.mjs`
also cuts off api.github.com and jsdelivr, answers `diary/` with "not found", and counts anything the security policy
blocks as a page error.

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
- The owner found Insights inadequate and a repeat of the Stats page (Oct 2026) and asked for a real study of their
  watching that accounts for changing tastes and habits → the study in `06k-study.js`. Built against a made-up
  2,000-film diary with planted patterns (a noir season, a Japanese phase, horror every October, a drift to older and
  foreign films, growing tougher), all found; the `study` check keeps a smaller version of it.

## Known limits

- Putting the diary on the site needs a GitHub key, which can expire (the owner was told to pick the longest
  expiry); when it does, the box says the key wasn't accepted and the owner makes a new one the same way.
- Each update of the diary on the site stays in the repository's history (usually a few small parts, tens of KB; a
  new import or a full lookup sends more). If the repository ever gets too big, the history of `docs/diary/` can be
  squashed.
- The password now guards the GitHub key too (it can change the site), so it should be long and used nowhere else.
- The owner's email is in the author line of eleven commits from 22–23 Oct 2026 (ten early ones, and the first diary
  upload); new commits never carry it. Removing it from those means rewriting the repository's history (offered;
  the owner's choice, not done).
- A forgotten password can't be recovered, but it can be replaced: any device that has opened the diary sets a new one
  with "Change the password" (it keeps the key, so the old one isn't asked for); if none can, "Forgot the password?"
  (in the password box on both layouts, and the phone's Settings) replaces the site's diary with this device's own
  under a new password, once a GitHub key for the site is typed there (only the owner can make one):
  `sitePublish({ restart })`. Other devices then ask for the new password and merge what they have. With nothing
  imported, the section says to import the export or a backup first. A rejected key leaves the one that worked
  (`SITEPUB.prev`). The `site` check covers it.
- Inside the Claude artifacts, downloads (backup, year picture) don't work; backups are hidden there and the
  picture can be saved by right-click or long-press. Declaring the artifact `downloads` capability would fix it.
- The feed sees only the latest ~50 diary entries each day; more than that between runs needs a fresh export.
- Letterboxd averages for libraries over 1,300 films take more than one month of free Apify credit.
