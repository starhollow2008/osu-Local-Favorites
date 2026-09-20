import { getFavorites } from "../data/storage.js";
import { collectGenreAndTagTerms, favMatchesGenreTerm } from "./genre-filter.js";

// ── Toolbar filter categories ──
// Date / Title / Artist / Status used to be sort-only buttons while Genre
// was the single real filter. Each category now carries filter terms of its
// own, and all of them go through the same popover (ui/filter-menu.js) and
// the same include/exclude semantics:
//
//   within a category : includes are OR'd, any exclude always drops the entry
//   across categories : results are AND'd
//
// A descriptor is { id, label, searchable, collect(favs), matches(f, key) }.
// `collect` returns popover sections; `matches` answers whether one favorite
// satisfies one term key. Sorting stays a separate control - see the sort
// row in ui/main-panel.js.

const DAY_MS = 86400000;

// Date terms are deliberately cumulative ranges rather than disjoint
// buckets: "Last 30 days" should include what "Last 7 days" matched, which
// is how anyone reads a date filter. Counts follow the same rule.
const DATE_RANGES = [
  { key: "today", display: "Today", maxDays: 1 },
  { key: "7d", display: "Last 7 days", maxDays: 7 },
  { key: "30d", display: "Last 30 days", maxDays: 30 },
  { key: "90d", display: "Last 90 days", maxDays: 90 },
  { key: "365d", display: "Last year", maxDays: 365 },
  { key: "older", display: "Older than a year", maxDays: Infinity },
  { key: "undated", display: "No date recorded", maxDays: Infinity },
];

function favAgeDays(f) {
  const t = Date.parse((f && f.favourited_at) || "");
  if (!isFinite(t)) return null;
  return (Date.now() - t) / DAY_MS;
}

function dateMatches(f, key) {
  const age = favAgeDays(f);
  if (age === null) return key === "undated";
  if (key === "undated") return false;
  if (key === "older") return age > 365;
  const range = DATE_RANGES.find((r) => r.key === key);
  return !!range && age <= range.maxDays;
}

function collectDateTerms(favs) {
  const counts = Object.create(null);
  DATE_RANGES.forEach((r) => (counts[r.key] = 0));
  Object.values(favs).forEach((f) => {
    DATE_RANGES.forEach((r) => {
      if (dateMatches(f, r.key)) counts[r.key]++;
    });
  });
  const terms = DATE_RANGES.filter((r) => counts[r.key] > 0).map((r) => ({
    key: r.key,
    display: r.display,
    count: counts[r.key],
  }));
  return [{ label: "Favorited", terms, cap: false }];
}

// Title has no natural taxonomy, so it filters by first character - the
// same grouping an alphabetical list would show. Non-Latin titles (common
// on osu!) collapse into one "Other" row rather than being dropped.
function titleBucketKey(f) {
  const raw = ((f && f.title) || "").trim();
  if (!raw) return "untitled";
  const c = raw.normalize("NFKC").charAt(0).toUpperCase();
  if (c >= "A" && c <= "Z") return c.toLowerCase();
  if (c >= "0" && c <= "9") return "0-9";
  return "other";
}

function titleBucketDisplay(key) {
  if (key === "0-9") return "0-9";
  if (key === "other") return "Other / non-Latin";
  if (key === "untitled") return "No title yet";
  return key.toUpperCase();
}

function titleMatches(f, key) {
  return titleBucketKey(f) === key;
}

