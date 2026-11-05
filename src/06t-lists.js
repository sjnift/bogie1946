<script>
/* ---------- your lists (asked 5 Nov 2026: "not done anything with lists"). buildLibrary reads them from the export's
   lists/ folder (lib.lists, newest first); the computer's main page has a Lists chapter, the phone's Profile a row of
   them. A list says how much of it you've seen and your average for those, and opens its films in its own order,
   those not seen yet marked. Lists count nothing in the stats, so they can't count anything twice. */
const listPct = (L) => Math.round(L.seen / L.items.length * 100);
const listSub = (L) => `${plural(L.items.length, "film")} · you've seen ${fmtN(L.seen)} (${listPct(L)}%)${L.avg ? ` · your average ★ ${L.avg.toFixed(2)}` : ""}`;
// the note under a film: not seen yet, the list's own note on it, or when you watched it
function listNote(x) {
  const n = x.f.entries.length, last = n ? x.f.entries[n - 1].date : null;
  return [x.seen ? (last ? `Watched ${fmtDate(last)}` : "Watched") : "Not seen yet", x.note].filter(Boolean).join(" · ");
}
// The whole list, in its order.
function listDrill(L) {
  const by = new Map(L.items.map((x) => [x.f, x]));
  return D.films(L.name, listSub(L), L.items.map((x) => x.f), { sort: "given", note: (f) => listNote(by.get(f)) });
}
// Only what's left to see, in the list's order.
function listToGo(L) {
  const left = L.items.filter((x) => !x.seen), by = new Map(left.map((x) => [x.f, x]));
  return D.films(`${L.name}: not seen yet`, `${plural(left.length, "film")} of ${fmtN(L.items.length)}, in the list's order`, left.map((x) => x.f), { sort: "given", note: (f) => listNote(by.get(f)) });
}
// One line over them all: how many lists and films, and how much of them you've seen (each film once).
function listsLine(lists) {
  const all = new Map();
  for (const L of lists) for (const x of L.items) all.set(x.f, x.seen);
  const seen = [...all.values()].filter(Boolean).length;
  return `${plural(lists.length, "list")} holding ${plural(all.size, "film")}: you've seen ${fmtN(seen)} of them (${Math.round(seen / Math.max(1, all.size) * 100)}%).`;
}
</script>
