"use strict";
/**
 * Cache-first playback contract check.
 *
 *   node build/check-cache-first.js
 *
 * Playback must decide its <audio> source from the local cache *before*
 * touching the network: a track whose bytes are already in IndexedDB has to
 * yield a Blob (which the panel turns into a blob: URL) without any request
 * for the remote preview URL. This loads the real data/media-cache-db.js
 * module against a fake IndexedDB that counts requests, and asserts:
 *
 *   1. a cache miss resolves null and issues no request,
 *   2. a cold (not prewarmed) IndexedDB hit still resolves the Blob, because
 *      the lookup itself must not need the network to answer,
 *   3. a prewarmed entry answers *synchronously* - that is the tier the
 *      click handler relies on to pick the local copy inside the gesture,
 *   4. expired entries, "never" mode and forgotten entries all miss,
 *   5. a wedged storage backend cannot stall playback (bounded lookup),
 *   6. the distributed bundle actually contains that path (no network-first
 *      source assignment left behind).
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const MODULE = path.join(ROOT, "src", "data", "media-cache-db.js");
const BUNDLE = path.join(ROOT, "dist", "osu-local-favorites.user.js");

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", RESET = "\x1b[0m";
let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`${GREEN}  PASS${RESET} ${name}`);
  else {
    failures++;
    console.log(`${RED}  FAIL${RESET} ${name}${detail ? `\n       ${DIM}${detail}${RESET}` : ""}`);
  }
}

// ── request counters ─────────────────────────────────────────────────
const net = { fetch: 0, gm: 0, urls: [] };

// ── fake IndexedDB ───────────────────────────────────────────────────
// Only what data/media-cache-db.js uses: open/onupgradeneeded, one
// transaction at a time, objectStore get/put/delete/clear/getAll, and the
// key-range deletes the chunk store performs. `stall` never fires a request,
// standing in for a wedged/blocked storage backend.
function makeIdb({ stall = false, seed = [] } = {}) {
  const stores = new Map();
  const storeOf = (name) => stores.get(name);
  for (const [name, keyPath, rows] of seed) {
    stores.set(name, { keyPath, rows: new Map(rows.map((r) => [r[keyPath], r])) });
  }
  const defer = (fn) => setTimeout(fn, 0);
  const request = () => {
    const req = {};
    defer(() => {
      if (stall) return;
      try {
        req.result = req.__work();
      } catch (e) {
        req.error = e;
        if (req.onerror) req.onerror();
        return;
      }
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  };
  const api = (name, tx) => {
    const store = storeOf(name);
    return {
      get(key) {
        const req = request();
        req.__work = () => (store.rows.has(key) ? store.rows.get(key) : undefined);
        return req;
      },
      getAll(range) {
        const req = request();
        req.__work = () =>
          [...store.rows.entries()]
            .filter(([k]) => !range || range.includes(k))
            .map(([, v]) => v);
        return req;
      },
      put(value) {
        const req = request();
        req.__work = () => {
          store.rows.set(value[store.keyPath], value);
          return value[store.keyPath];
        };
        if (tx) req.__work = ((inner) => () => { inner(); if (tx.oncomplete) tx.oncomplete(); })(req.__work);
        return req;
      },
      delete(keyOrRange) {
        const req = request();
        req.__work = () => {
          if (keyOrRange && keyOrRange.__range) {
            for (const k of [...store.rows.keys()]) if (keyOrRange.includes(k)) store.rows.delete(k);
          } else {
            store.rows.delete(keyOrRange);
          }
          return undefined;
        };
        if (tx) req.__work = ((inner) => () => { inner(); if (tx.oncomplete) tx.oncomplete(); })(req.__work);
        return req;
      },
      clear() {
        const req = request();
        req.__work = () => {
          store.rows.clear();
          return undefined;
        };
        if (tx) req.__work = ((inner) => () => { inner(); if (tx.oncomplete) tx.oncomplete(); })(req.__work);
        return req;
      },
    };
  };
  const db = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n, opts) => {
      stores.set(n, { keyPath: (opts && opts.keyPath) || "key", rows: new Map() });
      return {};
    },
    transaction: (names) => {
      const tx = { oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = (n) => api(n, tx);
      if (!stall) defer(() => tx.oncomplete && tx.oncomplete());
      return tx;
    },
  };
  return {
    stores,
    open: () => {
      const req = {};
      defer(() => {
        req.result = db;
        if (db.objectStoreNames.contains("media") === false && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
}

// ── minimal browser + userscript environment ─────────────────────────
function installStubs() {
  const el = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {}, remove() {},
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [], insertBefore() {}, focus() {}, click() {},
    textContent: "", innerHTML: "", value: "",
  });
  globalThis.window = globalThis.window || globalThis;
  globalThis.document = globalThis.document || {
    readyState: "loading",
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    createElement: el, createElementNS: el, head: el(), documentElement: el(), body: el(), cookie: "",
  };
  globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
  globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});
  // Node >= 21 exposes navigator as a getter-only global.
  try {
    globalThis.navigator = globalThis.navigator || { userAgent: "node-cache-first-check" };
  } catch (e) {
    /* already supplied by the runtime */
  }
  const ls = new Map();
  globalThis.localStorage = {
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => ls.set(k, String(v)),
    removeItem: (k) => ls.delete(k),
  };
  globalThis.IDBKeyRange = {
    bound: (lower, upper) => ({ __range: true, lower, upper, includes: (k) => k >= lower && k < upper }),
  };
  globalThis.URL.createObjectURL = () => `blob:node-fake/${Math.random().toString(16).slice(2)}`;
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.fetch = (url) => {
    net.fetch++;
    net.urls.push(url);
    return Promise.reject(new Error("network disabled in check"));
  };
  globalThis.BroadcastChannel = globalThis.BroadcastChannel;
  globalThis.GM_getValue = undefined;
  globalThis.GM_setValue = undefined;
  globalThis.GM_xmlhttpRequest = () => {
    net.gm++;
    return undefined;
  };
  globalThis.GM_registerMenuCommand = undefined;
  globalThis.GM_addValueChangeListener = undefined;
}

