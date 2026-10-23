# Credits Roll

Stats from a Letterboxd export. `src/` holds the parts; `./build.sh` assembles `docs/` (the GitHub Pages site)
and the Claude versions. `npm test` runs the checks in `tests/` against the built site; they also run on every push.

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
