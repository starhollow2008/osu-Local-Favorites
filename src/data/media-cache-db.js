import { GM_getValue } from "../core/gm-shim.js";

// ═══ Media Cache (background covers + audio previews) ═══
// Without this, every reload re-requests every visible cover image, and
// every reopen of the panel re-streams the same preview clips - none of
// it changes between visits, so by default it's pure repeat network
// traffic. This stores both kinds of media as Blobs in IndexedDB, keyed
// by their source URL, and serves them back as local blob: URLs on
// future renders until the entry's chosen expiry passes.
//
// "never" skips the cache store entirely (identical to how this script
// behaved before this feature existed - always straight to the network).
// "always" caches with no expiry; entries only change if the URL itself
// does. Every other mode is a fixed, or user-typed custom, TTL. Applies
// the same way on every platform, including Firefox Android.
export const CACHE_DURATION_KEY = "osu_cache_duration"; // "custom"|"30min"|"1h"|"6h"|"12h"|"24h"|"1week"|"1month"|"always"|"never"
export const CACHE_CUSTOM_MINUTES_KEY = "osu_cache_custom_minutes";
const CACHE_DURATIONS_MIN = {
  "30min": 30,
  "1h": 60,
  "6h": 6 * 60,
  "12h": 12 * 60,
  "24h": 24 * 60,
  "1week": 7 * 24 * 60,
  "1month": 30 * 24 * 60,
};
export function cacheDurationMode() {
  return GM_getValue(CACHE_DURATION_KEY, "24h");
}
export function cacheCustomMinutes() {
  const n = Number(GM_getValue(CACHE_CUSTOM_MINUTES_KEY, 60));
  return Number.isFinite(n) && n > 0 ? n : 60;
}
// TTL in ms, or Infinity for "always" - "never" is handled by callers
// before this is ever reached (they skip the cache store outright).
function cacheDurationMs() {
  const mode = cacheDurationMode();
  if (mode === "always") return Infinity;
  if (mode === "custom") return cacheCustomMinutes() * 60 * 1000;
  return (CACHE_DURATIONS_MIN[mode] || CACHE_DURATIONS_MIN["24h"]) * 60 * 1000;
}
export function formatCacheBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const CACHE_DB_NAME = "osu_local_favorites_media_cache";
const CACHE_STORE = "media";
// Partial ("while streaming") downloads live in their own store until the
// whole track has arrived; see startStreamingCacheWrite() at the bottom.
// Bumping the version is what creates it for existing installs - the media
// store and everything already cached in it are left untouched.
const CACHE_DB_VERSION = 2;
const CHUNK_STORE = "media-chunks";
let _cacheDbPromise = null;
// URLs whose stored copy was discarded as unusable (see forgetCachedMedia).
// A lookup that was already in flight when that happened must not put the
// rejected bytes straight back into the memory LRU, or the next play would
// pick the broken copy again.
const _forgotten = new Set();
function openCacheDb() {
  if (_cacheDbPromise) return _cacheDbPromise;
  _cacheDbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    try {
      const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(CACHE_STORE)) {
          req.result.createObjectStore(CACHE_STORE, { keyPath: "url" });
        }
        if (!req.result.objectStoreNames.contains(CHUNK_STORE)) {
          req.result.createObjectStore(CHUNK_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      // Fail soft - callers treat a null db exactly like "cache
      // unavailable" and fall back to plain network URLs, same as if
      // caching were switched off.
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return _cacheDbPromise;
}
function cacheGet(url) {
  return openCacheDb().then((db) => {
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const req = db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  });
}
export function cachePut(url, blob) {
  return openCacheDb().then((db) => {
    if (!db) return;
    try {
      // Fresh bytes are being written, so this URL is trustworthy again.
      _forgotten.delete(url);
      db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).put({ url, blob, cachedAt: Date.now() });
    } catch (e) {
      // Best-effort - a failed write just means no caching for this one item.
    }
  });
}
export function cacheClearAll() {
  // Revoke every blob URL handed out from the cache - otherwise clearing
  // the IndexedDB store still leaves those object URLs (and the Blobs
  // behind them) alive in memory until the tab closes, and any <img>/
  // <audio> still pointing at one would keep "working" despite the
  // underlying cache entry no longer existing.
  _blobUrlCache.forEach((objUrl) => URL.revokeObjectURL(objUrl));
  _blobUrlCache.clear();
  return openCacheDb().then((db) => {
    if (!db) return;
    return new Promise((resolve) => {
      try {          const tx = db.transaction([CACHE_STORE, CHUNK_STORE], "readwrite");
          tx.objectStore(CACHE_STORE).clear();
          // Half-downloaded tracks go too - otherwise "Clear cache" would
          // report nothing cached while still holding megabytes of partial
          // audio that nothing can ever play.
          tx.objectStore(CHUNK_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  });
}
// Used by the Settings panel to show how much is currently stored.
export function cacheStats() {
  return openCacheDb().then((db) => {
    if (!db) return { count: 0, bytes: 0 };
    return new Promise((resolve) => {
      try {
        // Partial chunks count toward the reported size: they occupy the
        // same quota, and hiding them would make "Clear cache" look like it
        // freed less than it actually did.
        const tx = db.transaction([CACHE_STORE, CHUNK_STORE], "readonly");
        const mediaReq = tx.objectStore(CACHE_STORE).getAll();
        const chunkReq = tx.objectStore(CHUNK_STORE).getAll();
        tx.oncomplete = () => {
          const rows = mediaReq.result || [];
          const chunks = chunkReq.result || [];
          const mediaBytes = rows.reduce((sum, r) => sum + (r.blob ? r.blob.size : 0), 0);
          const partialBytes = chunks.reduce((sum, r) => sum + (r.blob ? r.blob.size : 0), 0);
          resolve({ count: rows.length, bytes: mediaBytes + partialBytes, partialBytes });
        };
        tx.onerror = () => resolve({ count: 0, bytes: 0, partialBytes: 0 });
      } catch (e) {
        resolve({ count: 0, bytes: 0, partialBytes: 0 });
      }
    });
  });
}

// Fetches a URL's raw bytes as a Blob for caching, via GM_xmlhttpRequest
// rather than a page-context fetch(). osu!'s own CDN (assets.ppy.sh /
// b.ppy.sh) doesn't send permissive Access-Control-Allow-Origin headers,
// so a plain fetch() from here is blocked by the browser as a cross-origin
// network error before any bytes ever arrive - the image/audio still
// displays fine via <img>/<audio> (those aren't subject to CORS), but the
// cache store silently never gets populated, which is exactly why caching
// "worked" for nothing. GM_xmlhttpRequest runs outside the page's CORS
// sandbox (same mechanism already used for the GitHub/osu! API calls
// above), so it isn't affected. Falls back to a normal fetch() if this
// userscript manager doesn't support GM_xmlhttpRequest at all.
export function gmFetchBlob(url) {
  if (typeof GM_xmlhttpRequest === "function") {
    return new Promise((resolve) => {
      try {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          responseType: "blob",
          timeout: 20000,
          onload: (response) => {
            if (response.status >= 200 && response.status < 300 && response.response) {
              resolve(response.response);
            } else {
              resolve(null);
            }
          },
          onerror: () => resolve(null),
          ontimeout: () => resolve(null),
        });
      } catch (e) {
        resolve(null);
      }
    });
  }
  return fetch(url)
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);
}

// Reuses one blob: URL per cached source URL for the whole tab's
// lifetime, instead of minting a fresh one every time resolveCachedMediaUrl
// resolves the same cover/preview again (which happens on essentially
// every re-render - sorting, filtering, search, scroll-chunking all
// rebuild cards from scratch). Blob URLs are never garbage-collected just
// because the <img>/<audio> referencing them got removed from the DOM -
// only URL.revokeObjectURL() or a full page unload frees the underlying
// Blob - so without this, a long session doing a lot of re-rendering was
// steadily accumulating orphaned blob URLs (and, for full-length preview
// audio, several-MB Blobs behind each one) that never got released.
export const _blobUrlCache = new Map(); // sourceUrl -> objectURL

// One definition of "this cache entry is usable right now", shared by the
// playback source choice, the streaming writer's pre-request check and
// resolveCachedMediaUrl below. They each used to re-derive it, so a change
// to the TTL rules could silently make one of them disagree with the others.
function isFreshEntry(entry) {
  if (!entry || !entry.blob) return false;
  const ttl = cacheDurationMs();
  return ttl === Infinity || Date.now() - entry.cachedAt < ttl;
}

// A tiny in-memory LRU of fully cached songs. IndexedDB reads are async and
// playback has to choose its source synchronously, inside the click that
// started it - so without this, a song cached seconds ago still opened a
// network request that was then immediately swapped away. With it, a repeat
// play (replay, back/next, loop, an auto-next round trip) starts from the
// local copy with no request at all.
const MEM_BLOB_LIMIT = 3;
const _memBlobs = new Map(); // sourceUrl -> { blob, cachedAt }

function _rememberCachedBlob(url, blob, cachedAt) {
  if (!url || !blob) return;
  // Explicitly rejected bytes (a local copy that failed to decode) must not
  // come back through a late lookup; only a new cachePut clears this.
  if (_forgotten.has(url)) return;
  _memBlobs.delete(url);
  _memBlobs.set(url, { blob, cachedAt: cachedAt || Date.now() });
  while (_memBlobs.size > MEM_BLOB_LIMIT) {
    _memBlobs.delete(_memBlobs.keys().next().value); // oldest first
  }
}

// Synchronous: the Blob for url when this session has already seen a fresh
// cached copy, else null. Never touches IndexedDB, so it is safe to call in
// the middle of a click/pointer handler.
export function getKnownCachedBlob(url) {
  const rec = _memBlobs.get(url);
  if (!rec) return null;
  if (cacheDurationMode() === "never" || !isFreshEntry(rec)) {
    _memBlobs.delete(url);
    return null;
  }
  _memBlobs.delete(url); // LRU touch
  _memBlobs.set(url, rec);
  return rec.blob;
}

// Async boolean form of the same question - "is a request for this URL
// pointless?" - for callers that only need to decide whether to fetch.
export function hasFreshCachedCopy(url) {
  if (!url) return Promise.resolve(false);
  if (cacheDurationMode() === "never") return Promise.resolve(false);
  return cacheGet(url).then((entry) => {
    if (isFreshEntry(entry)) {
      _rememberCachedBlob(url, entry.blob, entry.cachedAt);
      return true;
    }
    return false;
  });
}

// Resolves to a URL safe to hand straight to <img src> / <audio src>: a
// local blob: URL when a fresh cached copy exists, otherwise the original
// network URL unchanged - so a cache miss never delays first-time
// playback/display waiting on a full download. A miss also kicks off a
// background fetch to populate the cache for next time; fire-and-forget,
// not awaited by the caller either way. This runs on Firefox Android too
// now - caching should behave the same across browsers/platforms.
export function resolveCachedMediaUrl(url) {
  if (!url) return Promise.resolve(url);
  if (cacheDurationMode() === "never") return Promise.resolve(url);

  return cacheGet(url).then((entry) => {
    if (isFreshEntry(entry)) {
      let objUrl = _blobUrlCache.get(url);
      if (!objUrl) {
        objUrl = URL.createObjectURL(entry.blob);
        _blobUrlCache.set(url, objUrl);
      }
      return objUrl;
    }

    gmFetchBlob(url).then((blob) => {
      if (!blob) return;
      cachePut(url, blob);
      // The blob just changed (first fetch, or a re-fetch after the old
      // entry expired) - drop any object URL for the previous bytes so the
      // next resolve mints one for the new blob instead of quietly serving
      // stale content forever.
      const stale = _blobUrlCache.get(url);
      if (stale) {
        URL.revokeObjectURL(stale);
        _blobUrlCache.delete(url);
      }
    });
    return url;
  });
}

// Returns the cached Blob for url when a fresh copy exists (per the current
// TTL setting), or null. Pure read: unlike resolveCachedMediaUrl it never
// kicks off a background fetch and never mints a blob: URL - callers use it
// when they need the raw bytes (playback source swap) rather than something
// to assign to an <img>/<audio> src.
export function peekCachedBlob(url) {
  if (!url) return Promise.resolve(null);
  if (cacheDurationMode() === "never") return Promise.resolve(null);
  return cacheGet(url).then((entry) => {
    if (!isFreshEntry(entry)) return null;
    // Remember it so the next play of this song can pick the local copy
    // synchronously, without even this lookup.
    _rememberCachedBlob(url, entry.blob, entry.cachedAt);
    return entry.blob;
  });
}

// ── Cache-first source selection ────────────────────────────────────
// Playback has to decide its <audio> source *before* it calls play(), and
// on a persistent-cache hit that source has to be the local blob: URL - no
// remote preview request may be issued at all. Two helpers make that
// possible:
//
//   prewarmCachedPreview(url) - kicked off on pointer-down/hover/focus of a
//     card, so the IndexedDB read for that track has normally finished well
//     before its Play button is clicked.
//   lookupCachedBlob(url)     - the click-time question. Answered
//     synchronously (a microtask) when the prewarm, or an earlier play of
//     the same song, already hydrated the entry; otherwise it is one
//     IndexedDB read, bounded so a wedged storage backend can never stall
//     playback. The bound is orders of magnitude longer than a healthy read
//     and stays inside the ~5s transient-activation window a click grants,
//     so the play() that follows is still a gesture-driven call.
const CACHE_LOOKUP_TIMEOUT_MS = 1500;
const _hydrating = new Map(); // url -> in-flight lookup promise

// One shared read per URL: a prewarm that is still running when the user
// clicks is awaited rather than restarted, and concurrent callers cannot
// stack duplicate IndexedDB reads.
function _prewarmLookup(url) {
  const existing = _hydrating.get(url);
  if (existing) return existing;
  const promise = peekCachedBlob(url)
    .catch(() => null)
    .then((blob) => {
      _hydrating.delete(url);
      return blob;
    });
  _hydrating.set(url, promise);
  return promise;
}

// Fire-and-forget hydration. Safe to call as often as the UI likes: a URL
// already in the LRU or already being read is skipped outright, and the
// read only ever populates the bounded LRU (never the object-URL cache, so
// prewarming tracks the user has not played holds no Blob alive).
export function prewarmCachedPreview(url) {
  if (!url) return;
  if (cacheDurationMode() === "never") return;
  if (_memBlobs.has(url) || _forgotten.has(url)) return;
  _prewarmLookup(url).catch(() => {});
}

// Cache-first decision for playback. Resolves to the cached Blob when this
// browser holds a fresh copy, else null - and callers treat null as "use
// the network source". Synchronous fast path when already hydrated.
export function lookupCachedBlob(url, timeoutMs = CACHE_LOOKUP_TIMEOUT_MS) {
  if (!url) return Promise.resolve(null);
  if (cacheDurationMode() === "never") return Promise.resolve(null);
  const known = getKnownCachedBlob(url);
  if (known) return Promise.resolve(known);
  if (_forgotten.has(url)) return Promise.resolve(null);

  const lookup = _prewarmLookup(url);
  if (!(timeoutMs > 0)) return lookup;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // A timed-out lookup still populates the LRU when it eventually
      // resolves, so the next play of this song decides synchronously.
      resolve(blob || null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    lookup.then(finish, () => finish(null));
  });
}

// Drops a cached copy entirely - used when the stored bytes turned out to
// be unusable (a local play that will not decode). The next play re-fetches
// from the network and caches a fresh copy.
export function forgetCachedMedia(url) {
  if (!url) return Promise.resolve();
  _memBlobs.delete(url);
  _forgotten.add(url);
  const objUrl = _blobUrlCache.get(url);
  if (objUrl) {
    URL.revokeObjectURL(objUrl);
    _blobUrlCache.delete(url);
  }
  return openCacheDb().then((db) => {
    if (!db) return;
    return _deleteEntry(db, url).then(() => _deleteChunks(db, url));
  });
}

// ── Progressive ("while streaming") cache writes ────────────────────
// Caching a track used to be all-or-nothing: one whole-file GET issued
// alongside the media element's own request, written to IndexedDB only
// once the last byte had arrived, and skipped outright on Firefox Android.
// So a song skipped halfway wasted its entire download, a track whose tab
// was closed cached nothing, and nothing was ever written *while* the
// audio was still playing.
//
// This reads the response body as a stream and persists it in chunks as it
// arrives instead:
//   * bytes land in IndexedDB during playback, not after it finishes,
//   * an interrupted or skipped track keeps its partial chunks and resumes
//     with a Range request on the next play (If-Range, so a track whose
//     bytes changed server-side restarts cleanly instead of splicing two
//     different files together),
//   * completion assembles the chunks into the single `media` record the
//     rest of the cache - including playback's cache-first source swap -
//     already reads from, and the partial chunks are then dropped.
//
// fetch() needs CORS permission, which osu!'s own CDN does not grant; when
// the request is rejected before any bytes land this returns null so the
// caller can fall back to the GM_xmlhttpRequest whole-file path below (that
// one runs outside the page's CORS sandbox).
const CHUNK_FLUSH_BYTES = 1024 * 1024; // batch partial writes instead of one per network packet
const _activeStreamWrites = new Map(); // url -> { promise, cancel }

function _chunkKey(url, index) {
  return url + "\u0000" + String(index).padStart(6, "0");
}
function _chunkRange(url) {
  return IDBKeyRange.bound(url + "\u0000", url + "\u0000\uFFFF");
}

function _readChunks(db, url) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(CHUNK_STORE, "readonly").objectStore(CHUNK_STORE).getAll(_chunkRange(url));
      req.onsuccess = () => {
        const rows = (req.result || []).slice().sort((a, b) => a.index - b.index);
        resolve({
          chunks: rows,
          bytes: rows.reduce((n, r) => n + (r.blob ? r.blob.size : 0), 0),
          etag: (rows[0] && rows[0].etag) || "",
          contentType: (rows[0] && rows[0].contentType) || "",
        });
      };
      req.onerror = () => resolve({ chunks: [], bytes: 0, etag: "", contentType: "" });
    } catch (e) {
      resolve({ chunks: [], bytes: 0, etag: "", contentType: "" });
    }
  });
}