const blobOf = (text) => new Blob([text], { type: "audio/mpeg" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// cachePut() resolves before its transaction completes (the real module is
// fire-and-forget about the write), so settle the fake's deferred work too
// before asserting on what a lookup sees.
const putCached = async (mod, url, blob) => {
  await mod.cachePut(url, blob);
  await sleep(20);
};

async function main() {
  console.log("osu! Local Favorites - cache-first playback contract");
  console.log(`${DIM}loading ${path.relative(ROOT, MODULE).split(path.sep).join("/")} against a request-counting fake IndexedDB${RESET}`);

  installStubs();
  const realWarn = console.warn;
  console.warn = () => {};

  const fake = makeIdb();
  globalThis.indexedDB = { open: fake.open }; // the module reads `indexedDB.open(...)`
  const mod = await import(pathToFileURL(MODULE).href);
  const { GM_setValue } = await import(pathToFileURL(path.join(ROOT, "src", "core", "gm-shim.js")).href);
  console.warn = realWarn;

  const URL_A = "https://hina.example/song-a.mp3";
  const URL_B = "https://hina.example/song-b.mp3";
  const URL_C = "https://b.ppy.sh/preview/4242.mp3";
  const blobA = blobOf("cached bytes A");
  const blobC = blobOf("official preview bytes");

  // 1. miss
  check("cache miss resolves null", (await mod.lookupCachedBlob(URL_A)) === null);
  check("cache miss issues no request", net.fetch === 0 && net.gm === 0, `fetch=${net.fetch} gm=${net.gm}`);

  // 2. cold persistent hit (nothing prewarmed, still no request)
  await putCached(mod, URL_A, blobA);
  const coldHit = await mod.lookupCachedBlob(URL_A);
  check("IndexedDB hit resolves the Blob", coldHit === blobA);
  check("IndexedDB hit issues no request", net.fetch === 0 && net.gm === 0, `fetch=${net.fetch} gm=${net.gm}`);

  // 3. prewarm -> synchronous answer
  await putCached(mod, URL_C, blobC);
  mod.prewarmCachedPreview(URL_C);
  await sleep(20);
  check("prewarmed entry is available synchronously", mod.getKnownCachedBlob(URL_C) === blobC);
  check("prewarm issues no request", net.fetch === 0 && net.gm === 0, `fetch=${net.fetch} gm=${net.gm}`);
  check("synchronous hit also answers the click-time lookup", (await mod.lookupCachedBlob(URL_C)) === blobC);

  // 3b. the streaming writer must not re-download a track that is cached
  const writerResult = await mod.startStreamingCacheWrite(URL_C, { isStillWanted: () => true });
  check(
    "streaming writer skips a fully cached track",
    writerResult === true && net.fetch === 0 && net.gm === 0,
    `result=${writerResult} fetch=${net.fetch} gm=${net.gm}`,
  );

  // 4. expiry + "never" mode
  GM_setValue("osu_cache_duration", "24h");
  const stale = blobOf("48h old");
  await putCached(mod, URL_B, stale);
  fake.stores.get("media").rows.get(URL_B).cachedAt = Date.now() - 48 * 60 * 60 * 1000;
  check("expired entry misses", (await mod.lookupCachedBlob(URL_B)) === null);
  check("expired entry is not remembered by a prewarm", (mod.prewarmCachedPreview(URL_B), await sleep(20), mod.getKnownCachedBlob(URL_B) === null));
  GM_setValue("osu_cache_duration", "never");
  check("'never' mode misses even with fresh bytes", (await mod.lookupCachedBlob(URL_A)) === null);
  GM_setValue("osu_cache_duration", "always");
  check("'always' mode hits the same entry", (await mod.lookupCachedBlob(URL_A)) === blobA);

  // 5. forgetting a copy that failed to decode
  mod.prewarmCachedPreview(URL_A);
  await mod.forgetCachedMedia(URL_A);
  await sleep(30);
  check("forgotten entry misses on the next lookup", (await mod.lookupCachedBlob(URL_A)) === null);
  check("forgotten entry is not re-remembered by an in-flight lookup", mod.getKnownCachedBlob(URL_A) === null);
  check("forget issues no request", net.fetch === 0 && net.gm === 0, `fetch=${net.fetch} gm=${net.gm}`);

  // 6. bounded lookup against a wedged store
  globalThis.indexedDB = { open: makeIdb({ stall: true }).open };
  const stallModule = await import(pathToFileURL(MODULE).href + `?stall=${Date.now()}`);
  const started = Date.now();
  const stalled = await stallModule.lookupCachedBlob("https://hina.example/stalled.mp3", 60);
  const elapsed = Date.now() - started;
  check("wedged storage cannot stall the source decision", stalled === null && elapsed < 400, `resolved in ${elapsed}ms`);

  // 7. the shipped bundle carries the path (and none of the old network-first one)
  if (!fs.existsSync(BUNDLE)) {
    check("dist bundle exists", false, "run npm run build first");
  } else {
    const out = fs.readFileSync(BUNDLE, "utf8");
    check("bundle contains the cache-first lookup", out.includes("lookupCachedBlob") && out.includes("prewarmCachedPreview"));
    check("bundle contains the play-request guard", out.includes("_pendingSourceId") && out.includes("_playRequestSeq"));
    check("bundle has no network-first source assignment", !out.includes("audio.src = previewUrl"));
    check("bundle keeps the pre-request cache check", out.includes("hasFreshCachedCopy"));
    check("bundle keeps the streaming writer", out.includes("startStreamingCacheWrite"));
  }

  console.log("");
  if (failures) {
    console.log(`${RED}${failures} cache-first check(s) failed.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}cache-first contract holds${RESET} - no request is issued to decide a cached track's source.`);
}

main().catch((err) => {
  console.error(`${RED}check crashed${RESET}: ${err && err.message}`);
  process.exit(1);
});
