// ── Genre + tag term extraction ──
// The popover that renders these lives in ui/filter-menu.js and the
// category wiring in ui/filters.js; this module owns only the question of
// what counts as a genre, what counts as a tag, and how a tag is spelled.
const TAG_TRIM_PUNCT_RE = /^[\s"'.,;:!?()\[\]「」『』【】]+|[\s"'.,;:!?()\[\]「」『』【】]+$/g;
function normalizeTagText(raw) {
  let t = raw.normalize("NFKC").replace(TAG_TRIM_PUNCT_RE, "");
  return t;
}

export function collectGenreAndTagTerms(favs) {
  const genreCounts = new Map(); // lowercase key -> { display, count }
  const tagCounts = new Map();
  Object.values(favs).forEach((f) => {
    const genre = (f.genre && f.genre.trim()) || "Unspecified";
    const gKey = genre.toLowerCase();
    const gEntry = genreCounts.get(gKey) || { display: genre, count: 0 };
    gEntry.count++;
    genreCounts.set(gKey, gEntry);

    const seen = new Set();
    (f.tags || "").split(/\s+/).forEach((raw) => {
      const tag = normalizeTagText(raw.trim());
      if (!tag) return;
      const tKey = tag.toLowerCase();
      if (seen.has(tKey)) return;
      seen.add(tKey);
      const tEntry = tagCounts.get(tKey) || { display: tag, count: 0 };
      tEntry.count++;
      tagCounts.set(tKey, tEntry);
    });
  });
  // A term that's ever used as an actual genre value is a genre, not a tag.
  genreCounts.forEach((_, key) => tagCounts.delete(key));
  return { genreCounts, tagCounts };
}

// Whether a favorite matches a given genre/tag filter key (both compared
// lowercase, tags run through the same NFKC-normalize + trim as the
// popover list) - true if it's that favorite's genre, or one of its tags.
export function favMatchesGenreTerm(f, key) {
  const genre = ((f.genre && f.genre.trim()) || "Unspecified").toLowerCase();
  if (genre === key) return true;
  return (f.tags || "")
    .split(/\s+/)
    .map((t) => normalizeTagText(t.trim()).toLowerCase())
    .includes(key);
}