function collectTitleTerms(favs) {
  const counts = new Map();
  Object.values(favs).forEach((f) => {
    const key = titleBucketKey(f);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const letters = [];
  const extras = [];
  counts.forEach((count, key) => {
    const term = { key, display: titleBucketDisplay(key), count };
    if (key.length === 1 && key >= "a" && key <= "z") letters.push(term);
    else extras.push(term);
  });
  letters.sort((a, b) => a.key.localeCompare(b.key));
  const order = { "0-9": 0, other: 1, untitled: 2 };
  extras.sort((a, b) => (order[a.key] || 0) - (order[b.key] || 0));
  return [{ label: "Starts with", terms: letters.concat(extras), cap: false }];
}

function artistKey(f) {
  const raw = ((f && f.artist) || "").trim();
  return raw ? raw.toLowerCase() : "__unknown__";
}

function artistMatches(f, key) {
  return artistKey(f) === key;
}

function collectArtistTerms(favs) {
  const counts = new Map();
  Object.values(favs).forEach((f) => {
    const key = artistKey(f);
    const display = key === "__unknown__" ? "Unknown artist" : ((f.artist || "").trim());
    const entry = counts.get(key) || { display, count: 0 };
    entry.count++;
    counts.set(key, entry);
  });
  const terms = Array.from(counts.entries())
    .map(([key, v]) => ({ key, display: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
  return [{ label: "Artists", terms }];
}

// osu!'s own ranking states, in the order the website presents them rather
// than by count - a status list that reorders itself as the library grows
// is harder to use than a fixed one.
const STATUS_ORDER = [
  "ranked",
  "approved",
  "qualified",
  "loved",
  "pending",
  "wip",
  "graveyard",
];

function statusKey(f) {
  const raw = ((f && f.status) || "").trim();
  return raw ? raw.toLowerCase() : "__unknown__";
}

function statusMatches(f, key) {
  return statusKey(f) === key;
}

function statusDisplay(key) {
  if (key === "__unknown__") return "Unknown";
  if (key === "wip") return "WIP";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function collectStatusTerms(favs) {
  const counts = new Map();
  Object.values(favs).forEach((f) => {
    const key = statusKey(f);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const terms = Array.from(counts.entries())
    .map(([key, count]) => ({ key, display: statusDisplay(key), count }))
    .sort((a, b) => {
      const ra = STATUS_ORDER.indexOf(a.key);
      const rb = STATUS_ORDER.indexOf(b.key);
      return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || a.display.localeCompare(b.display);
    });
  return [{ label: "Ranking status", terms, cap: false }];
}

function collectGenreSections(favs) {
  const { genreCounts, tagCounts } = collectGenreAndTagTerms(favs);
  const genres = Array.from(genreCounts.entries())
    .map(([key, v]) => ({ key, display: v.display, count: v.count }))
    .sort((a, b) => a.display.localeCompare(b.display));
  const tags = Array.from(tagCounts.entries())
    .map(([key, v]) => ({ key, display: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
  return [
    { label: "Genres", terms: genres, cap: false },
    { label: "Tags", terms: tags },
  ];
}

// A category with `sortField` set also drives the main list's ordering, and
// carries `sortOptions` for the two-way choice pinned at the top of its own
// popover (see filter-menu.js) - there is no separate sort row in the
// toolbar; each button now does both jobs. `sortField` is the key
// renderList()'s comparator switches on (ui/main-panel.js), and each
// option's `asc` is the sortAsc value that choice sets. Status has neither:
// ranking status has no natural order worth sorting the whole list by, so it
// stays filter-only.
export const FILTER_CATEGORIES = [
  {
    id: "date",
    label: "Date",
    title: "Filter or sort by when it was favorited",
    searchable: false,
    emptyText: "No favorites to filter yet.",
    collect: collectDateTerms,
    matches: dateMatches,
    sortField: "date",
    sortOptions: [
      { asc: false, label: "Newest" },
      { asc: true, label: "Oldest" },
    ],
  },
  {
    id: "title",
    label: "Title",
    title: "Filter or sort by title",
    searchable: false,
    emptyText: "No favorites to filter yet.",
    collect: collectTitleTerms,
    matches: titleMatches,
    sortField: "title",
    sortOptions: [
      { asc: true, label: "A-Z" },
      { asc: false, label: "Z-A" },
    ],
  },
  {
    id: "artist",
    label: "Artist",
    title: "Filter or sort by artist",
    searchable: true,
    placeholder: "Filter artists...",
    emptyText: "No artists yet - metadata is still filling in.",
    collect: collectArtistTerms,
    matches: artistMatches,
    sortField: "artist",
    sortOptions: [
      { asc: true, label: "A-Z" },
      { asc: false, label: "Z-A" },
    ],
  },
  {
    id: "status",
    label: "Status",
    title: "Filter by ranking status",
    searchable: false,
    emptyText: "No statuses yet - metadata is still filling in.",
    collect: collectStatusTerms,
    matches: statusMatches,
  },
  {
    id: "genre",
    label: "Genre",
    title: "Filter or sort by genre or tag",
    searchable: true,
    placeholder: "Filter genres & tags...",
    emptyText: "No favorites to filter yet.",
    collect: collectGenreSections,
    matches: favMatchesGenreTerm,
    sortField: "genre",
    sortOptions: [
      { asc: true, label: "A-Z" },
      { asc: false, label: "Z-A" },
    ],
  },
];

export function makeEmptyFilterState() {
  const state = {};
  FILTER_CATEGORIES.forEach((cat) => (state[cat.id] = {}));
  return state;
}

export function countActiveFilterTerms(state, categoryId) {
  if (categoryId) return Object.keys((state && state[categoryId]) || {}).length;
  return FILTER_CATEGORIES.reduce(
    (n, cat) => n + Object.keys((state && state[cat.id]) || {}).length,
    0,
  );
}

// Flattening the state once per render, rather than per favorite, keeps a
// 500-row rebuild from re-deriving the same include/exclude lists 500 times.
export function buildFilterPlan(state) {
  const plan = [];
  FILTER_CATEGORIES.forEach((cat) => {
    const catState = (state && state[cat.id]) || {};
    const include = [];
    const exclude = [];
    Object.keys(catState).forEach((key) => {
      if (catState[key] === "exclude") exclude.push(key);
      else include.push(key);
    });
    if (include.length || exclude.length) plan.push({ cat, include, exclude });
  });
  return plan;
}

export function favMatchesPlan(f, plan) {
  for (let i = 0; i < plan.length; i++) {
    const { cat, include, exclude } = plan[i];
    if (exclude.length && exclude.some((k) => cat.matches(f, k))) return false;
    if (include.length && !include.some((k) => cat.matches(f, k))) return false;
  }
  return true;
}

// Convenience wrapper for the popover: hands each category the current
// favorites store without every call site importing storage.
export function collectSectionsFor(cat) {
  return cat.collect(getFavorites());
}
