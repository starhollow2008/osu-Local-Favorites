import { GM_getValue, GM_setValue } from "../core/gm-shim.js";

// ═══ Collections (playlists) ═══
// User-defined groupings of favorites, entirely separate from osu!'s own
// collections. Stored as { [collectionId]: { name, created, ids: [beatmapId,...] } }.
export const COLLECTIONS_KEY = "osu_fav_collections";

// In-memory write-through cache, mirroring the favorites store above.
// Every card row's "+ Playlist" badge calls collectionsContainingMap() 2-3
// times during buildCard, and each of those used to deserialize the whole
// collections store out of GM storage - 1000+ reads for a single 500-card
// render. All writers go through setCollections(), so caching is coherent;
// cross-tab invalidation matches the favorites cache (storage event below +
// GM_addValueChangeListener in init()).
let _colsCache = null;
export function getCollections() {
  if (_colsCache === null) _colsCache = GM_getValue(COLLECTIONS_KEY, {});
  return _colsCache;
}

export function setCollections(cols) {
  _colsCache = cols;
  GM_setValue(COLLECTIONS_KEY, cols);
}

// See invalidateFavoritesCache() in data/storage.js for why this is a
// function rather than an exported mutable binding.
export function invalidateCollectionsCache() {
  _colsCache = null;
}

export function createCollection(name) {
  const cols = getCollections();
  const id =
    "col_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  cols[id] = {
    name: (name || "").trim() || "Untitled",
    created: new Date().toISOString(),
    ids: [],
  };
  setCollections(cols);
  return id;
}

export function deleteCollection(id) {
  const cols = getCollections();
  delete cols[id];
  setCollections(cols);
}

// Adds/removes a beatmap from a collection; returns the new membership state.
export function toggleMapInCollection(collectionId, mapId) {
  const cols = getCollections();
  const col = cols[collectionId];
  if (!col) return false;
  if (!Array.isArray(col.ids)) col.ids = [];
  const idx = col.ids.indexOf(mapId);
  let nowIn;
  if (idx === -1) {
    col.ids.push(mapId);
    nowIn = true;
  } else {
    col.ids.splice(idx, 1);
    nowIn = false;
  }
  setCollections(cols);
  return nowIn;
}

export function collectionsContainingMap(mapId) {
  const cols = getCollections();
  return Object.entries(cols)
    .filter(([, c]) => Array.isArray(c.ids) && c.ids.includes(mapId))
    .map(([id]) => id);
}