function _writeChunkRows(db, rows) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CHUNK_STORE, "readwrite");
      const store = tx.objectStore(CHUNK_STORE);
      rows.forEach((row) => store.put(row));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function _deleteChunks(db, url) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CHUNK_STORE, "readwrite");
      tx.objectStore(CHUNK_STORE).delete(_chunkRange(url));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function _deleteEntry(db, url) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).delete(url);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

// The GM_ path: one whole-file request, written in a single go. Used when
// fetch() is unavailable or the stream was CORS-blocked before any bytes
// landed. Any partial chunks are discarded once the full copy is in.
function _wholeFileFallback(db, url) {
  return gmFetchBlob(url).then((blob) => {
    if (!blob) return false;
    return cachePut(url, blob)
      .then(() => _deleteChunks(db, url))
      .then(() => {
        _rememberCachedBlob(url, blob);
        return true;
      });
  });
}

async function _streamViaFetch(db, url, partial, isStillWanted, state) {
  let wroteAnything = false;
  try {
    // Chunks with no validator cannot be trusted to belong to the bytes the
    // server would send now, so start over rather than resume onto them.
    if (partial.bytes > 0 && !partial.etag) {
      await _deleteChunks(db, url);
      partial = { chunks: [], bytes: 0, etag: "", contentType: "" };
    }

    const headers = {};
    if (partial.bytes > 0) {
      headers["Range"] = "bytes=" + partial.bytes + "-";
      headers["If-Range"] = partial.etag;
    }

    const controller = new AbortController();
    state.controller = controller;
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok || !response.body || typeof response.body.getReader !== "function") return null;

    // A 200 while we asked for a range means If-Range failed (the file
    // changed) or the server ignored it - the body is the whole file again,
    // so the chunks on disk no longer line up with it.
    const restarting = partial.bytes > 0 && response.status !== 206;
    if (restarting) await _deleteChunks(db, url);

    const contentType = response.headers.get("content-type") || partial.contentType || "audio/mpeg";
    const etag = response.headers.get("etag") || partial.etag || "";
    let nextIndex = restarting
      ? 0
      : (partial.chunks.length ? partial.chunks[partial.chunks.length - 1].index + 1 : 0);

    const reader = response.body.getReader();
    let pending = [];
    let pendingBytes = 0;
    const flushPending = async () => {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      pendingBytes = 0;
      wroteAnything = true;
      await _writeChunkRows(db, batch);
    };

    for (;;) {
      if (state.cancelled || !isStillWanted()) {
        controller.abort();
        await flushPending(); // keep what already arrived, for a resume later
        return false;
      }
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || !value.byteLength) continue;
      const index = nextIndex++;
      pending.push({
        key: _chunkKey(url, index),
        url,
        index,
        blob: new Blob([value], { type: contentType }),
        contentType,
        etag,
      });
      pendingBytes += value.byteLength;
      if (pendingBytes >= CHUNK_FLUSH_BYTES) await flushPending();
    }
    await flushPending();

    const total = await _readChunks(db, url);
    if (!total.chunks.length) return false;
    const blob = new Blob(total.chunks.map((r) => r.blob), { type: total.contentType || contentType });
    await cachePut(url, blob);
    await _deleteChunks(db, url);
    _rememberCachedBlob(url, blob);
    return true;
  } catch (e) {
    if (state.cancelled) return false;
    // Nothing usable arrived (CORS-blocked, offline, mirror error) and no
    // bytes were persisted - let the caller try the GM_ whole-file path.
    return wroteAnything ? false : null;
  }
}

