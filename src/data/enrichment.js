import { osuApiFetchBeatmapset, osuApiIsConfigured, osuApiIsConnected, scheduleAutoBackup } from "../api/osu-api.js";
import { GM_getValue, GM_setValue } from "../core/gm-shim.js";
import { isReenrichRunning } from "./reenrichment.js";
import { getFavorites, setFavorites } from "./storage.js";

// ═══ Background enrichment ═══
// Shared pacing for any sequence of osu! beatmapset detail-page requests -
// keeps us comfortably under ~60 requests/min regardless of which feature
// (bulk "Favorite all" import or a full-library re-enrichment) is driving it.
export const ENRICH_RATE_LIMIT_MS = 1000;

// Persistent queue of beatmapset IDs still missing full metadata (genre/
// language/tags/source/etc.) - anything favorited from a listing card
// instead of the beatmapset detail page starts here (see toggleFavorite/
// "Favorite all" below) and is only removed once enrichBeatmapData()
// actually succeeds for it.
//
// This exists because the previous approach - fire off enrichBeatmapData()
// once right after favoriting and otherwise forget about it - quietly
// lost genre/language for a lot of favorites in practice: at the required
// ~1 req/sec throttle, favoriting even a couple hundred maps in one
// "Favorite all" run takes minutes to fully enrich, and closing the tab
// (or just navigating away) partway through abandons whatever hadn't been
// reached yet, with no record that it was ever incomplete. The queue below
// survives navigation/reloads and a background drainer (see
// ensureEnrichDrainerRunning) resumes it automatically wherever the user
// happens to be browsing, at the same gentle pace, until it's empty.
const ENRICH_QUEUE_KEY = "osu_enrich_queue";

export function getEnrichQueue() {
  const q = GM_getValue(ENRICH_QUEUE_KEY, []);
  return Array.isArray(q) ? q : [];
}
function setEnrichQueue(q) {
  GM_setValue(ENRICH_QUEUE_KEY, q);
}
export function addToEnrichQueue(id) {
  const q = getEnrichQueue();
  if (!q.includes(id)) {
    q.push(id);
    setEnrichQueue(q);
  }
}

// Batch queue migration/import writes. Calling addToEnrichQueue once per
// favorite makes native Tampermonkey serialize and persist the entire
// queue once per item, which can make the first page load painfully slow
// for a large existing library.
export function addManyToEnrichQueue(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const q = getEnrichQueue();
  const known = new Set(q);
  let changed = false;
  ids.forEach((id) => {
    if (known.has(id)) return;
    known.add(id);
    q.push(id);
    changed = true;
  });
  if (changed) setEnrichQueue(q);
}

export function removeFromEnrichQueue(id) {
  const q = getEnrichQueue();
  const idx = q.indexOf(id);
  if (idx !== -1) {
    q.splice(idx, 1);
    setEnrichQueue(q);
  }
}

