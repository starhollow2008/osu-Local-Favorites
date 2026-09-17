import { GM_getValue, GM_setValue, _GM_FALLBACK_LS_KEY } from "../core/gm-shim.js";
import { invalidateCollectionsCache } from "./collections.js";

export const STORAGE_KEY = "osu_local_favorites";

// ═══ Storage ═══
// In-memory write-through cache over the favorites object. getFavorites()
// used to deserialize the ENTIRE favorites store out of GM storage on every
// single call, and it sits under hot paths that run constantly:
// refreshButtons() (every DOM mutation + a 1.5s fallback interval, once per
// heart button per pass via isFavorited), updateFloatingHeart(), and the
// enrichment drainer re-filtering the queue against it every second. With a
// large library that was several multi-megabyte JSON parses per second for
// the whole tab lifetime - constant CPU burn and GC churn bad enough to get
// the renderer OOM-killed ("Aw, Snap!" / SIGILL) and the page stuck loading.
// Every writer already goes through setFavorites(), so caching the last
// value in memory and persisting only on write is coherent; the cross-tab
// listeners (GM_addValueChangeListener in init() for native GM storage, the
// DOM "storage" event here for the localStorage fallback) invalidate it.
let _favsCache = null;
export function getFavorites() {
  if (_favsCache === null) _favsCache = GM_getValue(STORAGE_KEY, {});
  return _favsCache;
}

export function setFavorites(favs) {
  _favsCache = favs;
  GM_setValue(STORAGE_KEY, favs);
  notifyIfMembershipChanged(favs);
}

// ── Change notification ───────────────────────────────────────────────
// Every surface that draws a heart (card buttons on the page, the floating
// indicator, the guest button, the panel) used to be refreshed by hand at
// each mutation site. There were eight such sites and none of them
// refreshed the card buttons, so removing a favorite from the panel left
// the page's own hearts filled until a full reload - and, because
// refreshButtons() marks a button as processed and never revisits it, a
// Turbolinks snapshot restored that stale state right back.
//
// Instead, storage announces membership changes once and the UI layer
// subscribes. Kept as a subscriber list rather than a DOM CustomEvent so
// the data layer stays free of DOM assumptions, and so a listener cannot
// be lost when Turbolinks swaps out <body>.
const _favoritesListeners = new Set();

export function onFavoritesChanged(listener) {
  if (typeof listener !== "function") return () => {};
  _favoritesListeners.add(listener);
  return () => _favoritesListeners.delete(listener);
}

// A cheap signature over *which ids are favorited*, deliberately ignoring
// the contents of each record. Background enrichment calls setFavorites()
// roughly once a second purely to attach metadata to an existing entry;
// without this, every one of those writes would trigger a full heart
// resync across the page for no visible change.
//
// Count alone is not enough (a restore can swap ids while keeping the
// count), so the id sum comes along for the ride. Both are O(n) integer
// work over keys that were about to be serialized by GM_setValue anyway.
function membershipSignature(favs) {
  let count = 0;
  let sum = 0;
  for (const id in favs) {
    count++;
    sum += Number(id) || 0;
  }
  return count + ":" + sum;
}

let _lastMembershipSignature = null;

function notifyIfMembershipChanged(favs) {
  const signature = membershipSignature(favs || {});
  const membershipChanged = signature !== _lastMembershipSignature;
  _lastMembershipSignature = signature;
  notifyFavoritesChanged({ membershipChanged });
}

// Listeners always run; the detail tells them how much actually changed.
//
// `membershipChanged: true`  - a beatmap was added or removed. Hearts are
//                              now wrong everywhere and the panel list has
//                              the wrong contents. Repaint immediately.
// `membershipChanged: false` - same ids, different record contents. This is
//                              background enrichment filling in title and
//                              artist, which runs about once a second
//                              during a bulk pass. Hearts are unaffected;
//                              the panel only needs to catch up eventually,
//                              so subscribers debounce this case rather
//                              than rebuilding the list once per second.
export function notifyFavoritesChanged(detail = { membershipChanged: true }) {
  _favoritesListeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (e) {
      // One bad listener must not stop the others, and must never take
      // down the write that triggered it.
      console.warn("[osu-local-favorites] favorites listener failed:", e);
    }
  });
}

// Drops the in-memory cache so the next getFavorites() re-reads persisted
// state. Exported (rather than exposing _favsCache itself) so other modules
// - cross-tab sync in core/init.js, the localStorage-fallback listener right
// below - can invalidate it without holding a live, writable binding into
// this module's private state.
export function invalidateFavoritesCache(nextFavorites) {
  // GM_addValueChangeListener supplies the new value directly. Prefer it when
  // available: some managers deliver the notification before a subsequent
  // GM_getValue() can observe the updated store, which made page A rebuild
  // against its old cache after page B changed a favorite.
  _favsCache = nextFavorites && typeof nextFavorites === "object" ? nextFavorites : null;
  // Another tab (or a restore) replaced the store wholesale, so this tab's
  // idea of what is favorited is void - force listeners to re-read rather
  // than comparing against a signature computed from the old contents.
  _lastMembershipSignature = null;
  notifyFavoritesChanged();
}

// Invalidate on cross-tab writes in the localStorage-fallback mode. (In
// native GM mode this event never fires for GM storage - init()'s
// GM_addValueChangeListener handler covers that path instead.)
window.addEventListener("storage", (e) => {
  if (!e.key || e.key === _GM_FALLBACK_LS_KEY) {
    invalidateFavoritesCache();
    invalidateCollectionsCache();
  }
});

export function isFavorited(id) {
  return !!getFavorites()[id];
}