async function _runStreamingWrite(url, isStillWanted, state) {
  const db = await openCacheDb();
  if (!db) return false;

  const entry = await cacheGet(url);
  const fresh = isFreshEntry(entry);
  // Already fully cached (this is the track that is playing from the cache):
  // nothing to download, just make sure no half-file chunks are left behind.
  if (fresh) {
    await _deleteChunks(db, url);
    return true;
  }
  // A stale/expired entry cannot be resumed onto - drop it with its chunks.
  if (entry) await _deleteEntry(db, url);

  const partial = await _readChunks(db, url);
  if (state.cancelled || !isStillWanted()) return false;

  if (typeof fetch === "function" && typeof AbortController === "function") {
    const viaFetch = await _streamViaFetch(db, url, partial, isStillWanted, state);
    if (viaFetch !== null) return viaFetch;
  }
  return _wholeFileFallback(db, url);
}

// Starts caching `url` while it is being streamed by the media element.
// Returns a Promise<boolean> (true = a complete copy is now cached). Only
// one write per URL can be in flight; a repeat call for the same track
// returns the existing one. `isStillWanted()` is polled as bytes arrive so
// a skipped track stops consuming bandwidth immediately - and the single
// `cancel()` on the returned handle stops it without waiting for the next
// packet.
export function startStreamingCacheWrite(url, opts = {}) {
  if (!url) return Promise.resolve(false);
  if (cacheDurationMode() === "never") return Promise.resolve(false);

  const existing = _activeStreamWrites.get(url);
  if (existing) return existing.promise;

  const isStillWanted = typeof opts.isStillWanted === "function" ? opts.isStillWanted : () => true;
  const state = { cancelled: false, controller: null };

  const promise = _runStreamingWrite(url, isStillWanted, state)
    .catch(() => false)
    .then((ok) => {
      _activeStreamWrites.delete(url);
      return ok;
    });

  _activeStreamWrites.set(url, {
    promise,
    cancel: () => {
      state.cancelled = true;
      if (state.controller) {
        try { state.controller.abort(); } catch (e) { /* already settled */ }
      }
    },
  });
  return promise;
}

// Used only when the Song metadata could not be read. The mirror's
// transitional preview is about 30 seconds; duration_sec is the preferred
// check because a real song may itself be short.