// Fetches the beatmapset detail page and merges full JSON data into storage.
// Fire-and-forget - card data is stored instantly, this fills in the gaps.
// Also used standalone by the global re-enrichment feature to refresh
// fields (tags/source/genre/language/etc.) that may be stale or were saved
// in an older, differently-normalized format.
export function enrichBeatmapData(beatmapId) {
  // Prefer the osu! API v2 when connected (clean JSON, no HTML parsing,
  // no reliance on the embedded #json-beatmapset element). Falls back to
  // scraping the beatmapset page's embedded JSON when the API isn't set up.
  const useApi = osuApiIsConnected() && osuApiIsConfigured();
  const fetchNormalized = useApi
    ? osuApiFetchBeatmapset(beatmapId)
    : fetch("https://osu.ppy.sh/beatmapsets/" + beatmapId, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.text() : null))
      .then((html) => {
        if (!html) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const el = doc.getElementById("json-beatmapset");
        if (!el) return null;
        try {
          const raw = JSON.parse(el.textContent);
          const bm = raw.beatmapset || raw;
          return bm && bm.id ? bm : null;
        } catch (e) {
          return null;
        }
      });

  return Promise.resolve(fetchNormalized)
    .then((bm) => {
      if (!bm) return false;
      const favs = getFavorites();
      const sid = String(bm.id);
      if (!favs[sid]) {
        // Removed before enrichment finished - nothing to fill in, but it's
        // also not "still needing enrichment" anymore, so stop retrying it.
        removeFromEnrichQueue(sid);
        return false;
      }
      const existing = favs[sid];
      const apiFeatured = typeof bm.is_artist_featured === "boolean"
        ? bm.is_artist_featured
        : (bm.track_id != null ? !!bm.track_id : null);
      // Re-enrichment must not replace the whole record with a lossy API
      // projection. In particular, API v2 beatmapset responses can omit the
      // featured-artist marker (and other fields introduced by the page/card
      // payload). Keep existing values whenever the response does not provide
      // a value, while still allowing an explicit API false to clear stale
      // metadata.
      favs[sid] = {
        ...existing,
        id: sid,
        artist: bm.artist || existing.artist || "",
        artist_unicode: bm.artist_unicode || bm.artist || existing.artist_unicode || existing.artist || "",
        title: bm.title || existing.title || "",
        title_unicode: bm.title_unicode || bm.title || existing.title_unicode || existing.title || "",
        creator: bm.creator || existing.creator || "",
        user_id: String(bm.user_id || existing.user_id || ""),
        covers: Object.keys(bm.covers || {}).length ? bm.covers : (existing.covers || {}),
        status: bm.status || existing.status || "",
        favourite_count: bm.favourite_count ?? existing.favourite_count ?? 0,
        play_count: bm.play_count ?? existing.play_count ?? 0,
        bpm: bm.bpm || existing.bpm || 0,
        source: bm.source || existing.source || "",
        tags: bm.tags || existing.tags || "",
        // API v2 returns objects here, while the normalized API helper and
        // older page payloads may already provide plain strings.
        genre: typeof bm.genre === "string" ? bm.genre : ((bm.genre && bm.genre.name) || existing.genre || ""),
        language: typeof bm.language === "string" ? bm.language : ((bm.language && bm.language.name) || existing.language || ""),
        url: "https://osu.ppy.sh/beatmapsets/" + sid,
        favourited_at: existing.favourited_at || new Date().toISOString(),
        is_artist_featured: apiFeatured === null ? !!existing.is_artist_featured : apiFeatured,
        nsfw: typeof bm.nsfw === "boolean" ? bm.nsfw : !!existing.nsfw,
        preview: existing.preview || "https://b.ppy.sh/preview/" + sid + ".mp3",
        metadata_enriched: true,
      };
      setFavorites(favs);
      scheduleAutoBackup();
      removeFromEnrichQueue(sid);
      const genreMenu = document.getElementById("osu-fav-genre-menu");
      if (genreMenu && typeof genreMenu._refreshTerms === "function") genreMenu._refreshTerms();
      return true;
    })
    .catch(() => false); // left in the queue - a later drain pass retries it
}

// Sequentially enriches a list of IDs with a delay between requests
export function enrichBeatmapsSequential(ids, delayMs = ENRICH_RATE_LIMIT_MS) {
  let i = 0;
  function next() {
    if (i >= ids.length) return;
    enrichBeatmapData(ids[i++]).then(() => setTimeout(next, delayMs));
  }
  setTimeout(next, delayMs);
}

// Quietly works through the persistent enrichment queue (see
// ENRICH_QUEUE_KEY above) in the background, one map per
// ENRICH_RATE_LIMIT_MS - same throttle as every other enrichment path,
// just spread across however many page loads it takes instead of
// requiring one tab to stay open until it's done. Safe to call any time;
// it's a no-op while a manual "Re-enrich all maps" run is already going
// (avoids doubling up the request rate), and naturally stops calling
// itself once the queue is empty or every favorite it names is gone.
let _enrichDrainerActive = false;
export function ensureEnrichDrainerRunning() {
  if (_enrichDrainerActive) return;
  _enrichDrainerActive = true;

  function drainNext() {
    if (isReenrichRunning()) {
      // Manual re-enrichment took over - back off and let it finish;
      // it removes IDs from this same queue as it goes.
      setTimeout(drainNext, ENRICH_RATE_LIMIT_MS);
      return;
    }
    const queue = getEnrichQueue().filter((qid) => {
      const fav = getFavorites()[qid];
      return fav && !fav.metadata_enriched;
    }); // drop removed or already-enriched IDs
    if (!queue.length) {
      setEnrichQueue(queue);
      _enrichDrainerActive = false; // queue empty - stop until something re-queues it
      return;
    }
    const id = queue[0];
    enrichBeatmapData(id).then((ok) => {
      if (!ok) {
        // Left in the queue by enrichBeatmapData on failure, but rotate it
        // to the back rather than leaving it at the front - otherwise a
        // single persistently-failing map (deleted beatmapset, transient
        // error, whatever) gets retried forever every cycle and every
        // *other* queued map behind it never gets a turn, which looked
        // exactly like enrichment being broken again even though it was
        // just stuck on one bad entry.
        const q2 = getEnrichQueue();
        const idx = q2.indexOf(id);
        if (idx !== -1) {
          q2.splice(idx, 1);
          q2.push(id);
          setEnrichQueue(q2);
        }
      }
      setTimeout(drainNext, ENRICH_RATE_LIMIT_MS);
    });
  }
  setTimeout(drainNext, ENRICH_RATE_LIMIT_MS);
}

