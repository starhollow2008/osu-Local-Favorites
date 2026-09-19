# Stripped comments

512 comments were removed from [`osu-local-favorites.user.js`](./osu-local-favorites.user.js) by `npm run build` - the built script ships without them.

Each entry links to the **line of the built userscript** the comment was attached to: the
line it documented, or the first code line after it when the comment sat on its own. The
`src L…` number on the right is the comment's line in the module it came from.

Not listed here, because they stay in the built file:

- the `==UserScript==` metadata block (`meta/userscript-header.txt`)
- the generated context table at the top of the file
- the per-module section banners (`// ━━━━━━━━━━ src/… ━━━━━━━━━━`)

## Contents

1. [`src/core/gm-shim.js`](#core-gm-shim-js) - 12 comments, [first](./osu-local-favorites.user.js#L73)
2. [`src/core/interceptor.js`](#core-interceptor-js) - 8 comments, [first](./osu-local-favorites.user.js#L173)
3. [`src/core/errors.js`](#core-errors-js) - 6 comments, [first](./osu-local-favorites.user.js#L276)
4. [`src/data/storage.js`](#data-storage-js) - 9 comments, [first](./osu-local-favorites.user.js#L351)
5. [`src/data/collections.js`](#data-collections-js) - 4 comments, [first](./osu-local-favorites.user.js#L418)
6. [`src/ui/theme.js`](#ui-theme-js) - 6 comments, [first](./osu-local-favorites.user.js#L480)
7. [`src/data/mirrors.js`](#data-mirrors-js) - 9 comments, [first](./osu-local-favorites.user.js#L557)
8. [`src/api/previews.js`](#api-previews-js) - 6 comments, [first](./osu-local-favorites.user.js#L668)
9. [`src/data/playback-settings.js`](#data-playback-settings-js) - 2 comments, [first](./osu-local-favorites.user.js#L739)
10. [`src/data/media-cache-db.js`](#data-media-cache-db-js) - 47 comments, [first](./osu-local-favorites.user.js#L758)
11. [`src/ui/media-session.js`](#ui-media-session-js) - 12 comments, [first](./osu-local-favorites.user.js#L1266)
12. [`src/ui/audio-player.js`](#ui-audio-player-js) - 26 comments, [first](./osu-local-favorites.user.js#L1451)
13. [`src/ui/download-menu.js`](#ui-download-menu-js) - 6 comments, [first](./osu-local-favorites.user.js#L1716)
14. [`src/ui/genre-filter.js`](#ui-genre-filter-js) - 9 comments, [first](./osu-local-favorites.user.js#L1804)
15. [`src/ui/collections-menu.js`](#ui-collections-menu-js) - 3 comments, [first](./osu-local-favorites.user.js#L2058)
16. [`src/api/gist-backup.js`](#api-gist-backup-js) - 8 comments, [first](./osu-local-favorites.user.js#L2312)
17. [`src/api/osu-api.js`](#api-osu-api-js) - 31 comments, [first](./osu-local-favorites.user.js#L2421)
18. [`src/data/beatmap-extraction.js`](#data-beatmap-extraction-js) - 15 comments, [first](./osu-local-favorites.user.js#L2720)
19. [`src/data/favorite-detection.js`](#data-favorite-detection-js) - 7 comments, [first](./osu-local-favorites.user.js#L2971)
20. [`src/ui/heart-visual.js`](#ui-heart-visual-js) - 4 comments, [first](./osu-local-favorites.user.js#L3071)
21. [`src/data/enrichment.js`](#data-enrichment-js) - 15 comments, [first](./osu-local-favorites.user.js#L3104)
22. [`src/data/reenrichment.js`](#data-reenrichment-js) - 3 comments, [first](./osu-local-favorites.user.js#L3263)
23. [`src/data/toggle-favorite.js`](#data-toggle-favorite-js) - 4 comments, [first](./osu-local-favorites.user.js#L3335)
24. [`src/ui/copy-all-button.js`](#ui-copy-all-button-js) - 13 comments, [first](./osu-local-favorites.user.js#L3371)
25. [`src/ui/floating-heart.js`](#ui-floating-heart-js) - 26 comments, [first](./osu-local-favorites.user.js#L3512)
26. [`src/ui/settings.js`](#ui-settings-js) - 44 comments, [first](./osu-local-favorites.user.js#L3756)
27. [`src/ui/main-panel.js`](#ui-main-panel-js) - 99 comments, [first](./osu-local-favorites.user.js#L5061)
28. [`src/ui/menu-commands.js`](#ui-menu-commands-js) - 1 comments, [first](./osu-local-favorites.user.js#L6465)
29. [`src/ui/guest-fallback.js`](#ui-guest-fallback-js) - 10 comments, [first](./osu-local-favorites.user.js#L6500)
30. [`src/ui/guest-downloads.js`](#ui-guest-downloads-js) - 16 comments, [first](./osu-local-favorites.user.js#L6572)
31. [`src/core/toast.js`](#core-toast-js) - 1 comments, [first](./osu-local-favorites.user.js#L6724)
32. [`src/data/version-check.js`](#data-version-check-js) - 7 comments, [first](./osu-local-favorites.user.js#L6751)
33. [`src/ui/update-prompt.js`](#ui-update-prompt-js) - 7 comments, [first](./osu-local-favorites.user.js#L6829)
34. [`src/core/init.js`](#core-init-js) - 36 comments, [first](./osu-local-favorites.user.js#L6939)

---

## `src/core/gm-shim.js`

12 comments · userscript [L73](./osu-local-favorites.user.js#L73) - [L163](./osu-local-favorites.user.js#L163)

**[L73](./osu-local-favorites.user.js#L73)** · src L1

```js
// ═══ GM storage compatibility shim ═══
// Some userscript-manager environments (seen on certain mobile browsers)
// only partially implement the GM_ API: GM_getValue/GM_setValue exist as
// callable no-op stubs that log "GM_getValue is not supported" to the
// console instead of throwing - so a plain `typeof GM_getValue ===
// "function"` check passes even though nothing is actually being
// persisted, and every read comes back undefined regardless of the
// default value passed in. That alone was enough to make favoriting
// crash outright (toggleFavorite indexing into an undefined favorites
// object). We do a real write-then-read round trip once at startup and,
// if it doesn't survive, silently redirect all GM_getValue/GM_setValue
// calls to localStorage instead. Every one of this script's ~60 existing
// call sites keeps calling GM_getValue/GM_setValue exactly as before -
// shadowing the names here at the top of the IIFE is enough to redirect
// all of them, no need to touch each call site individually.
```

**[L76](./osu-local-favorites.user.js#L76)** · src L19

```js
// Cross-tab notification channel used when native GM storage works but the
// userscript manager does not expose a working GM_addValueChangeListener.
// Only the changed key is written here; the authoritative value remains in
// native GM storage. In fallback mode, GM_setValue already writes the shared
// localStorage object, so this extra signal is unnecessary.
```

**[L83](./osu-local-favorites.user.js#L83)** · src L31

```js
// Node exposes BroadcastChannel too; unref keeps the build checker from
// waiting forever for this browser-only communication channel.
```

**[L102](./osu-local-favorites.user.js#L102)** · src L52

```js
// Nothing more we can do if localStorage is also unavailable/full.
```

**[L105](./osu-local-favorites.user.js#L105)** · src L56

```js
// In-memory write-through cache over the localStorage fallback.
// Without this, EVERY GM_getValue call re-serialized the entire store -
// with a large favorites library (500+) that meant multi-megabyte
// JSON.parse calls hundreds of times per panel render, causing the
// exponential slowdown / "Forced reflow" violations. Reads hit the cache;
// writes update the cache and persist asynchronously-ish (sync write,
// but only one stringify per mutation instead of read+parse+stringify).
```

**[L105](./osu-local-favorites.user.js#L105)** · src L63

```js
// null = not loaded yet
```

**[L107](./osu-local-favorites.user.js#L107)** · src L65

```js
// A fallback-store write in another tab updates localStorage, but this tab's
// in-memory compatibility cache would otherwise keep returning the old object
// forever. In that mode the storage event is the authoritative invalidation
// signal; the data layer will separately notify the UI to re-render.
```

**[L147](./osu-local-favorites.user.js#L147)** · src L109

```js
// Persist the mutated object directly - no re-parse needed.
```

**[L150](./osu-local-favorites.user.js#L150)** · src L113

```js
// Broadcast a scalar storage-event notification without duplicating the
// potentially large favorites/collections payload into localStorage. The
// timestamp + random suffix guarantees that repeated writes always produce a
// distinct storage event.
```

**[L153](./osu-local-favorites.user.js#L153)** · src L120

```js
// BroadcastChannel is the primary notification path because it is not
// dependent on storage-event delivery from the userscript sandbox.
```

**[L156](./osu-local-favorites.user.js#L156)** · src L125

```js
// localStorage notification below is the compatibility fallback.
```

**[L163](./osu-local-favorites.user.js#L163)** · src L133

```js
// Native GM storage remains authoritative; a localStorage failure only
// removes this supplementary notification path.
```


## `src/core/interceptor.js`

8 comments · userscript [L173](./osu-local-favorites.user.js#L173) - [L262](./osu-local-favorites.user.js#L262)

**[L173](./osu-local-favorites.user.js#L173)** · src L1

```js
// ═══ Page-world XHR/fetch interceptor ═══
// Also blocks login redirects triggered by unauthenticated favourite actions.
```

**[L176](./osu-local-favorites.user.js#L176)** · src L6

```js
// ── XHR intercept: block /favourites requests ──
```

**[L212](./osu-local-favorites.user.js#L212)** · src L43

```js
// ── Fetch intercept: block /favourites and auth-error responses ──
```

**[L226](./osu-local-favorites.user.js#L226)** · src L58

```js
// ── Navigation intercept: block login redirects from favourite clicks ──
// osu! SPA navigates via history.pushState when not logged in for some actions.
// We trap pushState/replaceState and location.href assignments that redirect to /login.
// Only redirects that originate within 500ms of a favourite-click are blocked.
```

**[L230](./osu-local-favorites.user.js#L230)** · src L66

```js
// Check if this looks like a favourite button
```

**[L249](./osu-local-favorites.user.js#L249)** · src L86

```js
// block login redirect
```

**[L257](./osu-local-favorites.user.js#L257)** · src L94

```js
// block login redirect
```

**[L262](./osu-local-favorites.user.js#L262)** · src L99

```js
// Intercept anchor navigation to /login triggered by favourite actions
```


## `src/core/errors.js`

6 comments · userscript [L276](./osu-local-favorites.user.js#L276) - [L331](./osu-local-favorites.user.js#L331)

**[L276](./osu-local-favorites.user.js#L276)** · src L1

```js
// ═══ Error reporting ═══
// One place for every failure in this script to end up: a structured
// console.error() (name/message/HTTP status/stack, so pasting that one
// line is enough to file a useful bug report) plus a small on-page toast
// when it's worth telling the user something failed. Call sites that
// already showed a plain toast on failure route through reportError()
// below instead of building their own message, so they pick up the
// console detail for free without changing what appears on screen.
```

**[L276](./osu-local-favorites.user.js#L276)** · src L9

```js
// don't flood the screen if something fails repeatedly
```

**[L280](./osu-local-favorites.user.js#L280)** · src L13

```js
// page not ready - the console line already has the detail
```

**[L308](./osu-local-favorites.user.js#L308)** · src L41

```js
// context: short human label for where this happened, shown in both the
// toast and the console line (e.g. "Gist backup", "Toggle favorite").
// err: whatever was thrown/rejected - normally an Error, handled
// gracefully either way. extra: optional {status, statusText, ...} for
// callers that know more than what's already on the Error object (most
// network helpers below attach .status/.statusText themselves, so this is
// rarely needed).
```

**[L326](./osu-local-favorites.user.js#L326)** · src L66

```js
// already told the user something just failed
```

**[L331](./osu-local-favorites.user.js#L331)** · src L71

```js
// Last-resort safety net for bugs that slip past every try/catch above.
// window-level "error"/"unhandledrejection" fire for *every* script on the
// page, not just this one, so each listener below only reports when the
// stack trace contains one of this script's own function names - a
// best-effort filter (Tampermonkey doesn't expose a reliable "this came
// from a userscript" flag), but good enough to avoid popping a Local
// Favorites error toast for osu!'s own unrelated page bugs.
```


## `src/data/storage.js`

9 comments · userscript [L351](./osu-local-favorites.user.js#L351) - [L406](./osu-local-favorites.user.js#L406)

**[L351](./osu-local-favorites.user.js#L351)** · src L6

```js
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
```

**[L363](./osu-local-favorites.user.js#L363)** · src L32

```js
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
```

**[L371](./osu-local-favorites.user.js#L371)** · src L53

```js
// A cheap signature over *which ids are favorited*, deliberately ignoring
// the contents of each record. Background enrichment calls setFavorites()
// roughly once a second purely to attach metadata to an existing entry;
// without this, every one of those writes would trigger a full heart
// resync across the page for no visible change.
//
// Count alone is not enough (a restore can swap ids while keeping the
// count), so the id sum comes along for the ride. Both are O(n) integer
// work over keys that were about to be serialized by GM_setValue anyway.
```

**[L390](./osu-local-favorites.user.js#L390)** · src L81

```js
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
```

**[L395](./osu-local-favorites.user.js#L395)** · src L98

```js
// One bad listener must not stop the others, and must never take
// down the write that triggered it.
```

**[L400](./osu-local-favorites.user.js#L400)** · src L105

```js
// Drops the in-memory cache so the next getFavorites() re-reads persisted
// state. Exported (rather than exposing _favsCache itself) so other modules
// - cross-tab sync in core/init.js, the localStorage-fallback listener right
// below - can invalidate it without holding a live, writable binding into
// this module's private state.
```

**[L401](./osu-local-favorites.user.js#L401)** · src L111

```js
// GM_addValueChangeListener supplies the new value directly. Prefer it when
// available: some managers deliver the notification before a subsequent
// GM_getValue() can observe the updated store, which made page A rebuild
// against its old cache after page B changed a favorite.
```

**[L402](./osu-local-favorites.user.js#L402)** · src L116

```js
// Another tab (or a restore) replaced the store wholesale, so this tab's
// idea of what is favorited is void - force listeners to re-read rather
// than comparing against a signature computed from the old contents.
```

**[L406](./osu-local-favorites.user.js#L406)** · src L123

```js
// Invalidate on cross-tab writes in the localStorage-fallback mode. (In
// native GM mode this event never fires for GM storage - init()'s
// GM_addValueChangeListener handler covers that path instead.)
```


## `src/data/collections.js`

4 comments · userscript [L418](./osu-local-favorites.user.js#L418) - [L454](./osu-local-favorites.user.js#L454)

**[L418](./osu-local-favorites.user.js#L418)** · src L3

```js
// ═══ Collections (playlists) ═══
// User-defined groupings of favorites, entirely separate from osu!'s own
// collections. Stored as { [collectionId]: { name, created, ids: [beatmapId,...] } }.
```

**[L420](./osu-local-favorites.user.js#L420)** · src L8

```js
// In-memory write-through cache, mirroring the favorites store above.
// Every card row's "+ Playlist" badge calls collectionsContainingMap() 2-3
// times during buildCard, and each of those used to deserialize the whole
// collections store out of GM storage - 1000+ reads for a single 500-card
// render. All writers go through setCollections(), so caching is coherent;
// cross-tab invalidation matches the favorites cache (storage event below +
// GM_addValueChangeListener in init()).
```

**[L431](./osu-local-favorites.user.js#L431)** · src L26

```js
// See invalidateFavoritesCache() in data/storage.js for why this is a
// function rather than an exported mutable binding.
```

**[L454](./osu-local-favorites.user.js#L454)** · src L51

```js
// Adds/removes a beatmap from a collection; returns the new membership state.
```


## `src/ui/theme.js`

6 comments · userscript [L480](./osu-local-favorites.user.js#L480) - [L543](./osu-local-favorites.user.js#L543)

**[L480](./osu-local-favorites.user.js#L480)** · src L3

```js
// ═══ Theme ═══
// Accent color and the idle/hover/active opacity levels used by the cover
// preview button are all exposed as CSS custom properties on <html>, rather
// than hardcoded throughout the UI. Settings → Appearance just updates these
// variables (and persists them) - every element that references
// var(--osu-fav-accent) etc. picks up the change immediately, with no need
// to touch each individual style string.
```

**[L496](./osu-local-favorites.user.js#L496)** · src L26

```js
// Simple hex darken for the accent's hover/pressed shade - mirrors the
// original #ff66aa → #ff3377 relationship (roughly -25% lightness)
```

**[L515](./osu-local-favorites.user.js#L515)** · src L47

```js
// Applies the current theme settings to :root as CSS custom properties.
// Safe to call repeatedly (e.g. right after a Settings change) - it just
// overwrites the same handful of variables.
```

**[L527](./osu-local-favorites.user.js#L527)** · src L62

```js
// Minimal heart glyph as real SVG (not emoji) - emoji hearts render from the
// system emoji font with a fixed, non-CSS-colorable presentation, which is
// exactly why they can't be recolored. This one uses fill/stroke, so
// --osu-fav-heart-color actually takes effect.
```

**[L535](./osu-local-favorites.user.js#L535)** · src L74

```js
// Play/pause icons as inline SVGs - the old U+25B6/U+23F8 text glyphs get
// emoji presentation on mobile (▶️ / colored ⏸), which broke sizing and
// theming. SVGs render identically everywhere and inherit currentColor.
```

**[L543](./osu-local-favorites.user.js#L543)** · src L85

```js
// Player-bar icons - previous/next/shuffle/loop, same inline-SVG approach
// as playSVG/pauseSVG above and for the same reason.
```


## `src/data/mirrors.js`

9 comments · userscript [L557](./osu-local-favorites.user.js#L557) - [L644](./osu-local-favorites.user.js#L644)

**[L557](./osu-local-favorites.user.js#L557)** · src L3

```js
// ═══ Download Mirrors ═══
// Third-party beatmap mirrors, used as a fallback wherever osu!'s own
// download doesn't work - guests (osu!'s own download button/route is
// gated behind a real logged-in session), beatmaps with downloads disabled,
// or just as an alternative when the official servers are slow. Modeled
// after the mirror list in limjeck/osuplus.
```

**[L600](./osu-local-favorites.user.js#L600)** · src L52

```js
// Detects a real logged-in osu! session via the page's own current-user
// JSON blob (empty object "{}" for guests, populated for a real session).
// Used to decide whether "Official Download" is worth offering at all -
// osu!'s download route requires server-side auth and simply doesn't work
// for guests regardless of what our script does.
//
// Memoized on the blob's exact text: buildCard() reaches this via both
// resolveDefaultMirror() and buildDownloadOptions() once per card, so a
// single 500-card panel render used to re-parse the same JSON blob ~1000
// times. Keying the cache on the raw text (not just a one-shot boolean)
// keeps it correct if Turbolinks swaps in a different user blob.
```

**[L619](./osu-local-favorites.user.js#L619)** · src L82

```js
// Exported invalidator (see invalidateFavoritesCache() in data/storage.js
// for why this is a function rather than exporting the raw bindings) -
// called from core/init.js's cross-tab sync handler when another tab's
// login state may have changed.
```

**[L624](./osu-local-favorites.user.js#L624)** · src L91

```js
// Which video variant to prefer, and whether Official or Mirrors should be
// listed first - both user-configurable in Settings → Download Mirrors.
// Nothing is ever hidden by these; they only decide ordering, so the full
// set of options is always one click away in the dropdown.
```

**[L624](./osu-local-favorites.user.js#L624)** · src L95

```js
// "video" | "novideo"
```

**[L625](./osu-local-favorites.user.js#L625)** · src L96

```js
// "official" | "mirrors"
```

**[L626](./osu-local-favorites.user.js#L626)** · src L97

```js
// "" | "official" | "official_novideo" | "<mirror.key>" | "<mirror.key>_novideo"
```

**[L628](./osu-local-favorites.user.js#L628)** · src L99

```js
// Flat, order-independent registry of every possible download destination
// (both Official variants + every mirror's variants), keyed stably so a
// stored "default mirror" choice keeps meaning the same thing no matter
// how the user's video/source-order preferences later reorder the
// dropdown itself. Used to populate the Settings picker and to resolve a
// stored default back into a real URL.
```

**[L644](./osu-local-favorites.user.js#L644)** · src L121

```js
// Resolves the stored default-mirror key into an actual {label, url} for
// this beatmap, or null if it can't currently be used - either because
// the setting is unset, the chosen mirror has since been disabled, or
// it's Official but the user isn't signed in. Returning null is the
// signal to fall back to showing the normal dropdown, so this never
// hands back a link that would just fail.
```


## `src/api/previews.js`

6 comments · userscript [L668](./osu-local-favorites.user.js#L668) - [L726](./osu-local-favorites.user.js#L726)

**[L668](./osu-local-favorites.user.js#L668)** · src L5

```js
// ═══ Full-length previews (Hinamizawa music mirror) ═══
// osu!'s own preview clip is a fixed ~10s cut. mirror.hinamizawa.ai runs a
// separate music-streaming API (distinct from its beatmap-download mirror)
// that serves the full track from its own disk when it has one cached, and
// otherwise transparently falls back to proxying the same ~30s official
// clip while it extracts the full song in the background - so pointing
// the preview player at it is a strict upgrade, never a worse experience
// than what we already show. No auth, open CORS, HTTP Range for seeking.
```

**[L670](./osu-local-favorites.user.js#L670)** · src L15

```js
// The mirror asks integrations to identify themselves so traffic can be
// attributed and supported. Keep this separate from navigator.userAgent:
// browser media requests control their own forbidden User-Agent header,
// while the metadata request below is made through GM_xmlhttpRequest.
```

**[L672](./osu-local-favorites.user.js#L672)** · src L21

```js
// beatmapset id -> Promise<Song|null>
```

**[L674](./osu-local-favorites.user.js#L674)** · src L23

```js
// Firefox for Android on some devices (including Redmi models) is much
// less forgiving of a cold cross-origin stream. Keep the mirror as the
// primary source when full-song previews are enabled, but do not make the
// first tap compete with a second GM_xmlhttpRequest cache download. If the
// mirror is unavailable, undecodable, or only has the short clip, the
// player falls back to osu!'s direct preview below.
```

**[L687](./osu-local-favorites.user.js#L687)** · src L42

```js
// Fetch only when a user starts a track, never once per visible card. The
// Song response's duration_sec lets us distinguish a genuinely short song
// from the mirror's transitional ~30s osu! preview without delaying the
// click that starts playback.
```

**[L726](./osu-local-favorites.user.js#L726)** · src L85

```js
// Preserve the useful metadata across panel re-renders and future plays.
// These fields intentionally match the Music API response names.
```


## `src/data/playback-settings.js`

2 comments · userscript [L739](./osu-local-favorites.user.js#L739) - [L742](./osu-local-favorites.user.js#L742)

**[L739](./osu-local-favorites.user.js#L739)** · src L3

```js
// ═══ Music Playback settings (loop / auto next / shuffle / volume) ═══
```

**[L742](./osu-local-favorites.user.js#L742)** · src L7

```js
// 0-100, applied as audio.volume/100
```


## `src/data/media-cache-db.js`

47 comments · userscript [L758](./osu-local-favorites.user.js#L758) - [L1263](./osu-local-favorites.user.js#L1263)

**[L758](./osu-local-favorites.user.js#L758)** · src L3

```js
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
```

**[L758](./osu-local-favorites.user.js#L758)** · src L16

```js
// "custom"|"30min"|"1h"|"6h"|"12h"|"24h"|"1week"|"1month"|"always"|"never"
```

**[L776](./osu-local-favorites.user.js#L776)** · src L34

```js
// TTL in ms, or Infinity for "always" - "never" is handled by callers
// before this is ever reached (they skip the cache store outright).
```

**[L790](./osu-local-favorites.user.js#L790)** · src L50

```js
// Partial ("while streaming") downloads live in their own store until the
// whole track has arrived; see startStreamingCacheWrite() at the bottom.
// Bumping the version is what creates it for existing installs - the media
// store and everything already cached in it are left untouched.
```

**[L793](./osu-local-favorites.user.js#L793)** · src L57

```js
// URLs whose stored copy was discarded as unusable (see forgetCachedMedia).
// A lookup that was already in flight when that happened must not put the
// rejected bytes straight back into the memory LRU, or the next play would
// pick the broken copy again.
```

**[L809](./osu-local-favorites.user.js#L809)** · src L77

```js
// Fail soft - callers treat a null db exactly like "cache
// unavailable" and fall back to plain network URLs, same as if
// caching were switched off.
```

**[L835](./osu-local-favorites.user.js#L835)** · src L106

```js
// Fresh bytes are being written, so this URL is trustworthy again.
```

**[L838](./osu-local-favorites.user.js#L838)** · src L110

```js
// Best-effort - a failed write just means no caching for this one item.
```

**[L842](./osu-local-favorites.user.js#L842)** · src L115

```js
// Revoke every blob URL handed out from the cache - otherwise clearing
// the IndexedDB store still leaves those object URLs (and the Blobs
// behind them) alive in memory until the tab closes, and any <img>/
// <audio> still pointing at one would keep "working" despite the
// underlying cache entry no longer existing.
```

**[L849](./osu-local-favorites.user.js#L849)** · src L127

```js
// Half-downloaded tracks go too - otherwise "Clear cache" would
// report nothing cached while still holding megabytes of partial
// audio that nothing can ever play.
```

**[L858](./osu-local-favorites.user.js#L858)** · src L139

```js
// Used by the Settings panel to show how much is currently stored.
```

**[L863](./osu-local-favorites.user.js#L863)** · src L145

```js
// Partial chunks count toward the reported size: they occupy the
// same quota, and hiding them would make "Clear cache" look like it
// freed less than it actually did.
```

**[L881](./osu-local-favorites.user.js#L881)** · src L166

```js
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
```

**[L910](./osu-local-favorites.user.js#L910)** · src L206

```js
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
```

**[L910](./osu-local-favorites.user.js#L910)** · src L216

```js
// sourceUrl -> objectURL
```

**[L912](./osu-local-favorites.user.js#L912)** · src L218

```js
// One definition of "this cache entry is usable right now", shared by the
// playback source choice, the streaming writer's pre-request check and
// resolveCachedMediaUrl below. They each used to re-derive it, so a change
// to the TTL rules could silently make one of them disagree with the others.
```

**[L918](./osu-local-favorites.user.js#L918)** · src L228

```js
// A tiny in-memory LRU of fully cached songs. IndexedDB reads are async and
// playback has to choose its source synchronously, inside the click that
// started it - so without this, a song cached seconds ago still opened a
// network request that was then immediately swapped away. With it, a repeat
// play (replay, back/next, loop, an auto-next round trip) starts from the
// local copy with no request at all.
```

**[L919](./osu-local-favorites.user.js#L919)** · src L235

```js
// sourceUrl -> { blob, cachedAt }
```

**[L923](./osu-local-favorites.user.js#L923)** · src L239

```js
// Explicitly rejected bytes (a local copy that failed to decode) must not
// come back through a late lookup; only a new cachePut clears this.
```

**[L927](./osu-local-favorites.user.js#L927)** · src L245

```js
// oldest first
```

**[L931](./osu-local-favorites.user.js#L931)** · src L249

```js
// Synchronous: the Blob for url when this session has already seen a fresh
// cached copy, else null. Never touches IndexedDB, so it is safe to call in
// the middle of a click/pointer handler.
```

**[L938](./osu-local-favorites.user.js#L938)** · src L259

```js
// LRU touch
```

**[L943](./osu-local-favorites.user.js#L943)** · src L264

```js
// Async boolean form of the same question - "is a request for this URL
// pointless?" - for callers that only need to decide whether to fetch.
```

**[L955](./osu-local-favorites.user.js#L955)** · src L278

```js
// Resolves to a URL safe to hand straight to <img src> / <audio src>: a
// local blob: URL when a fresh cached copy exists, otherwise the original
// network URL unchanged - so a cache miss never delays first-time
// playback/display waiting on a full download. A miss also kicks off a
// background fetch to populate the cache for next time; fire-and-forget,
// not awaited by the caller either way. This runs on Firefox Android too
// now - caching should behave the same across browsers/platforms.
```

**[L972](./osu-local-favorites.user.js#L972)** · src L302

```js
// The blob just changed (first fetch, or a re-fetch after the old
// entry expired) - drop any object URL for the previous bytes so the
// next resolve mints one for the new blob instead of quietly serving
// stale content forever.
```

**[L982](./osu-local-favorites.user.js#L982)** · src L316

```js
// Returns the cached Blob for url when a fresh copy exists (per the current
// TTL setting), or null. Pure read: unlike resolveCachedMediaUrl it never
// kicks off a background fetch and never mints a blob: URL - callers use it
// when they need the raw bytes (playback source swap) rather than something
// to assign to an <img>/<audio> src.
```

**[L987](./osu-local-favorites.user.js#L987)** · src L326

```js
// Remember it so the next play of this song can pick the local copy
// synchronously, without even this lookup.
```

**[L992](./osu-local-favorites.user.js#L992)** · src L333

```js
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
```

**[L993](./osu-local-favorites.user.js#L993)** · src L350

```js
// url -> in-flight lookup promise
```

**[L995](./osu-local-favorites.user.js#L995)** · src L352

```js
// One shared read per URL: a prewarm that is still running when the user
// clicks is awaited rather than restarted, and concurrent callers cannot
// stack duplicate IndexedDB reads.
```

**[L1008](./osu-local-favorites.user.js#L1008)** · src L368

```js
// Fire-and-forget hydration. Safe to call as often as the UI likes: a URL
// already in the LRU or already being read is skipped outright, and the
// read only ever populates the bounded LRU (never the object-URL cache, so
// prewarming tracks the user has not played holds no Blob alive).
```

**[L1015](./osu-local-favorites.user.js#L1015)** · src L379

```js
// Cache-first decision for playback. Resolves to the cached Blob when this
// browser holds a fresh copy, else null - and callers treat null as "use
// the network source". Synchronous fast path when already hydrated.
```

**[L1030](./osu-local-favorites.user.js#L1030)** · src L397

```js
// A timed-out lookup still populates the LRU when it eventually
// resolves, so the next play of this song decides synchronously.
```

**[L1037](./osu-local-favorites.user.js#L1037)** · src L406

```js
// Drops a cached copy entirely - used when the stored bytes turned out to
// be unusable (a local play that will not decode). The next play re-fetches
// from the network and caches a fresh copy.
```

**[L1052](./osu-local-favorites.user.js#L1052)** · src L424

```js
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
```

**[L1052](./osu-local-favorites.user.js#L1052)** · src L447

```js
// batch partial writes instead of one per network packet
```

**[L1053](./osu-local-favorites.user.js#L1053)** · src L448

```js
// url -> { promise, cancel }
```

**[L1125](./osu-local-favorites.user.js#L1125)** · src L520

```js
// The GM_ path: one whole-file request, written in a single go. Used when
// fetch() is unavailable or the stream was CORS-blocked before any bytes
// landed. Any partial chunks are discarded once the full copy is in.
```

**[L1140](./osu-local-favorites.user.js#L1140)** · src L538

```js
// Chunks with no validator cannot be trusted to belong to the bytes the
// server would send now, so start over rather than resume onto them.
```

**[L1156](./osu-local-favorites.user.js#L1156)** · src L556

```js
// A 200 while we asked for a range means If-Range failed (the file
// changed) or the server ignored it - the body is the whole file again,
// so the chunks on disk no longer line up with it.
```

**[L1180](./osu-local-favorites.user.js#L1180)** · src L583

```js
// keep what already arrived, for a resume later
```

**[L1209](./osu-local-favorites.user.js#L1209)** · src L612

```js
// Nothing usable arrived (CORS-blocked, offline, mirror error) and no
// bytes were persisted - let the caller try the GM_ whole-file path.
```

**[L1219](./osu-local-favorites.user.js#L1219)** · src L624

```js
// Already fully cached (this is the track that is playing from the cache):
// nothing to download, just make sure no half-file chunks are left behind.
```

**[L1223](./osu-local-favorites.user.js#L1223)** · src L630

```js
// A stale/expired entry cannot be resumed onto - drop it with its chunks.
```

**[L1235](./osu-local-favorites.user.js#L1235)** · src L643

```js
// Starts caching `url` while it is being streamed by the media element.
// Returns a Promise<boolean> (true = a complete copy is now cached). Only
// one write per URL can be in flight; a repeat call for the same track
// returns the existing one. `isStillWanted()` is polled as bytes arrive so
// a skipped track stops consuming bandwidth immediately - and the single
// `cancel()` on the returned handle stops it without waiting for the next
// packet.
```

**[L1257](./osu-local-favorites.user.js#L1257)** · src L672

```js
/* already settled */
```

**[L1263](./osu-local-favorites.user.js#L1263)** · src L679

```js
// Used only when the Song metadata could not be read. The mirror's
// transitional preview is about 30 seconds; duration_sec is the preferred
// check because a real song may itself be short.
```


## `src/ui/media-session.js`

12 comments · userscript [L1266](./osu-local-favorites.user.js#L1266) - [L1421](./osu-local-favorites.user.js#L1421)

**[L1266](./osu-local-favorites.user.js#L1266)** · src L4

```js
// ═══ Media Session ═══
// Everything that talks to navigator.mediaSession - the OS-level media
// widget (Android notification / lock screen, macOS Now Playing, Windows
// SMTC). Split out of ui/audio-player.js, which is now only responsible
// for the <audio> element and the in-page mini-player.
//
// Every entry point is defensive on purpose. Media Session is unevenly
// implemented: Firefox Android has it but not setPositionState on older
// builds, some Chromium builds throw on a setActionHandler for an action
// they don't support, and Safari implements a subset. A throw from any of
// these would otherwise propagate into an <audio> event handler and break
// playback control that has nothing to do with the OS widget.
```

**[L1275](./osu-local-favorites.user.js#L1275)** · src L26

```js
// osu!'s canonical cover renditions and their real pixel dimensions.
// Supplying `sizes` lets the OS pick the right rendition instead of
// downloading whichever one happens to be listed first - Android's
// notification wants something small, the lock screen wants the large one.
// Only applied to URLs that match osu!'s own cover path, so a custom or
// cached URL is still offered, just without a size hint.
```

**[L1294](./osu-local-favorites.user.js#L1294)** · src L51

```js
// Returns several renditions rather than one. The previous single-entry
// version handed Android a 900x250 banner for a 64px notification icon,
// which some devices simply refused to decode and rendered as a blank tile.
```

**[L1316](./osu-local-favorites.user.js#L1316)** · src L76

```js
// Set metadata only when the track actually changed. The old code rebuilt
// a MediaMetadata on every "play" event, including a resume from pause -
// on Android that re-posts the notification, which visibly flickers the
// artwork and, on some builds, resets the OS widget's seek bar.
```

**[L1334](./osu-local-favorites.user.js#L1334)** · src L98

```js
// A rejected MediaMetadata (bad artwork URL, unsupported field) must
// not leave a stale signature behind, or the next attempt is skipped.
```

**[L1346](./osu-local-favorites.user.js#L1346)** · src L112

```js
// Firefox for Android can expose a live/cross-origin stream to the media
// notification before it has derived a finite HTMLMediaElement duration.
// The Hinamizawa Song response already carries that duration, so it stands
// in rather than publishing the 00:00-00:00 range shown by some devices.
```

**[L1358](./osu-local-favorites.user.js#L1358)** · src L128

```js
// playbackRate must be > 0: the spec rejects 0, which is exactly what a
// media element reports in some paused/stalled states, and the resulting
// throw used to be swallowed - leaving the OS widget frozen on the
// previous track's position for the rest of the session.
```

**[L1363](./osu-local-favorites.user.js#L1363)** · src L137

```js
// Some builds reject position updates while media is transitioning
// between sources; playback itself is unaffected.
```

**[L1370](./osu-local-favorites.user.js#L1370)** · src L146

```js
// Called with no argument, this resets the state. The old code never
// did this, so after playback stopped the OS widget kept showing the
// last track's elapsed time against its full duration.
```

**[L1379](./osu-local-favorites.user.js#L1379)** · src L158

```js
// Unsupported action - the browser tells us by throwing.
```

**[L1383](./osu-local-favorites.user.js#L1383)** · src L163

```js
// Previous/next are registered separately from the transport controls
// because they must reflect whether a queue exists. Registering them
// unconditionally (as before) makes Android draw enabled skip buttons that
// silently do nothing whenever playback was started outside the panel.
```

**[L1421](./osu-local-favorites.user.js#L1421)** · src L205

```js
// fastSeek is what the spec asks us to honour for scrub gestures; it
// is not implemented everywhere, so fall back to a normal seek.
```


## `src/ui/audio-player.js`

26 comments · userscript [L1451](./osu-local-favorites.user.js#L1451) - [L1685](./osu-local-favorites.user.js#L1685)

**[L1451](./osu-local-favorites.user.js#L1451)** · src L16

```js
// Singleton <audio> element, shared across every card's preview button
// and the Now Playing bar. Created once per page load and reused for the
// lifetime of the tab, so its listeners key off dynamic `_np*`/`_queue*`
// properties (reassigned by whichever panel is currently open) rather
// than closing over any one panel's local variables, which would go
// stale the moment that panel is closed and reopened.
```

**[L1454](./osu-local-favorites.user.js#L1454)** · src L25

```js
// Keep a real media element alive for the lifetime of the page. Using a
// normal network URL for playback (rather than swapping in blob: URLs
// after an async cache lookup) keeps Firefox Android's media session tied
// to a conventional media resource and, importantly, preserves the
// original click's user activation for audio.play().
// Firefox Android on Redmi devices starts media more reliably when the
// element is not asked to fetch metadata before the tap. Calling play()
// below still starts the request immediately from the user gesture.
```

**[L1483](./osu-local-favorites.user.js#L1483)** · src L62

```js
// Source URL this track's bytes are cached under (the network URL, not
// the blob: URL the element may end up playing), plus whether the current
// source is that local copy. Owned by ui/main-panel.js
// startPlayback(); initialized here so the page-lifetime element always
// has the properties before any track is chosen.
```

**[L1485](./osu-local-favorites.user.js#L1485)** · src L69

```js
// Cache-first source selection bookkeeping, owned by
// ui/main-panel.js startPlayback(): a monotonic id for the current
// play request (so a source decided after the user moved on is dropped)
// and the track whose source decision is still in flight (so its card's
// button does not act on the previous track's still-assigned src).
```

**[L1496](./osu-local-favorites.user.js#L1496)** · src L85

```js
// Kept as a property so the panel (which owns the Now Playing bar) can
// force a position refresh right after it swaps the source, without
// importing the media-session module itself.
```

**[L1502](./osu-local-favorites.user.js#L1502)** · src L94

```js
// Queue availability can change between tracks (a preview started from
// a card has no queue; one started from the panel list does), so the
// skip handlers are re-evaluated on each play rather than once at
// element creation.
```

**[L1509](./osu-local-favorites.user.js#L1509)** · src L105

```js
// Freeze the OS widget at the exact paused position rather than
// whatever it last extrapolated to.
```

**[L1511](./osu-local-favorites.user.js#L1511)** · src L109

```js
// Deliberately NOT bound to "timeupdate": that event fires every ~250ms
// while foregrounded but gets throttled to roughly once/sec by the
// browser when the tab is backgrounded - which is exactly when someone
// is actually looking at this position (lock screen / OS media widget,
// not our own in-page mini-player). Each throttled call reports a
// position that's already ~1s stale by the time it reaches the native
// widget, so the widget snaps back to it before resuming forward - a
// visible "rewinds 1s every second" stutter. setPositionState() exists
// precisely so the OS can extrapolate the position itself between
// updates; we only need to call it on real discontinuities.
```

**[L1531](./osu-local-favorites.user.js#L1531)** · src L139

```js
// The source has moved off the mirror URL; stop treating a local copy of
// those bytes as the current source, and let object-URL cleanup follow
// the fallback URL from here on.
```

**[L1534](./osu-local-favorites.user.js#L1534)** · src L145

```js
// Cache-first for the official preview too: when a fresh local copy
// exists the element is handed that blob: URL and the remote preview URL
// is never assigned, so no request is made for it. This runs from an
// asynchronous media error, so it reads the synchronous in-memory copy
// rather than awaiting a lookup; a cold/missing entry prewarms for next
// time and uses the network URL exactly as before. A cached copy that
// itself fails is caught by the error handler below, which drops it and
// retries from the network once.
```

**[L1551](./osu-local-favorites.user.js#L1551)** · src L170

```js
// Source replacement can make Firefox briefly report the failed mirror
// as paused before the new preview begins. Keep the panel's mini-player
// attached through that hand-off; the guards ensure an error or a newly
// selected track can still remove it normally.
```

**[L1570](./osu-local-favorites.user.js#L1570)** · src L193

```js
// The fallback can be selected from an asynchronous media error,
// outside the original tap's user-activation task. A rejected play()
// here does not mean the official preview failed; keep Now Playing
// visible so the user can resume it with the play control. A genuine
// media error on this fallback still reaches the error handler below.
// This used to read a variable that belongs to showFavoritesPanel()
// in ui/main-panel.js and was never in scope in this function,
// so the line threw a ReferenceError inside a promise catch. It
// surfaced only as an unhandled rejection, and the mini-player it was
// meant to keep on screen stayed hidden. The helper below already
// makes the same decision, from state that is actually reachable.
```

**[L1581](./osu-local-favorites.user.js#L1581)** · src L215

```js
// Container/MP3 duration rounding is normally sub-second. Permit a
// small margin, but a 30s fallback for a multi-minute song is never
// mistaken for a full track.
```

**[L1587](./osu-local-favorites.user.js#L1587)** · src L224

```js
// Returns true when it has swapped the source, so callers know the
// metadata they are looking at belongs to a clip being discarded.
```

**[L1594](./osu-local-favorites.user.js#L1594)** · src L233

```js
// One handler for everything that has to happen when metadata arrives.
// There used to be three separate "loadedmetadata" listeners whose
// relative order was load-order-dependent; the fallback decision in
// particular has to run before the position is published, or the OS
// widget briefly advertises the duration of a clip we are about to
// throw away.
```

**[L1595](./osu-local-favorites.user.js#L1595)** · src L240

```js
// The mirror endpoint uses a short osu! clip when it has no full
// track. duration_sec, when available, avoids treating a genuinely
// short full song as that fallback.
```

**[L1600](./osu-local-favorites.user.js#L1600)** · src L248

```js
// A mirror can be cold, unavailable, or return a response Firefox cannot
// decode. Retry the official osu! clip once, but only for the source that
// is currently active so a late error from an old track cannot interrupt a
// newly selected one.
```

**[L1603](./osu-local-favorites.user.js#L1603)** · src L255

```js
// A local copy that will not decode (an interrupted write, storage
// corruption, a codec the browser cannot pull out of a Blob) is dropped
// from the cache and retried from the network once instead of looking
// like a dead track. The retry uses whichever URL those bytes were
// cached from, so an unreachable mirror still falls through to the
// official preview by the branch below.
```

**[L1614](./osu-local-favorites.user.js#L1614)** · src L272

```js
// Not seekable until metadata for the retry is in - fine, it starts
// from the top.
```

**[L1627](./osu-local-favorites.user.js#L1627)** · src L287

```js
// The fallback is normally the raw official URL, but it is a blob: URL
// when that preview was served from the cache - compare against
// whichever source it actually selected.
```

**[L1634](./osu-local-favorites.user.js#L1634)** · src L297

```js
// Do NOT clearMediaSession() before a loop/auto-next: nulling the
// metadata (even for one synchronous tick before startPlayback()
// re-populates it) can make Android treat the session as ended and
// tear down the notification's foreground service. On a locked
// screen there is nothing left keeping the page alive after that, so
// playback dies a few seconds into the *next* track even though the
// handoff itself looked instantaneous in the console. Only clear the
// session on the branch below where playback is actually stopping.
```

**[L1636](./osu-local-favorites.user.js#L1636)** · src L307

```js
// A rejected play() here (autoplay policy after a long lock-screen
// idle) previously surfaced as an unhandled rejection, and left the
// OS widget advertising "playing" for audio that had stopped.
```

**[L1655](./osu-local-favorites.user.js#L1655)** · src L329

```js
// Single teardown for "playback has stopped for good" - end of queue, or
// both the mirror source and its one official fallback failing.
//
// This was previously two near-identical copies (the "ended" handler and
// resetPlaybackAfterError) which had already drifted apart: only one of
// them reset the card button's _playing flag, so a preview that failed
// outright left its button stuck showing pause until the panel was
// reopened. One copy also dereferenced _activeBar.parentElement with no
// guard, which throws if the row was re-rendered while the clip loaded.
```

**[L1678](./osu-local-favorites.user.js#L1678)** · src L361

```js
// Drop the now-dead skip handlers too, so the OS widget stops offering
// next/previous for a queue that no longer exists.
```

**[L1682](./osu-local-favorites.user.js#L1682)** · src L367

```js
// Called by the panel when a source fails before any card binding exists.
```

**[L1685](./osu-local-favorites.user.js#L1685)** · src L372

```js
// Builds the ordered list of download options for a beatmapset. Official
// download offers both a with-video and no-video (confirmed real
// ?noVideo=1 param) variant - previously this was hardcoded to
// video-only. Guests always see mirrors first, since Official won't work
// for them no matter what; logged-in users get their configured order.
```


## `src/ui/download-menu.js`

6 comments · userscript [L1716](./osu-local-favorites.user.js#L1716) - [L1794](./osu-local-favorites.user.js#L1794)

**[L1716](./osu-local-favorites.user.js#L1716)** · src L32

```js
// Shows a small popover of download options (official + enabled mirrors)
// anchored to the triggering element. Appended to <body> - not the
// scrollable panel list - so it's never clipped by overflow:auto. Closes
// on outside click, Escape, or if any ancestor (e.g. the panel list)
// scrolls out from under it.
```

**[L1720](./osu-local-favorites.user.js#L1720)** · src L41

```js
// Clicking the same button again just closes it
```

**[L1745](./osu-local-favorites.user.js#L1745)** · src L66

```js
// Only close on a scroll that moves the menu's anchor out from under it
// (page/panel scroll) - a scroll *inside* the menu itself (e.g. the
// scrollable genre/tag or collections list) must not close it.
```

**[L1781](./osu-local-favorites.user.js#L1781)** · src L105

```js
// Position under the anchor, right-aligned, flipping above if it would
// overflow the bottom of the viewport
```

**[L1790](./osu-local-favorites.user.js#L1790)** · src L116

```js
// Defer attaching so this same click doesn't immediately close the menu
```

**[L1794](./osu-local-favorites.user.js#L1794)** · src L122

```js
// ── Genre + Tags term collection ──
// Builds two frequency-counted term lists from the current favorites:
// one from the `genre` field (osu!'s own taxonomy - a handful of values),
// one from the freeform `tags` field (can be large). Each favorite counts
// once per unique term even if it shows up twice (e.g. a tag repeated).
// Any tag string that collides with a genre value is dropped from the tag
// list so the same term never appears twice across both sections.
//
// Tag text gets light cleanup before it's used as a dedup key: NFKC
// normalization folds full-width Latin letters and other compatibility
// variants down to their plain form (so e.g. a full-width "Ｋａｓａｉ" and
// an ordinary "Kasai" collapse into one entry instead of two near-
// duplicate rows), and stray leading/trailing punctuation is trimmed.
// Display text keeps the normalized form's original casing/script -
// this only removes accidental duplicates, it doesn't translate or
// otherwise rewrite non-Latin tags.
```


## `src/ui/genre-filter.js`

9 comments · userscript [L1804](./osu-local-favorites.user.js#L1804) - [L2027](./osu-local-favorites.user.js#L2027)

**[L1804](./osu-local-favorites.user.js#L1804)** · src L10

```js
// lowercase key -> { display, count }
```

**[L1825](./osu-local-favorites.user.js#L1825)** · src L31

```js
// A term that's ever used as an actual genre value is a genre, not a tag.
```

**[L1829](./osu-local-favorites.user.js#L1829)** · src L36

```js
// Whether a favorite matches a given genre/tag filter key (both compared
// lowercase, tags run through the same NFKC-normalize + trim as the
// popover list) - true if it's that favorite's genre, or one of its tags.
```

**[L1838](./osu-local-favorites.user.js#L1838)** · src L48

```js
// ── Genre + Tags filter popover ──
// 3-tap cycle per row: neutral → include (green) → exclude (red) → neutral.
// Multiple "include" terms are OR'd together; any "exclude" term is always
// dropped, even if it would otherwise match an include. currentState is
// { [lowercaseTerm]: "include" | "exclude" }; onApply is called after every
// tap with a fresh copy so the caller can re-render live without closing
// the menu. Rows are split into a "Genres" section (osu!'s own taxonomy)
// and a "Tags" section (freeform, can be large - hence the search box).
```

**[L1877](./osu-local-favorites.user.js#L1877)** · src L95

```js
// Only close on a scroll that moves the menu's anchor out from under it
// (page/panel scroll) - a scroll *inside* the menu itself (e.g. the
// scrollable genre/tag or collections list) must not close it.
```

**[L1888](./osu-local-favorites.user.js#L1888)** · src L109

```js
// Tags can run into the hundreds for a big library - a live filter box
// keeps that usable instead of relying on scrolling alone.
```

**[L1936](./osu-local-favorites.user.js#L1936)** · src L159

```js
// Tags can number in the hundreds/thousands for a big library - building
// a DOM row for every single one on open was the source of multi-second
// "click handler" jank. Cap what's actually rendered; the live filter
// box (with its own smaller cap) is how the rest get reached.
```

**[L1947](./osu-local-favorites.user.js#L1947)** · src L174

```js
// Build off-DOM, then attach once - avoids a forced layout per row.
```

**[L2027](./osu-local-favorites.user.js#L2027)** · src L256

```js
// ── Collections selector popover (toolbar) ──
// Lets the user pick which collection to filter the list by ("All favorites"
// clears it), create new collections, and delete existing ones (two-tap
// confirm, matching the "Remove all favorites" pattern elsewhere).
```


## `src/ui/collections-menu.js`

3 comments · userscript [L2058](./osu-local-favorites.user.js#L2058) - [L2214](./osu-local-favorites.user.js#L2214)

**[L2058](./osu-local-favorites.user.js#L2058)** · src L31

```js
// Only close on a scroll that moves the menu's anchor out from under it
// (page/panel scroll) - a scroll *inside* the menu itself (e.g. the
// scrollable genre/tag or collections list) must not close it.
```

**[L2186](./osu-local-favorites.user.js#L2186)** · src L162

```js
// ── Per-card "add to collection" popover ──
// Toggle-style checklist (a map can belong to several collections at once),
// plus the same inline "new collection" creator as the toolbar selector.
```

**[L2214](./osu-local-favorites.user.js#L2214)** · src L193

```js
// Only close on a scroll that moves the menu's anchor out from under it
// (page/panel scroll) - a scroll *inside* the menu itself (e.g. the
// scrollable genre/tag or collections list) must not close it.
```


## `src/api/gist-backup.js`

8 comments · userscript [L2312](./osu-local-favorites.user.js#L2312) - [L2412](./osu-local-favorites.user.js#L2412)

**[L2312](./osu-local-favorites.user.js#L2312)** · src L1

```js
// ═══ GitHub Gist Backup ═══
```

**[L2314](./osu-local-favorites.user.js#L2314)** · src L4

```js
// ── osu! API v2 (OAuth2 authorization-code) storage keys ──
```

**[L2316](./osu-local-favorites.user.js#L2316)** · src L7

```js
// {access,refresh,expires_at}
```

**[L2319](./osu-local-favorites.user.js#L2319)** · src L10

```js
// The redirect URI users must register on their osu! OAuth application.
// Must match EXACTLY (scheme/host/path, no trailing slash).
```

**[L2324](./osu-local-favorites.user.js#L2324)** · src L17

```js
// "private" | "public"
```

**[L2367](./osu-local-favorites.user.js#L2367)** · src L60

```js
// Looks for a gist already containing our backup filename - lets a
// reconnect (new browser/device) pick up an existing backup instead of
// silently creating a duplicate.
```

**[L2388](./osu-local-favorites.user.js#L2388)** · src L84

```js
// Fetches and parses the backup file from a gist. Falls back to raw_url
// when GitHub truncates large file content in the API response.
```

**[L2412](./osu-local-favorites.user.js#L2412)** · src L110

```js
// Pulls a gist id out of either a raw id or a pasted gist URL
// (https://gist.github.com/user/<id> or the api.github.com form).
```


## `src/api/osu-api.js`

31 comments · userscript [L2421](./osu-local-favorites.user.js#L2421) - [L2701](./osu-local-favorites.user.js#L2701)

**[L2421](./osu-local-favorites.user.js#L2421)** · src L7

```js
// ═══ osu! API v2 - OAuth2 authorization-code flow ═══
// Same mechanism standard osu! extensions use: the user creates an OAuth
// application on their osu! account settings (new OAuth app), enters its
// Client ID + Client Secret in LOF's settings, and registers exactly
// https://osu.ppy.sh/home as the callback URL. The script
// then drives the full flow itself:
//   1. osuApiStartAuth()      → navigates to /oauth/authorize with a random state
//   2. osu! redirects back to /home?code=…&state=…
//   3. osuApiHandleOAuthCallback() (runs at document-start) exchanges the
//      code at /oauth/token, stores access+refresh tokens and wipes the
//      query string so the user never sees osu!'s 404 page.
//   4. osuApiGetToken() transparently refreshes via refresh_token grant.
//
// All token traffic is same-origin (https://osu.ppy.sh → itself), so plain
// fetch() works - no GM_xmlhttpRequest / CORS involved.
```

**[L2434](./osu-local-favorites.user.js#L2434)** · src L36

```js
// Random state guards against CSRF on the callback.
```

**[L2443](./osu-local-favorites.user.js#L2443)** · src L46

```js
// osu! answers /oauth/authorize with 401 (rendered as a plain browser
// error, no osu! page) when the Application Callback URL registered for
// this Client ID does not exactly match our redirect_uri. Probe the exact
// authorize URL first and route the user back with an explanation instead
// of leaving them on an opaque error page.
```

**[L2461](./osu-local-favorites.user.js#L2461)** · src L69

```js
// Pre-flight itself failed (offline etc.) - still attempt the redirect,
// the browser will surface its own error.
```

**[L2466](./osu-local-favorites.user.js#L2466)** · src L76

```js
// osu! documents this endpoint as application/x-www-form-urlencoded. A
// JSON body can make the authorization-code exchange fail even after the
// user successfully approves the app.
```

**[L2495](./osu-local-favorites.user.js#L2495)** · src L108

```js
// refresh 1 min early
```

**[L2499](./osu-local-favorites.user.js#L2499)** · src L112

```js
// Returns a Promise<string> with a valid access token. Refreshes (and
// retries once after a refresh) automatically. Rejects when not configured
// or when both access and refresh tokens are dead.
```

**[L2506](./osu-local-favorites.user.js#L2506)** · src L122

```js
// Deduplicate concurrent refreshes
```

**[L2507](./osu-local-favorites.user.js#L2507)** · src L124

```js
// Per osu! docs: the refresh grant is also form-urlencoded and re-states
// the original scope; omitting scope would also be accepted (existing
// scopes are reused), but being explicit avoids any manager-side
// normalization surprises.
```

**[L2517](./osu-local-favorites.user.js#L2517)** · src L138

```js
// Refresh dead → force a clean reconnect
```

**[L2525](./osu-local-favorites.user.js#L2525)** · src L147

```js
// ── Rate limiting / queuing (per https://osu.ppy.sh/docs/index.html) ──
// osu! asks clients to stay under ~60 requests/minute (≈1/sec), honor
// Retry-After on HTTP 429, use exponential backoff, and cache responses.
// All of that is enforced centrally here so every osuApiGet() caller is
// compliant regardless of where the call originates.
```

**[L2525](./osu-local-favorites.user.js#L2525)** · src L152

```js
// ≥1s between requests
```

**[L2526](./osu-local-favorites.user.js#L2526)** · src L153

```js
// serializes request pacing
```

**[L2527](./osu-local-favorites.user.js#L2527)** · src L154

```js
// absolute ts while server says wait
```

**[L2528](./osu-local-favorites.user.js#L2528)** · src L155

```js
// grows exponentially on repeat 429s
```

**[L2529](./osu-local-favorites.user.js#L2529)** · src L156

```js
// path → response JSON (session cache)
```

**[L2536](./osu-local-favorites.user.js#L2536)** · src L163

```js
// Serializes every API call through one queue with ≥OSU_API_MIN_GAP_MS
// spacing, plus any server-mandated or backoff wait before dispatching.
```

**[L2552](./osu-local-favorites.user.js#L2552)** · src L181

```js
// Docs good-practice #4: cache retrieved data and reuse it.
```

**[L2560](./osu-local-favorites.user.js#L2560)** · src L190

```js
// Honor the server's Retry-After, then apply exponential backoff
// for any further 429s (docs good-practice #3).
```

**[L2566](./osu-local-favorites.user.js#L2566)** · src L198

```js
// successful window - reset backoff
```

**[L2568](./osu-local-favorites.user.js#L2568)** · src L200

```js
// Access token died early (revoked/password change): drop cached
// token so the next osuApiGetToken() refreshes, then retry once.
```

**[L2580](./osu-local-favorites.user.js#L2580)** · src L214

```js
// One transparent retry after a rate-limit wait has elapsed.
```

**[L2596](./osu-local-favorites.user.js#L2596)** · src L231

```js
// Evict oldest inserted entry
```

**[L2617](./osu-local-favorites.user.js#L2617)** · src L253

```js
// Runs once at document-start. If we're back on osu.ppy.sh with ?code= &
// ?state= from our own authorize redirect, exchange the code before osu!
// renders its 404 page, then rewrite the URL clean.
```

**[L2625](./osu-local-favorites.user.js#L2625)** · src L264

```js
// hide ?code=… immediately
```

**[L2637](./osu-local-favorites.user.js#L2637)** · src L276

```js
/* never break page load over this */
```

**[L2640](./osu-local-favorites.user.js#L2640)** · src L279

```js
// Fetches a beatmapset through the API v2 and normalizes it into LOF's
// stored-favorite shape (identical fields to getBeatmapDataFromJSON - the
// website's embedded JSON is basically the same object as the API payload).
```

**[L2663](./osu-local-favorites.user.js#L2663)** · src L305

```js
// The API does not always include the featured-artist marker. `null`
// means "not supplied" so enrichment can preserve a known value from
// the existing favorite instead of turning it off during re-enrichment.
```

**[L2673](./osu-local-favorites.user.js#L2673)** · src L318

```js
// Creates the backup gist on first run, otherwise updates the linked one.
// Note: GitHub does not allow flipping a gist's public/private flag after
// creation, so a privacy change clears GH_GIST_ID_KEY and this naturally
// creates a fresh gist with the new visibility on the next call.
```

**[L2688](./osu-local-favorites.user.js#L2688)** · src L337

```js
// A user can delete the linked gist directly on GitHub. Treat its 404
// as a stale local link, create a replacement, and relink it so both
// manual and automatic backups recover on the same attempt.
```

**[L2701](./osu-local-favorites.user.js#L2701)** · src L353

```js
// Debounced auto-backup - call this after every favorites mutation.
// No-ops unless the user has connected GitHub and switched auto-update on.
// Debouncing avoids hammering the API when several maps are favorited in
// a row (e.g. the "Favorite all" bulk button).
```


## `src/data/beatmap-extraction.js`

15 comments · userscript [L2720](./osu-local-favorites.user.js#L2720) - [L2948](./osu-local-favorites.user.js#L2948)

**[L2720](./osu-local-favorites.user.js#L2720)** · src L1

```js
// ═══ Beatmap data extraction ═══
```

**[L2759](./osu-local-favorites.user.js#L2759)** · src L41

```js
// Skip cards inside pinned scores section
```

**[L2772](./osu-local-favorites.user.js#L2772)** · src L55

```js
// ── Title ────────────────────────────────────────────────────
// .beatmap-playcount__title (Most Played rows) is handled alongside
// the regular panel selectors - its text also carries a trailing
// "[Difficulty]" and an inline "by Artist" span, both stripped below,
// since we're favouriting the *set*, not one specific diff.
```

**[L2790](./osu-local-favorites.user.js#L2790)** · src L78

```js
// ── Artist ───────────────────────────────────────────────────
// Use dedicated semantic elements first; fall back to filtered info-row text.
// Never read raw info-row text without stripping stat nodes - doing so causes
// play counts / fav counts / dates to bleed into the artist field.
```

**[L2796](./osu-local-favorites.user.js#L2796)** · src L88

```js
// Most Played rows - text is "by Artist", stripped below
```

**[L2826](./osu-local-favorites.user.js#L2826)** · src L118

```js
// ── Creator (mapper) ─────────────────────────────────────────
```

**[L2832](./osu-local-favorites.user.js#L2832)** · src L125

```js
// Most Played rows - username only, no "mapped by " text to strip
```

**[L2865](./osu-local-favorites.user.js#L2865)** · src L158

```js
// source is not present in listing card DOM - leave blank rather than
// accidentally capturing stats / date text from info-row nodes
```

**[L2867](./osu-local-favorites.user.js#L2867)** · src L162

```js
// Extract cover URL - try multiple methods
```

**[L2869](./osu-local-favorites.user.js#L2869)** · src L165

```js
// Method 1: computed style --bg custom property on cover element
```

**[L2878](./osu-local-favorites.user.js#L2878)** · src L175

```js
// Method 2: img inside cover
```

**[L2886](./osu-local-favorites.user.js#L2886)** · src L184

```js
// Method 3: any img in card that looks like a cover
```

**[L2896](./osu-local-favorites.user.js#L2896)** · src L195

```js
// First image that's not an icon
```

**[L2905](./osu-local-favorites.user.js#L2905)** · src L205

```js
// Normalize URL
```

**[L2948](./osu-local-favorites.user.js#L2948)** · src L249

```js
// Walk up from the button and find the smallest ancestor that contains
// links to exactly one distinct beatmapset id. This works no matter how
// deeply the beatmapset link is nested inside the card's markup (some
// layouts - e.g. the Featured Artist track grid - wrap it several levels
// deep rather than as a direct child), and no matter which wrapper class
// a given card layout uses, since we no longer depend on ".beatmapset-panel"
// or a direct-child relationship at all. As soon as an ancestor's links
// span more than one distinct beatmapset, we've walked past the card
// boundary into a container shared by multiple cards, so we stop there
// rather than risk grabbing a neighboring card's id.
```


## `src/data/favorite-detection.js`

7 comments · userscript [L2971](./osu-local-favorites.user.js#L2971) - [L3037](./osu-local-favorites.user.js#L3037)

**[L2971](./osu-local-favorites.user.js#L2971)** · src L3

```js
// ═══ Favorite button detection ═══
// Accepts BUTTON, A, and SPAN elements (the guest-disabled span on listing pages).
```

**[L2986](./osu-local-favorites.user.js#L2986)** · src L20

```js
// Reject download buttons immediately - never treat them as fav buttons
```

**[L2993](./osu-local-favorites.user.js#L2993)** · src L28

```js
// ── Fast path: the guest-disabled span osu! renders when not signed in ──
// <span class="beatmapset-panel__menu-item beatmapset-panel__menu-item--disabled"
//       data-orig-title="sign in to favourite this beatmap">
//   <span class="far fa-heart"></span>
// </span>
```

**[L3000](./osu-local-favorites.user.js#L3000)** · src L40

```js
// For SPANs that aren't the specific menu-item, require them to look like a fav button
```

**[L3002](./osu-local-favorites.user.js#L3002)** · src L43

```js
// Only match spans that contain a heart icon and are inside a beatmap panel
```

**[L3010](./osu-local-favorites.user.js#L3010)** · src L52

```js
// BUTTON / A checks below
// Guard: only treat a heart-icon button as a fav button when it actually
// sits in a beatmap context (a beatmapset detail page, or inside a listing
// card). Hearts also appear on profiles, forums, modding posts, etc., and
// previously those matched here, then failed id resolution and produced
// spurious "couldn't resolve a beatmap id" errors.
```

**[L3037](./osu-local-favorites.user.js#L3037)** · src L85

```js
// title and text are already declared at top of function - reuse them
```


## `src/ui/heart-visual.js`

4 comments · userscript [L3071](./osu-local-favorites.user.js#L3071) - [L3087](./osu-local-favorites.user.js#L3087)

**[L3071](./osu-local-favorites.user.js#L3071)** · src L1

```js
// ═══ Visual helpers ═══
```

**[L3072](./osu-local-favorites.user.js#L3072)** · src L3

```js
// Update FontAwesome heart solid/outline.
```

**[L3078](./osu-local-favorites.user.js#L3078)** · src L10

```js
// osu! uses SVG heart icons in some layouts. Those buttons are detected by
// favorite-detection.js, but the old visual update only handled FontAwesome
// markup, so the click was persisted while the page heart stayed unchanged.
```

**[L3087](./osu-local-favorites.user.js#L3087)** · src L22

```js
// Also update the container span's disabled/active look
```


## `src/data/enrichment.js`

15 comments · userscript [L3104](./osu-local-favorites.user.js#L3104) - [L3248](./osu-local-favorites.user.js#L3248)

**[L3104](./osu-local-favorites.user.js#L3104)** · src L6

```js
// ═══ Background enrichment ═══
// Shared pacing for any sequence of osu! beatmapset detail-page requests -
// keeps us comfortably under ~60 requests/min regardless of which feature
// (bulk "Favorite all" import or a full-library re-enrichment) is driving it.
```

**[L3106](./osu-local-favorites.user.js#L3106)** · src L12

```js
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
```

**[L3123](./osu-local-favorites.user.js#L3123)** · src L45

```js
// Batch queue migration/import writes. Calling addToEnrichQueue once per
// favorite makes native Tampermonkey serialize and persist the entire
// queue once per item, which can make the first page load painfully slow
// for a large existing library.
```

**[L3146](./osu-local-favorites.user.js#L3146)** · src L72

```js
// Fetches the beatmapset detail page and merges full JSON data into storage.
// Fire-and-forget - card data is stored instantly, this fills in the gaps.
// Also used standalone by the global re-enrichment feature to refresh
// fields (tags/source/genre/language/etc.) that may be stale or were saved
// in an older, differently-normalized format.
```

**[L3147](./osu-local-favorites.user.js#L3147)** · src L78

```js
// Prefer the osu! API v2 when connected (clean JSON, no HTML parsing,
// no reliance on the embedded #json-beatmapset element). Falls back to
// scraping the beatmapset page's embedded JSON when the API isn't set up.
```

**[L3175](./osu-local-favorites.user.js#L3175)** · src L109

```js
// Removed before enrichment finished - nothing to fill in, but it's
// also not "still needing enrichment" anymore, so stop retrying it.
```

**[L3182](./osu-local-favorites.user.js#L3182)** · src L118

```js
// Re-enrichment must not replace the whole record with a lossy API
// projection. In particular, API v2 beatmapset responses can omit the
// featured-artist marker (and other fields introduced by the page/card
// payload). Keep existing values whenever the response does not provide
// a value, while still allowing an explicit API false to clear stale
// metadata.
```

**[L3198](./osu-local-favorites.user.js#L3198)** · src L140

```js
// API v2 returns objects here, while the normalized API helper and
// older page payloads may already provide plain strings.
```

**[L3214](./osu-local-favorites.user.js#L3214)** · src L158

```js
// left in the queue - a later drain pass retries it
```

**[L3217](./osu-local-favorites.user.js#L3217)** · src L161

```js
// Sequentially enriches a list of IDs with a delay between requests
```

**[L3226](./osu-local-favorites.user.js#L3226)** · src L171

```js
// Quietly works through the persistent enrichment queue (see
// ENRICH_QUEUE_KEY above) in the background, one map per
// ENRICH_RATE_LIMIT_MS - same throttle as every other enrichment path,
// just spread across however many page loads it takes instead of
// requiring one tab to stay open until it's done. Safe to call any time;
// it's a no-op while a manual "Re-enrich all maps" run is already going
// (avoids doubling up the request rate), and naturally stops calling
// itself once the queue is empty or every favorite it names is gone.
```

**[L3233](./osu-local-favorites.user.js#L3233)** · src L186

```js
// Manual re-enrichment took over - back off and let it finish;
// it removes IDs from this same queue as it goes.
```

**[L3239](./osu-local-favorites.user.js#L3239)** · src L194

```js
// drop removed or already-enriched IDs
```

**[L3242](./osu-local-favorites.user.js#L3242)** · src L197

```js
// queue empty - stop until something re-queues it
```

**[L3248](./osu-local-favorites.user.js#L3248)** · src L203

```js
// Left in the queue by enrichBeatmapData on failure, but rotate it
// to the back rather than leaving it at the front - otherwise a
// single persistently-failing map (deleted beatmapset, transient
// error, whatever) gets retried forever every cycle and every
// *other* queued map behind it never gets a turn, which looked
// exactly like enrichment being broken again even though it was
// just stuck on one bad entry.
```


## `src/data/reenrichment.js`

3 comments · userscript [L3263](./osu-local-favorites.user.js#L3263) - [L3272](./osu-local-favorites.user.js#L3272)

**[L3263](./osu-local-favorites.user.js#L3263)** · src L6

```js
// ═══ Global re-enrichment (Settings → Library Maintenance) ═══
// Re-fetches every favorited map's full data, one request at a time and
// rate-limited via ENRICH_RATE_LIMIT_MS. Exposed through a couple of
// module-level state vars + ID-lookups (rather than closures) so progress
// keeps rendering correctly even if the settings view is torn down and
// rebuilt (e.g. re.render on unrelated state changes) while a run is live.
```

**[L3268](./osu-local-favorites.user.js#L3268)** · src L17

```js
// Read-only accessor for other modules (data/enrichment.js,
// ui/settings.js) that need to know whether a global re-enrichment
// pass is currently in flight, without holding a live, writable binding
// into this module's private state.
```

**[L3272](./osu-local-favorites.user.js#L3272)** · src L25

```js
// Pushes current progress into the Settings panel's progress bar, if it's
// currently mounted. Safe to call even when the panel/settings view isn't
// open - the elements simply won't be found and this becomes a no-op.
```


## `src/data/toggle-favorite.js`

4 comments · userscript [L3335](./osu-local-favorites.user.js#L3335) - [L3363](./osu-local-favorites.user.js#L3363)

**[L3335](./osu-local-favorites.user.js#L3335)** · src L7

```js
// ═══ Toggle favorite ═══
```

**[L3343](./osu-local-favorites.user.js#L3343)** · src L16

```js
// no longer favorited - stop trying to enrich it
```

**[L3359](./osu-local-favorites.user.js#L3359)** · src L32

```js
// setFavorites() announces the membership change; the subscriber wired up
// in core/init.js repaints every heart on the page and re-renders the
// panel list in place.
//
// This used to remove the panel and call showFavoritesPanel() to rebuild
// it from scratch, which reset the search box, sort order, genre filter,
// active collection and scroll position, and tore down the Now Playing
// bar mid-preview - every time any heart was clicked.
```

**[L3363](./osu-local-favorites.user.js#L3363)** · src L44

```js
// Persisted first so this survives even if the immediate attempt
// below doesn't finish before the tab closes/navigates away - the
// background drainer picks it back up later regardless.
```


## `src/ui/copy-all-button.js`

13 comments · userscript [L3371](./osu-local-favorites.user.js#L3371) - [L3508](./osu-local-favorites.user.js#L3508)

**[L3371](./osu-local-favorites.user.js#L3371)** · src L7

```js
// ═══ Copy-all button ("Favourite Beatmaps" + "Most Played Beatmaps") ═══
// Both live on a profile's Beatmaps tab and share the same "click show
// more until it's gone" pagination pattern, but render completely
// differently under the hood:
//   • Favourite (data-page-id="beatmaps") - one .beatmapset-panel card
//     per beatmapset, "show more" carries both the "profile-page" and
//     "profile-page-beatmapsets" modifier classes.
//   • Most Played (data-page-id="historical") - one .beatmap-playcount
//     row per DIFFICULTY the user has played, so the same beatmapset can
//     show up dozens of times; its "show more" only carries the plain
//     "profile-page" modifier. getBeatmapDataFromCard() already knows how
//     to read both row types, and the dedup below (favs[id] already set,
//     whether from a prior favourite or an earlier row in *this* run)
//     means a 20-diff mapset only ever gets added once.
```

**[L3372](./osu-local-favorites.user.js#L3372)** · src L22

```js
// The .js-sortable--page sections these buttons attach to only exist on
// profile pages. Everything below is four querySelector calls per call -
// and this runs on every debounced mutation pass and the 1.5s interval -
// so bail before any DOM work on pages that can't possibly match.
```

**[L3382](./osu-local-favorites.user.js#L3382)** · src L36

```js
// rows sit directly in the page container, no dedicated grid wrapper
```

**[L3394](./osu-local-favorites.user.js#L3394)** · src L48

```js
// Guard: don't add the button twice
```

**[L3421](./osu-local-favorites.user.js#L3421)** · src L76

```js
// Click "show more" once and wait for new rows to appear
```

**[L3455](./osu-local-favorites.user.js#L3455)** · src L111

```js
// Recursively click "show more" until everything is loaded
```

**[L3468](./osu-local-favorites.user.js#L3468)** · src L125

```js
// Use a decreasing base timestamp so top-to-bottom DOM order is preserved
// (panel sorts by favourited_at descending)
```

**[L3476](./osu-local-favorites.user.js#L3476)** · src L135

```js
// Already favourited before, OR another diff of a set we
// already added earlier in *this* run - either way, skip it.
```

**[L3478](./osu-local-favorites.user.js#L3478)** · src L139

```js
// Subtract i seconds so first row (top) gets newest timestamp
```

**[L3488](./osu-local-favorites.user.js#L3488)** · src L150

```js
// setFavorites() notifies the shared panel refresh subscriber.
// Show matching/skipped count when some were already favorited
```

**[L3492](./osu-local-favorites.user.js#L3492)** · src L156

```js
// Persist the queue first - for a big batch, this run alone can
// take minutes at the required throttle, and closing the tab
// partway through used to lose genre/language/tags permanently
// for whatever hadn't been reached yet. Now the background
// drainer just resumes where this left off on a later page load.
```

**[L3493](./osu-local-favorites.user.js#L3493)** · src L162

```js
// Enrich each new beatmapset sequentially - respects ENRICH_RATE_LIMIT_MS
// (1 request/sec), the same throttle every other bulk/re-enrich path uses.
```

**[L3508](./osu-local-favorites.user.js#L3508)** · src L179

```js
// Append button inside the heading element
```


## `src/ui/floating-heart.js`

26 comments · userscript [L3512](./osu-local-favorites.user.js#L3512) - [L3748](./osu-local-favorites.user.js#L3748)

**[L3512](./osu-local-favorites.user.js#L3512)** · src L11

```js
// ═══ Floating heart - always visible on all osu! pages ═══
// Visual language matches the rest of LOF's UI (flat dark surface, 1px
// hairline border, small radius, accent used sparingly) instead of the old
// generic glowing-circle look.
```

**[L3512](./osu-local-favorites.user.js#L3512)** · src L15

```js
// {right,bottom} px from bottom-right
```

**[L3515](./osu-local-favorites.user.js#L3515)** · src L18

```js
// updateFloatingHeart() runs on every debounced DOM-mutation pass and
// every cross-tab sync; rebuilding the SVG innerHTML each time churned
// the DOM (parse + node replacement + style invalidation) several times
// per second even when the heart's state hadn't changed. Skip when the
// visual state is identical - the very first call still renders.
```

**[L3521](./osu-local-favorites.user.js#L3521)** · src L29

```js
// No glow in either state. The accent-coloured border is already the
// favorited signal; the pink drop shadow on top of it was the one piece
// of the old "glowing circle" look left over, and it read as a halo
// around the button on beatmap pages. Explicitly set to "none" rather
// than removed, so a favorited -> unfavorited transition still clears
// any shadow left on the element.
```

**[L3547](./osu-local-favorites.user.js#L3547)** · src L61

```js
// Restore last saved position (drag is persisted across pages/sessions)
```

**[L3550](./osu-local-favorites.user.js#L3550)** · src L65

```js
// Clamp into the viewport in case the window shrank since saving
```

**[L3561](./osu-local-favorites.user.js#L3561)** · src L77

```js
// Clicking heart always opens favorites panel
```

**[L3564](./osu-local-favorites.user.js#L3564)** · src L81

```js
// ── Click vs hold-to-drag ──
// A short press without movement = click (open panel). Holding for
// HOLD_MS or moving > MOVE_THRESHOLD px starts a drag; the new position
// is anchored to bottom/right so it survives resizes, and persisted.
```

**[L3592](./osu-local-favorites.user.js#L3592)** · src L113

```js
// Cancel pending drag if the finger/mouse moved before hold elapsed
```

**[L3645](./osu-local-favorites.user.js#L3645)** · src L167

```js
// Inline style wins over osu!'s own stylesheet rules, so our button
// reads as clearly "ours" rather than an indistinguishable copy of
// osu!'s native heart.
```

**[L3662](./osu-local-favorites.user.js#L3662)** · src L187

```js
// ═══ Click interception ═══
```

**[L3665](./osu-local-favorites.user.js#L3665)** · src L191

```js
// Never treat clicks inside our own UI (the favorites panel or the
// download-mirror popover) as a native-page favourite-button click.
// isFavButton()'s matching is heuristic (title/class/icon-based) and
// meant for osu!'s own page elements - it previously misfired on our
// own "Download ▾" menu, e.g. the "Official Download (requires
// sign-in)" row, which doesn't carry a "download" title/class, only
// the word in its visible text. The panel and menu already handle
// all of their own actions directly (toggleFavorite, removeBtn,
// showDownloadMenu's row links), so excluding them here entirely is
// both the fix and the more robust long-term guard.
```

**[L3667](./osu-local-favorites.user.js#L3667)** · src L203

```js
// Also intercept clicks on the guest-disabled <span> (not just button/a)
```

**[L3670](./osu-local-favorites.user.js#L3670)** · src L207

```js
// As soon as we've identified this as a favorite button, we commit to
// handling the click ourselves - block osu!'s own click handler
// unconditionally, even if something below fails. Previously this only
// happened after beatmap-id resolution succeeded, so a resolution
// failure would silently fall through to osu!'s real click handler -
// which our own XHR/fetch interceptor then turns into a broken fake
// response, since it blindly fakes *any* request to a "/favourites"
// URL regardless of whether we handled the click. Blocking here always
// avoids that half-broken passthrough state.
```

**[L3677](./osu-local-favorites.user.js#L3677)** · src L223

```js
// Not an error: isFavButton()'s matching is heuristic, so an
// occasional false positive can slip past it. Just ignore the click
// quietly instead of spamming the console and toasting the user.
```

**[L3699](./osu-local-favorites.user.js#L3699)** · src L248

```js
// ═══ Refresh visible buttons ═══
```

**[L3700](./osu-local-favorites.user.js#L3700)** · src L250

```js
// Cheap short-circuit: isFavButton() only ever returns true for an
// element on an actual beatmapset detail page or one sitting inside a
// ".beatmapset-panel" (listing/profile cards) - every other branch in it
// requires one of those two. On any other page (dashboard, forum, wiki,
// chat, settings, etc.) that's guaranteed false for literally every
// element, so skip straight past the expensive "every <button> on the
// whole page" scan below rather than running it - and the several
// querySelector/closest calls inside isFavButton() for each one - on
// totally unrelated pages, every 1.5s and on every DOM mutation, for as
// long as the tab stays open. This is a pure short-circuit: it changes
// nothing about which buttons get matched, only skips the work when the
// page couldn't possibly contain any.
```

**[L3704](./osu-local-favorites.user.js#L3704)** · src L266

```js
// Also scan disabled <span> elements used when the user is not signed in
```

**[L3708](./osu-local-favorites.user.js#L3708)** · src L271

```js
// Cheapest checks first. The dataset flag must gate BEFORE isFavButton()
// - the old order ran the full heuristic (several querySelector calls
// per candidate) on every already-processed button on every pass. And
// everything inside our own UI is skipped outright: an open favorites
// panel alone can hold thousands of <button>s (rows × Open/Download/
// Remove/preview), each of which would otherwise run isFavButton() -
// and always fail - on every debounced mutation pass and 1.5s interval
// tick for as long as the panel stays open.
```

**[L3712](./osu-local-favorites.user.js#L3712)** · src L283

```js
// Context couldn't be resolved yet - this is common when a card is
// still mid-render (fast scroll / infinite-load on search & profile
// pages). Do NOT mark it checked here, or it'll be skipped forever and
// silently show the wrong (unfavorited) heart state even though it's
// actually in local favorites - clicking it would then remove it
// instead of doing nothing. Leave it unmarked so the next pass (mutation
// observer or periodic fallback) retries once the card has settled.
```

**[L3714](./osu-local-favorites.user.js#L3714)** · src L292

```js
// Record the resolved id on the element. resolveBeatmapContext() is the
// expensive part of this scan (several closest()/querySelector calls),
// and resyncFavoriteButtons() below needs to re-derive the favorited
// state for exactly these buttons on every change - reading it back
// from the dataset turns that into a plain attribute lookup.
```

**[L3716](./osu-local-favorites.user.js#L3716)** · src L299

```js
// Make the disabled span look clickable
```

**[L3724](./osu-local-favorites.user.js#L3724)** · src L308

```js
// The audio element is deliberately page-lifetime. Closing the favorites panel
// must only detach the panel UI - never pause/reset the actual preview. This lets
// previews keep playing while the user closes the panel, switches tabs, or opens
// another app on mobile. A newly opened panel re-binds its Now Playing controls.
```

**[L3735](./osu-local-favorites.user.js#L3735)** · src L323

```js
// The queue callback closes over this panel's DOM/list, so do not keep it after
// the panel is gone. Playback itself remains untouched.
```

**[L3738](./osu-local-favorites.user.js#L3738)** · src L328

```js
// Re-derives the favorited state of every heart already drawn on the page,
// plus the floating indicator and the guest button.
//
// This is the single subscriber to storage's change notification, so any
// mutation from anywhere - the panel, a card click, Copy All, a Gist
// restore, another tab - lands on every visible surface at once. It is
// deliberately cheap: no DOM scan for new buttons (refreshButtons() owns
// that) and no context re-resolution, just an attribute read per button
// that was already processed.
```

**[L3748](./osu-local-favorites.user.js#L3748)** · src L347

```js
// Clears the "already processed" markers so the next refreshButtons() pass
// re-examines every candidate from scratch. Needed after a navigation that
// swapped the page content without going through hardResync() - the markers
// survive on a restored Turbolinks snapshot and would otherwise make every
// heart on it permanently unreachable.
```


## `src/ui/settings.js`

44 comments · userscript [L3756](./osu-local-favorites.user.js#L3756) - [L5057](./osu-local-favorites.user.js#L5057)

**[L3756](./osu-local-favorites.user.js#L3756)** · src L18

```js
// ═══ Settings view (⚙ in the panel header) ═══
// Everything the ⚙ pane is made of: the scroll container, the control
// builders each section is assembled from, and renderSettingsView() itself.
// Split out of what used to be a single 3,000-line ui/favorites-panel.js so
// that file is only about the favorites list; createSettingsView() at the
// bottom of this one is the whole interface between the two.
```

**[L3756](./osu-local-favorites.user.js#L3756)** · src L25

```js
// Settings' own toast: a little wider than the page-level default, because
// these messages tend to be full sentences ("Disconnected from osu! API").
```

**[L3760](./osu-local-favorites.user.js#L3760)** · src L31

```js
// ── Settings view helpers ────────────────────────────────
```

**[L3787](./osu-local-favorites.user.js#L3787)** · src L59

```js
// Usually plain text, but a row can also pass a Node/DocumentFragment
// (e.g. to embed a real hyperlink inside the subtitle)
```

**[L3795](./osu-local-favorites.user.js#L3795)** · src L69

```js
// Pink pill switch - matches the accent color used throughout the panel
```

**[L3813](./osu-local-favorites.user.js#L3813)** · src L88

```js
// Two/three-way segmented control - mirrors the sort-button pill style
```

**[L3838](./osu-local-favorites.user.js#L3838)** · src L114

```js
// Native <select> for settings with many choices - segmented pills work
// well for 2-3 options, but a real dropdown scales better once there
// are this many (every mirror × video variant, plus both Official
// variants, plus "not set").
```

**[L3854](./osu-local-favorites.user.js#L3854)** · src L134

```js
// 0–100 percentage slider with a live-updating label - used by Appearance
```

**[L3874](./osu-local-favorites.user.js#L3874)** · src L155

```js
// ── Custom color picker ──
// We used to hand off to a real <input type="color">, but the
// saturation/value "plane" it opens is drawn by the browser's own
// chrome (not page content), so a userscript has zero access to it -
// on some Firefox/PC setups it drags very sluggishly and there is no
// code-side fix. Built our own instead: a plain-CSS gradient square
// for saturation/value, a gradient strip for hue, and a hex field.
// Dragging just repositions an absolutely-positioned cursor div - no
// canvas, no redraw loop, nothing outside our own DOM to be slow.
```

**[L3878](./osu-local-favorites.user.js#L3878)** · src L169

```js
// falls back to the original #ff66aa-ish accent
```

**[L3912](./osu-local-favorites.user.js#L3912)** · src L203

```js
// rAF-throttled pointer drag: reads the latest pointer position but
// only applies it once per frame, so fast mouse/finger movement can't
// queue up more work than the display can actually show.
```

**[L3935](./osu-local-favorites.user.js#L3935)** · src L229

```js
// Tracks whichever custom color panel is currently open (across both
// the accent and heart-color swatches) so opening one closes the other
// instead of leaving two floating at once.
```

**[L3935](./osu-local-favorites.user.js#L3935)** · src L232

```js
// `root` is the settings scroll container this swatch lives in: an open
```

**[L3936](./osu-local-favorites.user.js#L3936)** · src L233

```js
// picker closes itself when that container is torn down and rebuilt, so it
// never lingers detached from its swatch.
```

**[L4036](./osu-local-favorites.user.js#L4036)** · src L335

```js
// Same off-screen clamping the native-input version used: prefer
// opening to the left (the panel this lives in is docked to the
// right edge of the viewport), fall back to the right, clamp both.
```

**[L4071](./osu-local-favorites.user.js#L4071)** · src L373

```js
// clicking again toggles it closed
```

**[L4075](./osu-local-favorites.user.js#L4075)** · src L377

```js
// Clean up an open panel if the row is ever torn down (e.g. Settings
// re-rendered) so it doesn't linger detached from its swatch.
```

**[L4084](./osu-local-favorites.user.js#L4084)** · src L388

```js
// ── Settings view ─────────────────────────────────
// Builds the whole pane: the container element, the section helpers below
// it, and the render pass. It lives here rather than in ui/main-panel.js
// because the panel only ever asks for two things - the element to slot into
// its content area, and a re-render to call when the gear button is hit.
//
// `deps` carries the panel instance surface this view has to call back into.
// Imported helpers and storage/API functions are visible directly (imports
// at the top of this file); these six only exist inside showFavoritesPanel(),
// so they are handed over once when the panel is built.
```

**[L4087](./osu-local-favorites.user.js#L4087)** · src L401

```js
// The scroll container. flex:1 inside the panel's content area; hidden
// until the gear button flips it on (see setView in ui/main-panel.js).
```

**[L4091](./osu-local-favorites.user.js#L4091)** · src L407

```js
// ── Render settings view ─────────────────────────────────
```

**[L4092](./osu-local-favorites.user.js#L4092)** · src L409

```js
// Clean up any real <input type="color"> elements a previous render
// parked on <body> (see makeColorInput) before we rebuild everything.
```

**[L4096](./osu-local-favorites.user.js#L4096)** · src L415

```js
// Attach immediately (while still empty) rather than at the end of this
// function - some sub-sections (e.g. Library Maintenance) sync their
// initial state via document.getElementById, which only finds nodes
// that are actually part of the live document tree.
```

**[L4099](./osu-local-favorites.user.js#L4099)** · src L422

```js
// ── Backup & Restore (Export / Import) ──
```

**[L4151](./osu-local-favorites.user.js#L4151)** · src L475

```js
// Collections have their own portable backup: map memberships are small
// and useful to move independently of the (potentially much larger)
// favorite library. The exported object deliberately matches the
// COLLECTIONS_KEY storage format so it remains simple and future-proof.
```

**[L4170](./osu-local-favorites.user.js#L4170)** · src L498

```js
// Keep the suggested filename valid on Windows, Android, and macOS.
```

**[L4226](./osu-local-favorites.user.js#L4226)** · src L555

```js
// Collections store only beatmapset IDs. Materialize any missing IDs in
// the local favorites library as lightweight placeholders, then queue
// them for the existing background enrichment system. This keeps the
// collection immediately usable while resolving title/artist/covers/
// tags/genre/language/etc. in the background without a request burst.
```

**[L4265](./osu-local-favorites.user.js#L4265)** · src L599

```js
// ── About / version / update check ──
// The project links sit at the top of the update controls, so the version
// they refer to introduces this block instead of trailing the panel. The
// old "Running v..." line directly above is gone with it - the version is
// already the first thing this hint says.
```

**[L4296](./osu-local-favorites.user.js#L4296)** · src L635

```js
// Offer a one-click jump to the install URL
```

**[L4315](./osu-local-favorites.user.js#L4315)** · src L655

```js
// ── osu! API v2 (OAuth) ──
```

**[L4329](./osu-local-favorites.user.js#L4329)** · src L670

```js
// Same status row as the Gist section below: coloured dot, ellipsised
// text, action button on the right - so a connected account reads
// identically wherever it appears in Settings. The dot carries the
// "connected" signal the old ✔ prefix used to, and Disconnect moved
// into the row (it used to be a separate full-width button below).
```

**[L4377](./osu-local-favorites.user.js#L4377)** · src L723

```js
// Redirects to osu!'s authorize page; we resume on /home?code=…
```

**[L4385](./osu-local-favorites.user.js#L4385)** · src L732

```js
// ── GitHub Gist Backup ──
```

**[L4439](./osu-local-favorites.user.js#L4439)** · src L787

```js
// Public gists can be read without authentication. Keep this import
// path available before connection: it deliberately does not set the
// backup target, so connecting/backing up later remains independent.
```

**[L4685](./osu-local-favorites.user.js#L4685)** · src L1036

```js
// ── Download Mirrors ──
```

**[L4739](./osu-local-favorites.user.js#L4739)** · src L1091

```js
// ── Music Playback ──
```

**[L4786](./osu-local-favorites.user.js#L4786)** · src L1139

```js
// Applied immediately to whatever's already playing, not just future
// playback - the audio element is a tab-lifetime singleton, so
// without this the change wouldn't take effect until the next track.
```

**[L4794](./osu-local-favorites.user.js#L4794)** · src L1150

```js
// ── Media Cache ──
```

**[L4821](./osu-local-favorites.user.js#L4821)** · src L1178

```js
// reveal/hide the custom-minutes row below
```

**[L4874](./osu-local-favorites.user.js#L4874)** · src L1231

```js
// ── Appearance ──
```

**[L4951](./osu-local-favorites.user.js#L4951)** · src L1309

```js
// ── Library Maintenance ──
```

**[L5010](./osu-local-favorites.user.js#L5010)** · src L1369

```js
// Sync button label/progress bar to the real state in case a run is
// already in flight (e.g. started, then user switched view and back)
```

**[L5014](./osu-local-favorites.user.js#L5014)** · src L1375

```js
// ── Danger Zone ──
```

**[L5046](./osu-local-favorites.user.js#L5046)** · src L1408

```js
// Keep the osu! API controls at the top of Settings regardless of the
// order in which the remaining settings sections are assembled above.
```

**[L5057](./osu-local-favorites.user.js#L5057)** · src L1421

```js
// Handed back to the panel: the container to mount, and the render entry
// point its setView() calls (and the pane itself calls after any change
// that alters what should be on screen).
```


## `src/ui/main-panel.js`

99 comments · userscript [L5061](./osu-local-favorites.user.js#L5061) - [L6455](./osu-local-favorites.user.js#L6455)

**[L5061](./osu-local-favorites.user.js#L5061)** · src L20

```js
// ═══ Favorites panel ═══
```

**[L5064](./osu-local-favorites.user.js#L5064)** · src L24

```js
// The audio element is page-lifetime, while the player UI belongs to the
// panel. Detach only the old UI binding; never stop the preview when closing.
```

**[L5073](./osu-local-favorites.user.js#L5073)** · src L35

```js
// { [genreName]: "include" | "exclude" }
```

**[L5074](./osu-local-favorites.user.js#L5074)** · src L36

```js
// "" = no collection filter (show all)
```

**[L5076](./osu-local-favorites.user.js#L5076)** · src L38

```js
// Inject shared styles once - covers scrollbar, slide-down banner, and slide-up prompt
```

**[L5122](./osu-local-favorites.user.js#L5122)** · src L85

```js
// Shows an overlay popup centered inside the panel
```

**[L5127](./osu-local-favorites.user.js#L5127)** · src L91

```js
// Backdrop - covers the panel content but not the header
```

**[L5133](./osu-local-favorites.user.js#L5133)** · src L98

```js
// Card
```

**[L5139](./osu-local-favorites.user.js#L5139)** · src L105

```js
// Accent header
```

**[L5162](./osu-local-favorites.user.js#L5162)** · src L129

```js
// Body
```

**[L5168](./osu-local-favorites.user.js#L5168)** · src L136

```js
// Footer
```

**[L5206](./osu-local-favorites.user.js#L5206)** · src L175

```js
// ── Header ─────────────────────────────────────────────
```

**[L5282](./osu-local-favorites.user.js#L5282)** · src L252

```js
// Debounced search: renderList() re-filters, re-sorts, and rebuilds the
// whole visible list from scratch (chunked over rAF, but still). On a
// 500+ map library every keystroke used to pay that full price - typing
// a 10-character query ran it 10 times in quick succession. A 150ms
// debounce keeps the live-filter feel while collapsing a typing burst
// into one render.
```

**[L5295](./osu-local-favorites.user.js#L5295)** · src L271

```js
// ── GitHub star notice (shown once, ever, on first panel open) ──
```

**[L5330](./osu-local-favorites.user.js#L5330)** · src L307

```js
// ── Toolbar ────────────────────────────────────────────
```

**[L5357](./osu-local-favorites.user.js#L5357)** · src L335

```js
// Genre filter - 3-tap cycle per genre: neutral → include (green) →
// exclude (red) → neutral. Sits at the end of the Date/Title/Artist/Status
// cluster on the left.
```

**[L5408](./osu-local-favorites.user.js#L5408)** · src L389

```js
// Collections selector - opposite side of the toolbar from the sort/genre
// cluster. Picks which collection (if any) the list is filtered to.
```

**[L5442](./osu-local-favorites.user.js#L5442)** · src L425

```js
// ── Content area (favorites list + settings view share this space) ──
```

**[L5446](./osu-local-favorites.user.js#L5446)** · src L430

```js
// ── List ───────────────────────────────────────────────
```

**[L5456](./osu-local-favorites.user.js#L5456)** · src L441

```js
// ── Settings view (hidden until the gear button is clicked) ──
// The pane itself is built by ui/settings.js; this file only decides where
// it sits (inside the scrolling content area, as a sibling of the list) and
// when it is visible. The deps object is that view's whole interface back
// into the panel instance: each name is a function declaration in this
// scope, so they are already defined by the time anything calls them.
```

**[L5468](./osu-local-favorites.user.js#L5468)** · src L459

```js
// ── Footer - sync status bar, doubles as a shortcut into Settings ──
```

**[L5494](./osu-local-favorites.user.js#L5494)** · src L486

```js
// ── Now Playing bar - persistent mini-player ─────────────────
// This intentionally lives as a direct child of the fixed panel rather
// than inside the scrolling content area. It therefore never moves with
// the favorites/settings scroll position.
```

**[L5502](./osu-local-favorites.user.js#L5502)** · src L498

```js
// Album-art backdrop - subtle and blurred, so the bar visually inherits
// the same artwork as the track without making the controls unreadable.
```

**[L5512](./osu-local-favorites.user.js#L5512)** · src L510

```js
// Track thumbnail - this is deliberately a normal img rather than a
// background-only image, so the current cover remains identifiable.
```

**[L5596](./osu-local-favorites.user.js#L5596)** · src L596

```js
// The current track's source is still being decided (cache lookup in
// flight), so audio.src is whatever played before: play/pause here would
// act on that instead. The pending request starts playback by itself.
```

**[L5604](./osu-local-favorites.user.js#L5604)** · src L607

```js
// Resets whatever card is currently linked to the audio element back to
// its idle look - shared by the "switch to a different track" path and
// the natural end-of-track path.
```

**[L5630](./osu-local-favorites.user.js#L5630)** · src L636

```js
// Older local favorites may not have a stored covers object. Fall back to
// osu!'s deterministic beatmapset cover URL so the mini-player still gets
// artwork even for those entries.
```

**[L5633](./osu-local-favorites.user.js#L5633)** · src L642

```js
// Starts a track by id/record, linking up whichever card is currently
// on screen for it (if any - long lists build cards lazily) and the
// Now Playing bar. `navigated` marks a track reached via Back/Next/
// auto-next/shuffle rather than a direct click on its own preview
// button, which is what gates the "skip if not on Hina" check in
// ensureAudio(). The full-song mirror remains the primary source whenever
// enabled; the official short preview is selected only by the fallback
// path if the mirror fails or reports a short clip.
```

**[L5644](./osu-local-favorites.user.js#L5644)** · src L661

```js
// Per-track: true once this track started playing from the local cache
// copy (see the cache-first swap below). Reset here so a cached track
// never suppresses the streaming cache write for a *different* one.
```

**[L5655](./osu-local-favorites.user.js#L5655)** · src L675

```js
// Don't drop playbackState to "none" here: this runs on every track
// handoff (including auto-next while backgrounded), and the load()
// below takes a moment before the "play" listener sets it back to
// "playing". Reporting "none" during that gap is a second way Android
// can read the session as ended and kill the notification's
// foreground service on a locked screen. Leave the previous state
// (normally still "playing") in place; the "play" event corrects it
// moments later regardless.
```

**[L5689](./osu-local-favorites.user.js#L5689)** · src L717

```js
// Now Playing artwork: same cache-first rule as list covers. Swap in
// the cached blob asynchronously; the network URL set above renders
// immediately and stays if the cache has nothing fresh.
```

**[L5707](./osu-local-favorites.user.js#L5707)** · src L738

```js
// Release the previous track's cached object URL before switching away.
// Keyed by the source URL its bytes were cached under - which is
// `_activePreviewUrl` only until a track has been swapped onto its local
// copy, after which that property holds the blob: URL itself and the
// lookup below would miss (leaking the object URL for the whole tab).
```

**[L5716](./osu-local-favorites.user.js#L5716)** · src L752

```js
// ── Cache-first source selection ─────────────────────────────────
// The persistent cache is consulted *before* a source is chosen, so a
// track that is already cached never has the remote preview URL
// assigned to the element at all - not even for one tick - and therefore
// never opens a request for it. Three tiers, cheapest first:
//   1. getKnownCachedBlob() - synchronous; this session's in-memory
//      copy, normally hydrated ahead of the click by the card's
//      pointer/hover/focus prewarm (see buildCard) or by an earlier play
//      of the same song,
//   2. one IndexedDB read via lookupCachedBlob(), bounded (see
//      media-cache-db.js) so a wedged storage backend can never stall
//      playback,
//   3. the network source, whose bytes are then cached as they stream.
// Only tier 3 issues a request.
//
// Tier 2's await is safe for autoplay policy: it is a local read of a
// few milliseconds, far inside the transient-activation window a click
// grants, so the play() below is still a gesture-driven call. Tier 1
// resolves in a microtask and never leaves the click's own task at all -
// which is exactly why the prewarm exists.
```

**[L5717](./osu-local-favorites.user.js#L5717)** · src L773

```js
// Stamped on every request so a decision that lands after the user has
// already moved on cannot write its source, or its UI state, over the
// newer request's.
```

**[L5719](./osu-local-favorites.user.js#L5719)** · src L778

```js
// Tells the card's own button that a source decision is still in flight,
// so a second click is not mistaken for pause/resume of the *previous*
// track - audio.src still points at it until beginWithSource() runs.
```

**[L5722](./osu-local-favorites.user.js#L5722)** · src L784

```js
// Superseded while the lookup was in flight (another card, Back/Next,
// auto-next, a shuffle jump): that request owns the element now.
```

**[L5734](./osu-local-favorites.user.js#L5734)** · src L798

```js
// Cache hit: the element only ever sees the local blob: URL. Miss: the
// network source, which the streaming writer below fills in so the
// next play of this song is a hit.
```

**[L5743](./osu-local-favorites.user.js#L5743)** · src L810

```js
// A response may arrive after the user chose another card. Only
// apply it to the media element while this exact track/source is
// still active.
```

**[L5745](./osu-local-favorites.user.js#L5745)** · src L815

```js
// This often arrives after playback has already created Android's
// media notification, so submit a second position state now.
```

**[L5750](./osu-local-favorites.user.js#L5750)** · src L822

```js
// Keep this request's source so a late rejection from a failed mirror
// cannot tear down the UI after fallbackToOfficialPreview() has already
// replaced it with osu!'s working preview (e.g. Nightrunning (7_7
// Bootleg)). Read back from the property that was just set, so it
// matches a cached local copy and a network URL alike - a blob: URL
// never string-matches the request URL.
```

**[L5755](./osu-local-favorites.user.js#L5755)** · src L833

```js
// This play() belonged to a source that has since been replaced by
// the official fallback, or to a track the user has moved away
// from. Its rejection is stale and must not hide the active
// mini-player.
```

**[L5757](./osu-local-favorites.user.js#L5757)** · src L839

```js
// Firefox can reject the original mirror play() asynchronously even
// after its error event has selected the official fallback. That
// promise belongs to the mirror forever; only the media error path
// may decide whether the replacement preview has genuinely failed.
```

**[L5758](./osu-local-favorites.user.js#L5758)** · src L844

```js
// A direct official preview has no alternative source to recover to.
```

**[L5764](./osu-local-favorites.user.js#L5764)** · src L851

```js
// Cache the track while it streams. The write is progressive (bytes are
// persisted in chunks as they arrive rather than only after the whole
// file lands), resumes from where it left off if a previous attempt was
// interrupted, and stops as soon as this track is no longer the active
// source - so skipping a song no longer downloads it in full for
// nothing.
//
// It starts once playback has actually begun rather than up front. The
// media element's own request must reach the mirror first (this is the
// reason caching used to be disabled on Firefox Android entirely, where
// the tap-to-first-byte timing is the fragile part); a parallel reader
// that only begins after "playing" fires cannot delay that, and unlike
// the old whole-file approach it also cannot waste more than the few
// hundred KB that arrived before the user moved on.
//
// A track being served from the cache is excluded outright: the lookup
// above already answered for it, so there is nothing left to fetch.
```

**[L5771](./osu-local-favorites.user.js#L5771)** · src L875

```js
// Explicit pre-request check: if this browser already holds a
// written cache entry for the song, do not issue any request at
// all. Only a genuine miss downloads; an interrupted download is
// not a miss either - it resumes from its stored chunks with a
// Range request for the remainder (see startStreamingCacheWrite).
```

**[L5781](./osu-local-favorites.user.js#L5781)** · src L890

```js
// The decision itself. A synchronous in-memory hit skips the lookup
// entirely; otherwise this is the one bounded IndexedDB read that has to
// happen before play().
```

**[L5786](./osu-local-favorites.user.js#L5786)** · src L898

```js
// Nothing on this path is expected to throw (the lookup swallows its
// own failures and resolves null instead), but a source that could not
// be assigned at all must not leave the row stuck showing pause.
```

**[L5794](./osu-local-favorites.user.js#L5794)** · src L909

```js
// Moves to the next (direction 1) or previous (direction -1) track in
// the currently visible, sorted/filtered list. Shuffle picks a random
// track instead of stepping in order.
```

**[L5818](./osu-local-favorites.user.js#L5818)** · src L936

```js
// Wire this panel's Now Playing bar + queue functions into the
// (page-lifetime, singleton) audio element. The bar itself is mounted
// directly in this panel's content area, so it never scrolls away with
// the list/settings view.
```

**[L5828](./osu-local-favorites.user.js#L5828)** · src L950

```js
// Reconcile the freshly-rendered favorite cards with the singleton audio.
// renderList() can replace the DOM node for the current song while playback
// is still alive; never let the detached node remain the active UI owner.
```

**[L5839](./osu-local-favorites.user.js#L5839)** · src L964

```js
// Clear the old card refs first; then link them to this newly-mounted node.
```

**[L5886](./osu-local-favorites.user.js#L5886)** · src L1012

```js
// ── View switching ───────────────────────────────────────
```

**[L5893](./osu-local-favorites.user.js#L5893)** · src L1020

```js
// The search field belongs only to the favorites list. Collapse the
// header to its title row while Settings is open so it does not leave
// an empty search-sized gap above the controls.
```

**[L5905](./osu-local-favorites.user.js#L5905)** · src L1035

```js
// Returning to the list from Settings rebuilds rows so controls pick
// up changed settings, then reconnects the current audio track to the
// newly-created card instead of leaving stale detached DOM refs.
```

**[L5911](./osu-local-favorites.user.js#L5911)** · src L1044

```js
// ── Helpers ────────────────────────────────────────────
```

**[L5936](./osu-local-favorites.user.js#L5936)** · src L1070

```js
// ── Render list ────────────────────────────────────────
```

**[L5943](./osu-local-favorites.user.js#L5943)** · src L1078

```js
// Filter
```

**[L5956](./osu-local-favorites.user.js#L5956)** · src L1092

```js
// Genre/tag filter - terms are stored as lowercase keys (see
// showGenreFilterMenu). Multiple "include" terms are OR'd together;
// any "exclude" term always drops the entry, even if it also matched
// an include. A term matches either the favorite's genre or any one
// of its space-separated tags (favMatchesGenreTerm).
```

**[L5967](./osu-local-favorites.user.js#L5967)** · src L1108

```js
// Collection filter
```

**[L5973](./osu-local-favorites.user.js#L5973)** · src L1115

```js
// The badge reflects the visible result set after search, genre/tag,
// and collection filters, rather than always showing the library total.
```

**[L5975](./osu-local-favorites.user.js#L5975)** · src L1119

```js
// Sort
```

**[L5989](./osu-local-favorites.user.js#L5989)** · src L1134

```js
// Snapshot for the Now Playing bar's Back/Next/shuffle - always the
// currently visible, filtered/sorted order.
```

**[L5992](./osu-local-favorites.user.js#L5992)** · src L1139

```js
// Invalidate any chunk-append from a previous render (also covers the
// early-return paths below).
```

**[L5994](./osu-local-favorites.user.js#L5994)** · src L1143

```js
// Disconnect any previous lazy-load observer so orphaned refs don't linger
```

**[L5998](./osu-local-favorites.user.js#L5998)** · src L1148

```js
// IntersectionObserver rooted on the scroll container, 100px look-ahead on each side
```

**[L6007](./osu-local-favorites.user.js#L6007)** · src L1158

```js
// IndexedDB lookup is local and fast, so it's fine to wait for
// it before assigning src - avoids a network fetch now and a
// second, cached-copy swap-in moments later (which would
// otherwise cause a visible flicker on every card).
```

**[L6028](./osu-local-favorites.user.js#L6028)** · src L1184

```js
// Card BUILDER - rows are constructed lazily, one chunk per animation
// frame (see renderChunk below), so opening the panel with 500+ favorites
// doesn't build ~15k DOM nodes inside the click handler.
```

**[L6039](./osu-local-favorites.user.js#L6039)** · src L1198

```js
// Cover
```

**[L6050](./osu-local-favorites.user.js#L6050)** · src L1210

```js
// Don't set src yet - the IntersectionObserver will do it when the row
// scrolls within 100px of the list viewport
```

**[L6056](./osu-local-favorites.user.js#L6056)** · src L1218

```js
// insertBefore instead of textContent= so dimOverlay & previewBtn
// (appended after this block) are not destroyed
```

**[L6065](./osu-local-favorites.user.js#L6065)** · src L1229

```js
// Dim overlay - sits at --osu-fav-idle-dim normally (0 by default,
// i.e. invisible) and brightens to --osu-fav-hover-dim on hover/while playing
```

**[L6071](./osu-local-favorites.user.js#L6071)** · src L1237

```js
// Info
```

**[L6132](./osu-local-favorites.user.js#L6132)** · src L1299

```js
// Add-to-collection dropdown - sits right next to the date-added text.
// Shows a checkmark + count once the map is in at least one collection.
```

**[L6153](./osu-local-favorites.user.js#L6153)** · src L1322

```js
// Membership changed - if a collection filter is active, this
// card may need to appear/disappear from the visible list.
```

**[L6159](./osu-local-favorites.user.js#L6159)** · src L1330

```js
// Progress bar (shown during playback)
```

**[L6169](./osu-local-favorites.user.js#L6169)** · src L1341

```js
// Actions
```

**[L6188](./osu-local-favorites.user.js#L6188)** · src L1361

```js
// If a default mirror is configured (Settings → Download Mirrors)
// and it's actually usable right now (mirror still enabled, or
// Official while actually signed in), skip the dropdown entirely
// and go straight to a real download link. Otherwise fall back to
// the normal "Download ▾" trigger - resolveDefaultMirror() already
// returns null for anything that wouldn't work, so this never
// hands out a dead link.
//
// Separately: even with no default set, buildDownloadOptions() can
// still only have exactly one entry (e.g. a signed-out guest with
// every mirror disabled - Official is the only option, "requires
// sign-in" and all). A "▾" dropdown that opens to one single row is
// just a pointless extra click, so that case also collapses to a
// plain link, same as the default-mirror path.
```

**[L6250](./osu-local-favorites.user.js#L6250)** · src L1437

```js
// Preview button - singleton audio (module-level ensureAudio()), only one plays at a time
```

**[L6254](./osu-local-favorites.user.js#L6254)** · src L1442

```js
// Hydrate this track's cache entry as soon as the user shows intent
// (hover or pointer-down on the row, or keyboard focus). Then the
// click's cache lookup is a synchronous memory hit and the local copy
// is chosen without ever awaiting IndexedDB - see the cache-first
// source selection in startPlayback(). Prewarming only ever populates
// the small LRU, so sweeping a few rows costs no retained memory.
```

**[L6259](./osu-local-favorites.user.js#L6259)** · src L1453

```js
// Play button - lives inside the cover, centred, shown on hover or while playing
```

**[L6269](./osu-local-favorites.user.js#L6269)** · src L1464

```js
// Show/hide button on cover hover; restore original border/color on hover
```

**[L6286](./osu-local-favorites.user.js#L6286)** · src L1482

```js
// Compare by id, not by src string - a cached play sets audio.src
// to a local blob: URL, which never string-matches previewUrl.
```

**[L6287](./osu-local-favorites.user.js#L6287)** · src L1485

```js
// A source decision for this same track is still in flight, so
// audio.src does not point at it yet - a play/pause here would act on
// whatever played before. The pending play() starts on its own.
```

**[L6298](./osu-local-favorites.user.js#L6298)** · src L1499

```js
// Re-link the bar/dim to this card every time we (re)start
// playback, not just on a genuinely new src - if the previous
// play ran to completion, the "ended" handler already cleared
// audio._activeBar/_activeDim and hid the progress wrap, so a
// plain audio.play() here would resume sound with nothing
// wired up to draw progress for it.
```

**[L6312](./osu-local-favorites.user.js#L6312)** · src L1519

```js
// Different track - hand off to the shared player so the Now
// Playing bar and Back/Next queue stay in sync too.
```

**[L6317](./osu-local-favorites.user.js#L6317)** · src L1526

```js
// Reconcile a track that is already loaded in the singleton audio
// element with this freshly built card. renderList() runs on panel
// open, close/reopen, and every external refresh while playback
// keeps going; buildCard always rendered the button in its idle
// state, and syncCurrentCardUI() fires before the chunked append has
// created this row - so the playing/paused state and progress bar
// were forgotten on every rebuild. Link the live card here, per
// chunk, exactly when the node comes into existence.
```

**[L6341](./osu-local-favorites.user.js#L6341)** · src L1558

```js
// Chunked build+append - mounting 500+ rows in one synchronous pass
// blocked the click handler for seconds and forced full-layout reflows.
// Smaller chunks keep each frame comfortably under the ~50ms budget
// Chrome flags as janky, at the cost of slightly more frames to finish
// mounting a very long list - imperceptible either way while scrolled
// near the top, and it's non-blocking regardless.
```

**[L6342](./osu-local-favorites.user.js#L6342)** · src L1565

```js
// set at top of this function
```

**[L6345](./osu-local-favorites.user.js#L6345)** · src L1568

```js
// superseded by newer render
```

**[L6355](./osu-local-favorites.user.js#L6355)** · src L1578

```js
// ── Mobile search bar behavior ─────────────────────────────
// On narrow screens the search field collapses while the favorites list is
// scrolled down, giving the cards more vertical room. The mini-player is
// deliberately outside the scrolling list, so it remains pinned while the
// search bar hides/reappears.
```

**[L6391](./osu-local-favorites.user.js#L6391)** · src L1619

```js
// Collapse the header itself with the search field. The input alone can
// disappear while osu!'s global CSS still leaves a large header box.
```

**[L6401](./osu-local-favorites.user.js#L6401)** · src L1631

```js
// ── Assemble & wire events ─────────────────────────────
// Bottom UI is a panel-level sibling of the scrolling content, exactly like
// the top header: it is absolutely pinned to the panel bottom and never
// participates in the scrollable list/settings viewport.
```

**[L6411](./osu-local-favorites.user.js#L6411)** · src L1645

```js
// Expose the in-place re-render so changes made anywhere else (a heart
// clicked on the page behind, Copy All, a Gist restore, another tab) can
// update this panel without tearing it down. renderList() re-reads the
// store and rebuilds the rows while keeping the closure state - search
// text, sort, genre filter, active collection - and the mini-player's
// binding intact, which destroying and reopening the panel does not.
```

**[L6416](./osu-local-favorites.user.js#L6416)** · src L1656

```js
// Automatic checks can be disabled in Settings. Manual checks remain
// available from Settings and the userscript menu either way.
```

**[L6426](./osu-local-favorites.user.js#L6426)** · src L1668

```js
// Re-renders the favorites panel's list if it is currently open.
// A no-op when the panel is closed, so callers never have to check first.
//
// Deferred rather than immediate, for two reasons:
//
//  1. Re-entrancy. The favorites-changed notification fires synchronously
//     from inside setFavorites(), which is itself usually called from a
//     click handler on a row in this very list. Rebuilding the list right
//     there would detach the node whose handler is still executing, and
//     the rest of that handler would then operate on orphaned elements.
//  2. Double work. Panel-internal handlers already call renderList()
//     themselves after mutating. The render counter below lets a queued
//     refresh notice that the panel has already caught up and skip - so
//     an in-panel action still costs exactly one render, not two.
```

**[L6429](./osu-local-favorites.user.js#L6429)** · src L1685

```js
// `force` is used for storage changes received from another tab. A local
// panel action may already have queued a render when that notification
// arrives; coalescing the notification away would leave page A showing its
// old list until the next local interaction.
```

**[L6442](./osu-local-favorites.user.js#L6442)** · src L1702

```js
// Re-read: the panel may have been closed, or replaced by a newly
// opened one, between queueing and now.
```

**[L6448](./osu-local-favorites.user.js#L6448)** · src L1710

```js
// the panel already re-rendered itself; nothing stale left
```

**[L6455](./osu-local-favorites.user.js#L6455)** · src L1717

```js
// If an external notification arrived while this render was queued,
// perform one authoritative follow-up instead of dropping it.
```


## `src/ui/menu-commands.js`

1 comments · userscript [L6465](./osu-local-favorites.user.js#L6465) - [L6465](./osu-local-favorites.user.js#L6465)

**[L6465](./osu-local-favorites.user.js#L6465)** · src L5

```js
// ═══ Menu commands ═══
// These run at top-level, before init() - an unguarded throw here (rather
// than the graceful no-op-stub behavior GM_getValue/GM_setValue fall back
// to in some environments) would silently prevent everything below,
// including init() itself, from ever running.
```


## `src/ui/guest-fallback.js`

10 comments · userscript [L6500](./osu-local-favorites.user.js#L6500) - [L6568](./osu-local-favorites.user.js#L6568)

**[L6500](./osu-local-favorites.user.js#L6500)** · src L5

```js
// ═══ Guest-mode fallback button ═══
// On beatmapset detail pages (/beatmapsets/12345), no heart button exists when
// not signed in. We inject a standalone button into the page header area.
```

**[L6502](./osu-local-favorites.user.js#L6502)** · src L10

```js
// Only on beatmapset detail pages (not the listing /beatmapsets)
```

**[L6503](./osu-local-favorites.user.js#L6503)** · src L12

```js
// Don't inject if already present
```

**[L6508](./osu-local-favorites.user.js#L6508)** · src L18

```js
// If the native osu! favourite button already exists on the page (user is logged in),
// we don't need to inject our guest fallback - our click interceptor handles the native
// button. Osu!'s own class/title FLIPS once a beatmapset is already favourited
// (…-square-favourite/"favourite this beatmap" → …-square-unfavourite/"unfavourite
// this beatmap"), so both states must be checked or an already-favourited map's native
// button goes undetected and we'd inject a visually-identical duplicate heart next to it.
```

**[L6517](./osu-local-favorites.user.js#L6517)** · src L33

```js
// Try multiple anchor points in order of preference.
// Prefer the header buttons row (.beatmapset-header__buttons) so our button sits alongside
// the native download buttons. Fall back progressively for older/different page layouts.
```

**[L6530](./osu-local-favorites.user.js#L6530)** · src L49

```js
// Build the button using the exact same class and inner-HTML structure as osu!'s
// native favourite button - so it sits flush with the download buttons and uses
// the page's own CSS for sizing, colours, and hover effects.
```

**[L6540](./osu-local-favorites.user.js#L6540)** · src L62

```js
// Inner HTML mirrors the native button exactly:
// <span.btn-osu-big__content> > <span.btn-osu-big__icon> > <span.fa.fa-fw> > <span.{far|fas}.fa-heart>
```

**[L6553](./osu-local-favorites.user.js#L6553)** · src L77

```js
// Mirror the native button's animation
```

**[L6556](./osu-local-favorites.user.js#L6556)** · src L81

```js
// Toggle the heart icon class
```

**[L6568](./osu-local-favorites.user.js#L6568)** · src L94

```js
// Prepend so it appears before the download buttons, matching logged-in position
```


## `src/ui/guest-downloads.js`

16 comments · userscript [L6572](./osu-local-favorites.user.js#L6572) - [L6716](./osu-local-favorites.user.js#L6716)

**[L6572](./osu-local-favorites.user.js#L6572)** · src L4

```js
// ═══ Enable download buttons for guest/logged-out users ═══
// Based on exact DOM structure observed via Kimi WebBridge in logged-in Helium session:
//
// Logged-in listing/user panel download item:
//   <a class="beatmapset-panel__menu-item" href="…/download"
//      data-orig-title="download with video"><span class="fas fa-file-download"></span></a>
//   (user pages use title= instead of data-orig-title=, but same shape)
//
// Logged-in detail page:
//   <a class="btn-osu-big btn-osu-big--beatmapset-header" href="…/download">…Download with Video…</a>
//   <a class="btn-osu-big btn-osu-big--beatmapset-header" href="…/download?noVideo=1">…without Video…</a>
```

**[L6573](./osu-local-favorites.user.js#L6573)** · src L16

```js
// ── 1. Beatmap panel cards (listing + user pages) ────────────────────────
// Replace disabled <span class="beatmapset-panel__menu-item"> download spans
// with real <a> links that match the logged-in element exactly.
```

**[L6574](./osu-local-favorites.user.js#L6574)** · src L20

```js
// Already converted - skip
```

**[L6592](./osu-local-favorites.user.js#L6592)** · src L39

```js
// Context not resolvable yet (card still mid-render) - leave unmarked
// so the next pass retries instead of skipping this element forever.
```

**[L6598](./osu-local-favorites.user.js#L6598)** · src L47

```js
// Match logged-in: listing pages use data-orig-title, user pages use title
```

**[L6601](./osu-local-favorites.user.js#L6601)** · src L51

```js
// Preserve qtip attributes so tooltips work
```

**[L6606](./osu-local-favorites.user.js#L6606)** · src L57

```js
// Inner content: keep the original icon span (fas fa-file-download)
```

**[L6610](./osu-local-favorites.user.js#L6610)** · src L62

```js
// ── 2. Beatmapset detail pages (/beatmapsets/ID) ─────────────────────────
// When logged out, osu! renders a "Sign In to access more features" button
// instead of the download links. Replace it with the exact logged-in pair.
```

**[L6613](./osu-local-favorites.user.js#L6613)** · src L68

```js
// Guard: if real download links already exist (script ran before, or user logged in),
// or if we already injected them, don't duplicate.
```

**[L6625](./osu-local-favorites.user.js#L6625)** · src L82

```js
// Build "Download with Video" - matches logged-in <a class="btn-osu-big btn-osu-big--beatmapset-header">
```

**[L6641](./osu-local-favorites.user.js#L6641)** · src L99

```js
// Build "Download without Video"
```

**[L6660](./osu-local-favorites.user.js#L6660)** · src L119

```js
// Detects osu!plus (limjeck/osuplus) already having injected its own mirror
// buttons on this page - it tags them with this exact class in its
// makeMirror() function. If present, we skip adding our own to avoid a
// cluttered duplicate row of near-identical buttons.
```

**[L6664](./osu-local-favorites.user.js#L6664)** · src L127

```js
// Builds a button matching osu!'s own native download-button markup
// exactly (same classes osu!'s big buttons and osu!plus's mirror buttons
// use) - so ours inherit the page's real CSS instead of looking like a
// custom pill glued on top of it.
```

**[L6682](./osu-local-favorites.user.js#L6682)** · src L149

```js
// Injects native-styled mirror-download buttons onto the beatmapset detail
// page, right after the official download buttons. These work regardless
// of login state or a beatmapset's download_disabled flag - a solid
// fallback for anything the official button can't do. Cheap to call
// repeatedly; only rebuilds when the current beatmapset id actually
// changes, and stands down entirely if osu!plus already covers this.
```

**[L6698](./osu-local-favorites.user.js#L6698)** · src L171

```js
// already current
```

**[L6716](./osu-local-favorites.user.js#L6716)** · src L189

```js
// Match osu!plus's own insertion point exactly: before "…more" if it
// exists, otherwise appended into the main buttons row.
```


## `src/core/toast.js`

1 comments · userscript [L6724](./osu-local-favorites.user.js#L6724) - [L6724](./osu-local-favorites.user.js#L6724)

**[L6724](./osu-local-favorites.user.js#L6724)** · src L1

```js
// ═══ Toast helper ═══
```


## `src/data/version-check.js`

7 comments · userscript [L6751](./osu-local-favorites.user.js#L6751) - [L6805](./osu-local-favorites.user.js#L6805)

**[L6751](./osu-local-favorites.user.js#L6751)** · src L3

```js
// ═══ Version check & update helper ═══
```

**[L6757](./osu-local-favorites.user.js#L6757)** · src L10

```js
// getCurrentVersion() reads directly from Tampermonkey's GM_info API, which always
// mirrors the @version header - no separate constant to keep in sync.
```

**[L6758](./osu-local-favorites.user.js#L6758)** · src L13

```js
// Primary: Tampermonkey/Violentmonkey expose GM_info.script.version from the @version tag
```

**[L6761](./osu-local-favorites.user.js#L6761)** · src L17

```js
// Fallback: scan script tags in the document for a @version comment (development use)
```

**[L6787](./osu-local-favorites.user.js#L6787)** · src L44

```js
// 12 hours
```

**[L6800](./osu-local-favorites.user.js#L6800)** · src L57

```js
// Always fetch the live main branch so version checks pick up real releases
```

**[L6805](./osu-local-favorites.user.js#L6805)** · src L63

```js
// Only scan the UserScript header block (first 2 KB) for speed
```


## `src/ui/update-prompt.js`

7 comments · userscript [L6829](./osu-local-favorites.user.js#L6829) - [L6918](./osu-local-favorites.user.js#L6918)

**[L6829](./osu-local-favorites.user.js#L6829)** · src L3

```js
// ═══ Update prompt UI ═══
// Shown on page load when a new version is detected and the panel isn't open.
// Reuses the same palette as the panel so it looks consistent.
```

**[L6834](./osu-local-favorites.user.js#L6834)** · src L11

```js
// Inject slide-in keyframe if not already present
```

**[L6848](./osu-local-favorites.user.js#L6848)** · src L26

```js
// Matches panel: dark #111 bg, #333 border, same font stack, same shadow
```

**[L6865](./osu-local-favorites.user.js#L6865)** · src L44

```js
// Gradient accent bar - same as displayUpdateBanner inside the panel
```

**[L6889](./osu-local-favorites.user.js#L6889)** · src L69

```js
// Body - same text color and line-height as panel text
```

**[L6895](./osu-local-favorites.user.js#L6895)** · src L76

```js
// Footer buttons - mirror the toolbar makeBtn style from the panel
```

**[L6918](./osu-local-favorites.user.js#L6918)** · src L100

```js
// "Update" button - same style as the in-panel banner's Update button
```


## `src/core/init.js`

36 comments · userscript [L6939](./osu-local-favorites.user.js#L6939) - [L7245](./osu-local-favorites.user.js#L7245)

**[L6939](./osu-local-favorites.user.js#L6939)** · src L32

```js
// ═══ Init ═══
```

**[L6942](./osu-local-favorites.user.js#L6942)** · src L36

```js
// osu!'s own qtip tooltips/popups (difficulty hover cards, user cards,
// achievement popups, etc.) sit at z-index ~512 on the live site - far
// below the favorites panel's z-index (100000+). Whenever a tooltip
// would land underneath the panel's screen area (fixed to the right
// edge, full viewport height), it rendered completely invisible instead
// of on top like it should. This is injected unconditionally at init,
// not folded into the panel's own lazily-created stylesheet, so it's in
// effect from the very first hover - not just after the panel has been
// opened once.
```

**[L6949](./osu-local-favorites.user.js#L6949)** · src L52

```js
// Single place where a change to the favorites store becomes visible.
// Everything that mutates favorites - the panel, a heart on a card, the
// floating heart, Copy All, a Gist restore, another tab - routes through
// here, so no mutation site has to remember to refresh the UI itself
// (which is how the page's hearts and the open panel used to end up
// needing a reload to catch up).
//
// Registered before anything can mutate the store.
```

**[L6952](./osu-local-favorites.user.js#L6952)** · src L63

```js
// Enrichment filled in metadata for maps that are already favorited.
// Hearts are unaffected. Coalesce these - a bulk pass fires roughly
// once a second and rebuilding the list each time would make the
// panel unusable while it runs.
```

**[L6964](./osu-local-favorites.user.js#L6964)** · src L79

```js
// OAuth callback must be handled as early as possible so the user never
// sees a flash of the raw ?code=…&state=… query string on /home.
```

**[L6966](./osu-local-favorites.user.js#L6966)** · src L83

```js
// One-time-per-favorite migration: back-fill the enrichment queue with
// any favorite that has not completed metadata enrichment. Defer this potentially large
// scan and persist it with one batched GM write after the page gets a
// chance to render. The old per-favorite loop serialized and persisted
// the entire queue once per item, making first load scale badly in
// Tampermonkey, especially on Firefox Android.
```

**[L6972](./osu-local-favorites.user.js#L6972)** · src L95

```js
/* never break page load over this */
```

**[L6980](./osu-local-favorites.user.js#L6980)** · src L103

```js
// ═══ Cross-tab sync ═══
// When another tab writes to the favorites key, refresh all UI in this tab.
// GM_addValueChangeListener isn't implemented at all in some userscript
// managers (a hard ReferenceError rather than a graceful no-op stub like
// GM_getValue/GM_setValue get) - left unguarded, that throw would abort
// every line below it in this function, including the MutationObserver
// setup further down that keeps the page's hearts working after the
// first render. Cross-tab sync is a nice-to-have; losing it silently is
// far better than losing everything after it.
```

**[L6983](./osu-local-favorites.user.js#L6983)** · src L115

```js
// ignore writes from this same tab
```

**[L6985](./osu-local-favorites.user.js#L6985)** · src L117

```js
// Use the value delivered with the notification instead of asking
// GM_getValue() immediately. Some managers notify sibling tabs before
// their storage read API has caught up; rebuilding from that read
// would leave page A showing page B's old list until another event.
```

**[L6988](./osu-local-favorites.user.js#L6988)** · src L124

```js
// Re-render floating heart (filled/outline SVG) for the current beatmap
```

**[L6990](./osu-local-favorites.user.js#L6990)** · src L127

```js
// Re-render the existing panel in place. Reopening it here would
// create a new closure and can race with a chunked render already in
// progress, leaving page A with the old list or a partial list.
```

**[L6992](./osu-local-favorites.user.js#L6992)** · src L132

```js
// Re-check all visible card hearts (clear the "already scanned" flag first)
```

**[L7006](./osu-local-favorites.user.js#L7006)** · src L147

```js
// Some userscript managers expose working GM_getValue/GM_setValue but
// do not implement a reliable GM_addValueChangeListener. gm-shim now
// broadcasts a tiny cross-tab signal through BroadcastChannel, with a
// localStorage storage-event fallback. The receiver waits briefly before
// reading native GM storage because some managers propagate the notification
// slightly before the updated value is visible to another tab. A second
// settle pass covers slower extension-storage implementations.
```

**[L7011](./osu-local-favorites.user.js#L7011)** · src L159

```js
// The signal only carries the key; wait for the manager's storage
// read to settle before invalidating and rebuilding the panel.
```

**[L7049](./osu-local-favorites.user.js#L7049)** · src L199

```js
// BroadcastChannel is more reliable than storage events in extension
// sandboxes and reaches sibling tabs/windows on the same origin directly.
```

**[L7059](./osu-local-favorites.user.js#L7059)** · src L211

```js
// storage-event fallback above remains active.
```

**[L7061](./osu-local-favorites.user.js#L7061)** · src L214

```js
// A tab can be backgrounded while another tab changes the store. On return,
// do one cheap authoritative re-read so a throttled background context
// cannot leave the open panel visually stale.
```

**[L7070](./osu-local-favorites.user.js#L7070)** · src L226

```js
// Collections (playlists) live under their own GM key, entirely separate
// from the favorites key above - creating/renaming/deleting a collection,
// or adding/removing a map from one, never touches STORAGE_KEY, so the
// listener above never fires for it. Without this, a tab with the panel
// already open would keep showing the collections list, the per-row
// "+ Playlist" badges and the active-collection filter exactly as they
// were at panel-open time until the tab was reloaded, no matter what was
// edited in another tab. refreshFavoritesPanel() re-reads
// getCollections() from scratch on every call, so invalidating the cache
// and refreshing is enough - no full panel teardown/rebuild needed.
```

**[L7082](./osu-local-favorites.user.js#L7082)** · src L248

```js
// Same story for the Appearance settings (accent, heart color, cover-art
// opacity/dim sliders): each lives under its own GM key and is applied by
// calling applyTheme(), which every mutation site already calls in its
// own tab. Nothing replayed that call in *other* open tabs, so changing
// the accent color in one tab left every other open tab showing the old
// colors until reload. applyTheme() just re-reads all six keys and
// rewrites the CSS custom properties on <html>, so it's cheap and
// idempotent to call from any of them changing remotely.
```

**[L7107](./osu-local-favorites.user.js#L7107)** · src L281

```js
// Auto-check version updates only when the user has left the setting on.
```

**[L7116](./osu-local-favorites.user.js#L7116)** · src L291

```js
// Debounced observer - runs at most once per 600ms to avoid freezing the page
```

**[L7121](./osu-local-favorites.user.js#L7121)** · src L297

```js
// Skip while the tab is in the background - a MutationObserver on
// the whole document body fires on osu!'s own live-updating content
// too (dashboard activity feed, notification counts, relative
// timestamps, etc.), not just our own changes, so on a busy page
// this can otherwise re-run every ~600ms indefinitely even while
// nobody's looking at the tab. The visibilitychange listener below
// catches up in one pass as soon as it's foregrounded again, so
// nothing actually goes stale - this just stops paying for it while
// backgrounded.
```

**[L7142](./osu-local-favorites.user.js#L7142)** · src L327

```js
// ═══ Turbolinks / back-forward resiliency ═══
// osu!'s site navigates via Turbolinks - going back restores a *cached
// snapshot* of the page rather than loading it fresh. That snapshot is a
// clone of whatever was on the page when it got cached, and cloning does
// not carry over addEventListener-based handlers. Our own injected
// elements (floating heart, panel, guest button, mirror row) come back
// looking identical but dead - same ids/classes, so our own "already
// there, skip" guards leave the lifeless clone in place instead of
// rebuilding a working one, and everything reads as "unresponsive" until
// a manual page reload. The MutationObserver above silently stops
// working here too, since it's watching whatever <body> existed at
// attach time and Turbolinks replaces <body> wholesale on every
// navigation. Wiping the known injected ids/classes and reattaching the
// observer on every Turbolinks navigation (cache-restore or fresh) fixes
// both issues at once.
```

**[L7148](./osu-local-favorites.user.js#L7148)** · src L348

```js
// Listen for the browser's native SPA navigation signal as well. The
// history API itself does not emit popstate for pushState/replaceState,
// which is why the URL poll remains as a final fallback.
```

**[L7157](./osu-local-favorites.user.js#L7157)** · src L360

```js
// Keep a live panel node when osu! swaps content in place. If a
// Turbolinks/Turbo snapshot cloned it, the clone has no render closure,
// so discard that inert copy and recreate it below when it was open.
```

**[L7169](./osu-local-favorites.user.js#L7169)** · src L375

```js
// Beatmap context (isLoggedIn's cached user blob, mirror row state)
// is per-page - a Turbolinks navigation may land on a different page
// as a different (or no) user, so stale caches must not survive it.
```

**[L7184](./osu-local-favorites.user.js#L7184)** · src L393

```js
// Remember whether the panel should be restored if navigation replaces the
// document with a cached snapshot. The panel itself is intentionally not
// removed during an in-place navigation, so its search/sort/filter state
// survives page changes.
```

**[L7187](./osu-local-favorites.user.js#L7187)** · src L400

```js
// Turbolinks (classic) fires "turbolinks:load"; Hotwire Turbo renamed it
// to "turbo:load" - listen for both since we can't be sure which is live.
```

**[L7189](./osu-local-favorites.user.js#L7189)** · src L404

```js
// Fallback for a genuine browser back/forward-cache restore, in case any
// navigation path bypasses Turbolinks entirely.
```

**[L7193](./osu-local-favorites.user.js#L7193)** · src L410

```js
// Polling for SPA navigation (low overhead). Some osu! routes do not emit
// either navigation event, and replacing <body> removes the panel before
// the next observer can run. Remember its open state between URL checks so
// the panel is recreated on the new page instead of silently disappearing.
```

**[L7201](./osu-local-favorites.user.js#L7201)** · src L422

```js
// The page content changed without a Turbolinks event. Markers left
// on nodes that survived the swap would make refreshButtons() skip
// them forever, so drop them and let the refresh below redraw from
// scratch.
```

**[L7215](./osu-local-favorites.user.js#L7215)** · src L440

```js
// Periodic fallback scan - the MutationObserver above catches almost
// everything, but some osu! content (e.g. the lazy-loaded "Beatmaps" tab
// on profile pages, which only fetches its data once scrolled into view)
// renders on its own schedule and can occasionally land between observer
// callbacks. This is a cheap, unconditional re-scan that guarantees
// hearts, the "Favorite all" button, and download links all settle into
// the correct state within ~1.5s no matter what triggered the render.
// Skipped while backgrounded for the same reason as debouncedRefresh
// above - a background tab has no reason to keep re-scanning the page
// every 1.5s forever; the visibilitychange listener below runs one pass
// immediately on returning to the tab instead.
```

**[L7225](./osu-local-favorites.user.js#L7225)** · src L461

```js
// Firefox Android may hand a media session to Android right as its tab is
// backgrounded. Re-publish an active preview at that boundary: this keeps
// the OS-owned session authoritative while osu!'s page is hidden and its
// regular page timers are throttled. Do not call play() here - playback
// was already user-initiated, and calling it again from this lifecycle
// event would violate Android's autoplay policy.
```

**[L7235](./osu-local-favorites.user.js#L7235)** · src L477

```js
// Catch up in one pass after returning to the tab, so pausing the scans
// above while hidden never leaves the page UI stale.
```

**[L7245](./osu-local-favorites.user.js#L7245)** · src L489

```js
// Initial refresh after page settles
```

