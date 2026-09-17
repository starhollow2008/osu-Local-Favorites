# Build & module layout

The userscript is no longer edited as one 7,400-line file. It is now 32
modules under `src/`, and `dist/osu-local-favorites.user.js` — the file users
actually install — is **generated**.

```
npm run build     # check the wiring, then bundle -> dist/
npm run check     # check only, write nothing
npm run check:strict   # same, but heuristic warnings also fail the build
```

The build writes two files:

| file | what it is |
| --- | --- |
| `dist/osu-local-favorites.user.js` | the userscript users install - plain code, no comments |
| `dist/comments.md` | every comment that was removed, linked to the line it came from |

No dependencies. Plain Node, `node build/build.js` works on a clean checkout.

---

## Layout

```
src/
  core/    bootstrap and cross-cutting plumbing
    gm-shim.js        GM_getValue/GM_setValue with a localStorage fallback
    interceptor.js    page-world XHR/fetch patch that blocks osu!'s own favourite calls
    errors.js         reportError() + the on-page error toast
    toast.js          the plain (non-error) toast helper
    init.js           observers, polling, cross-tab sync, startup
  data/    state, persistence, and anything that talks about beatmaps
    storage.js            favourites CRUD + in-memory cache
    collections.js        user playlists
    mirrors.js            mirror list, login detection, download prefs
    playback-settings.js  loop / autonext / shuffle / volume
    media-cache-db.js     IndexedDB cover + preview cache
    beatmap-extraction.js parse JSON / DOM card into a record
    favorite-detection.js find osu!'s heart buttons
    enrichment.js         background detail-page fetch + queue
    reenrichment.js       Settings -> Library Maintenance bulk pass
    toggle-favorite.js    the core add/remove action
    version-check.js      update checking
  api/     outbound network integrations
    osu-api.js       osu! API v2 OAuth2 + rate-limited GET
    gist-backup.js   GitHub Gist create/update/read
    previews.js      Hinamizawa full-length preview lookup
  ui/      everything that touches the DOM for the user
    theme.js, heart-visual.js, media-session.js, audio-player.js, download-menu.js,
    genre-filter.js, collections-menu.js, copy-all-button.js,
    floating-heart.js, menu-commands.js, guest-fallback.js, guest-downloads.js,
    update-prompt.js
    main-panel.js         the side panel: header, list, cards, mini-player
    settings.js           the whole ⚙ Settings pane, behind createSettingsView(deps)
build/
  build.js            entry point: the five gates below
  check-wiring.js     the three wiring checks
  bundle.js           the concatenator + comment strip
  modules.json        concatenation order (see "Ordering" below)
  lib/                shared helpers (comment/string stripper, import parser,
                      comment extraction + comments.md renderer)
meta/
  userscript-header.txt   the ==UserScript== block
dist/
  osu-local-favorites.user.js   GENERATED - do not edit
  comments.md                   GENERATED - the stripped comments
```

Dependency direction is meant to run `core` <- `data` <- `api` <- `ui`, with
`core/init.js` on top wiring everything together. It isn't enforced
mechanically (a few real cycles predate the split — see below), but it's the
rule of thumb for where a new function belongs.

---

## The five build gates

`build.js` refuses to write `dist/` unless all five pass, and on failure it
prints which gate broke and the `file:line` of every problem.

**1. Import targets resolve.** Every `import { x } from "./y.js"` points at a
file that exists and actually exports `x`. Catches typos and renames.

```
FAIL ui/guest-fallback.js:1  imports `getBeatmapIdTypo` from "../data/beatmap-extraction.js",
                             but data/beatmap-extraction.js does not export it
```

**2. Modules load as a real ES module graph.** Every module is imported
through Node's native ESM loader against a stub DOM/`GM_*` environment. This
is the gate that doesn't take the checker's word for anything — the engine's
own linker re-validates gate 1, and per-file syntax errors surface here too.

**3. No free cross-module references.** For each module, any whole-word use of
another module's exported name that isn't imported and isn't shadowed by a
local declaration is flagged. This is the one that catches the classic
refactor bug: you move a function out and the call site still compiles as a
reference to an undeclared global.

```
WARN ui/guest-fallback.js:46  uses `isFavorited` (exported by data/storage.js) without importing it
```

It's a static heuristic, so it warns rather than fails by default; `--strict`
promotes it to an error. Gate 2 will usually catch the same bug as a
`ReferenceError`, but only if that code path runs at load time — gate 3 finds
it in code that only runs when a user clicks something.

**4. Manifest matches disk.** `modules.json` and the files under `src/` must
agree in both directions. A new module that nobody added to the list fails the
build instead of being silently left out of the bundle.

**5. Bundled output parses and runs.** `node --check` on the concatenated
file, then evaluate it end-to-end in the stub environment. This catches
ordering bugs a syntax check can't: a `const` read before its declaration
because two modules landed in the wrong order. Because the bundle that gets
checked is the *stripped* one, this gate is also what proves that removing the
comments (see below) did not break the script.

Between gates 4 and 5 the build also verifies the strip itself. Three checks,
designed to fail loudly rather than ship a script that lost a line of code:

- every removed span really starts with `//` or `/*`, so a misdetected regex
  or string cannot silently delete code;
- the stripped file's non-whitespace characters appear **in order** in the
  unstripped one, so nothing was duplicated, reordered or rewritten;
- no comment survives outside the exempt regions listed below.

(Two string-strippers existing in `lib/strip.js` were tried as the reference
for this and are not usable: both lose their place on this codebase's nested
template literals, so their output is not a trustworthy baseline.)

---

## What the bundler does

Three deletions, an indent, and the comments:

- `import { ... } from "..."` lines are removed — after concatenation
  everything shares one function scope, so those bindings are already visible.
- a leading `export ` is removed from declarations.
- each module is indented two spaces and wrapped in the original
  `(() => { "use strict"; ... })()`.
- every comment is removed from the module bodies and collected in
  `dist/comments.md`.

The output stays readable and line-by-line diffable against the modules.
There's no minification and no source map, because a userscript ships as source
and users are entitled to read it.

### Comments -> dist/comments.md

`src/` remains fully commented; only the shipped file is comment-free (`npm run
build` regenerates both, so the two never drift). Each entry in
`comments.md` looks like:

```text
**[L1438](./osu-local-favorites.user.js#L1438)** · src L534

--- comment text, as a fenced js block ---
// Keeps a real media element alive for the lifetime of the page.
```

`L1438` is a link into the built userscript, pointing at the line the comment
documented (or the first code line after it, when the comment stood on its
own). `src L534` is the comment's line in the module it came from. A block of
consecutive `//` lines is one entry, not one per line.

Three things are deliberately **not** stripped, because they belong to the
bundle rather than to any module:

- the `==UserScript==` metadata block (`meta/userscript-header.txt`) — the
  script cannot install without it;
- the generated context table (the module list near the top of the file);
- the per-module section banners (`// ━━━━━━━━━━ src/ui/main-panel.js ━━━━━━━━━━`),
  which are what keep the stripped file navigable.

To decide what is a comment, `build/lib/comments.js` walks the source with a
small state machine rather than regexes: strings and template literals are
copied through untouched, `${...}` interpolations keep their code, and a `/`
is only treated as a regex literal when a closing slash exists on the same
line. For a comment-stripping pass, every uncertain case has to resolve to
"this is code".

## Ordering

`modules.json` fixes the concatenation order by hand rather than deriving it
from a topological sort, for two reasons:

1. The import graph has real cycles (`storage` <-> `collections`,
   `osu-api` <-> `gist-backup`, `main-panel` <-> `floating-heart`). A
   topological sort can't order a cyclic graph at all. The cycles are harmless
   because they're function-to-function and function declarations hoist.
2. `const`/`let` module state does **not** hoist, so order genuinely matters.
   The listed order is identical to the section order of the original
   single-file script, which is known-good.

Gate 5 is what actually protects this: if a reorder introduces a temporal dead
zone, evaluating the bundle throws and the build stops.

---

## Behavioural changes in the refactor

The split was mechanical — sections of the original file became modules with
their original code intact. A code-only diff (comments and string contents
normalised away) of old vs new bundle shows **only** these deliberate changes:

Four pieces of module-private state were being read or written from other
sections of the file. That's fine in one shared scope and impossible to
express cleanly across module boundaries, so each got an accessor:

| private state | added to | used by |
| --- | --- | --- |
| `_favsCache` | `invalidateFavoritesCache()` in `data/storage.js` | `core/init.js` cross-tab sync |
| `_colsCache` | `invalidateCollectionsCache()` in `data/collections.js` | `data/storage.js`, `core/init.js` |
| `_loggedInCache` / `_loggedInCacheKey` | `invalidateLoginCache()` in `data/mirrors.js` | `core/init.js` Turbolinks resync |
| `_reenrichRunning` | `isReenrichRunning()` in `data/reenrichment.js` | `data/enrichment.js`, `ui/settings.js` |

`STORAGE_KEY` also moved from the top of the IIFE into `data/storage.js`,
which is the module that owns it.

Everything else is byte-identical.

---

## Adding a module

1. Create the file under the right `src/` folder.
2. `export` what other modules need; `import` what you use.
3. Add it to `order` in `build/modules.json`, positioned so that anything it
   reads at load time comes earlier.
4. `npm run check`.


---

## Changelog: media session, cross-page sync, glow

### `ui/media-session.js` (new)

Everything that touches `navigator.mediaSession` moved out of
`ui/audio-player.js`, which is now only the `<audio>` element and the
in-page mini-player. Bugs fixed on the way:

- **`ReferenceError` in the preview-fallback path.** When a mirror source
  failed and the official preview was retried, the `.catch()` read a
  variable belonging to `showFavoritesPanel()` that was never in scope
  there. It threw on every fallback, surfacing only as an unhandled
  rejection, and the mini-player it was meant to keep visible stayed
  hidden. (This was already broken before the module split.)
- **Unhandled rejection on loop.** `audio.play()` in the loop branch had no
  `.catch()`. When autoplay was refused after a long lock-screen idle, the
  OS widget kept advertising "playing" for audio that had stopped.
- **Position state frozen on the previous track.** `setPositionState` was
  called with whatever `playbackRate` the element reported, including `0`
  in some paused/stalled states. The spec rejects `0`, the throw was
  swallowed, and the OS widget never updated again for the rest of the
  session. Now clamped to a positive rate.
- **Stale position after playback stopped.** Nothing ever reset the
  position state, so the widget kept showing the last track's elapsed time.
  `clearMediaSession()` now resets it.
- **Notification flicker on resume.** A fresh `MediaMetadata` was built on
  every `play` event, including resume-from-pause, which re-posts the
  Android notification. Metadata is now rebuilt only when the track
  actually changes.
- **Blank artwork tile.** A single artwork entry was supplied, often the
  900x250 banner, which some Android builds refuse to decode for a small
  notification icon. Several renditions are now offered with `sizes` hints
  so the OS can pick.
- **Dead skip buttons.** `previoustrack`/`nexttrack` were registered
  unconditionally at element creation, so Android drew enabled skip buttons
  even for a preview started from a card, where no queue exists. They are
  now registered only while `_queueAdvance` is bound.
- **Three competing `loadedmetadata` listeners** whose relative order was
  load-order-dependent, collapsed into one. The fallback decision now runs
  before the position is published, so the widget no longer briefly
  advertises the duration of a clip about to be discarded.
- **Two drifted copies of the teardown logic** (the `ended` handler and
  `resetPlaybackAfterError`) collapsed into `stopPlayback()`. Only one copy
  reset the card button's `_playing` flag, so a preview that failed
  outright left its button stuck showing pause; the other dereferenced
  `_activeBar.parentElement` unguarded, which throws if the row
  re-rendered while the clip was loading.
- `seekto` now honours `fastSeek` where available, and `stop` is handled.

### Cross-page heart sync

`refreshButtons()` marks a button `data-osu-fav-checked` and never revisits
it. Meanwhile each of the eight places that mutate favorites refreshed the
floating heart by hand and **none** refreshed the card buttons. So removing
a favorite in the panel left the page's own hearts filled, and a Turbolinks
snapshot restored that stale state right back.

Replaced with one notification path:

- `data/storage.js` gains `onFavoritesChanged(listener)`, fired from
  `setFavorites()` and `invalidateFavoritesCache()`. It compares a
  membership signature (id count + id sum) so background enrichment - which
  calls `setFavorites()` about once a second purely to attach metadata -
  does not trigger a repaint.
- `ui/floating-heart.js` gains `resyncFavoriteButtons()`, the single
  subscriber. Buttons now carry `data-osu-fav-id`, so the resync is an
  attribute read per already-drawn button rather than a re-scan.
- `invalidateButtonMarkers()` centralises marker clearing, and the SPA
  URL-polling path now calls it. Previously only the `turbolinks:load` path
  cleared markers, so a navigation that emitted no Turbolinks event left
  every previously-processed heart frozen.

**The open panel had the same problem, worse.** Its list is built by a
`renderList()` closure that nothing outside `showFavoritesPanel()` could
reach, so a map favorited on the page behind never appeared in an open
panel. `toggleFavorite()` "solved" this by removing the panel and calling
`showFavoritesPanel()` to rebuild it from scratch - which reset the search
box, sort order, genre filter, active collection and scroll position, and
tore down the Now Playing bar mid-preview, every time any heart was
clicked.

`renderList` is now published on the panel node and reachable through
`refreshFavoritesPanel()`, and the destroy-and-recreate is gone. Two
details make it safe:

- **Deferred.** The notification fires synchronously inside
  `setFavorites()`, which is usually called from a click handler on a row
  in that very list. Rebuilding right there detaches the node whose handler
  is still running. The refresh is queued to the next animation frame
  instead.
- **Self-cancelling.** `renderList()` bumps a counter; a queued refresh
  compares it and skips if the panel already re-rendered itself. So an
  in-panel action costs exactly one render, not two.

The notification carries `{ membershipChanged }`. `true` (add/remove)
repaints hearts and refreshes the panel immediately; `false` (enrichment
filling in title and artist for maps already favorited) leaves hearts
alone and debounces the panel refresh by 1.5s, so a bulk enrichment pass
doesn't rebuild the list once a second.

A mutation anywhere - panel, card click, Copy All, Gist restore, another
tab - now reaches every visible surface at once, with no reload.

### Floating heart glow

`indApplyVisual()` set `box-shadow: 0 2px 10px rgba(255,102,170,0.25)` when
favorited, which read as a halo around the button on beatmap pages. Removed;
the accent-coloured border remains as the favorited signal.

---

## Changelog: the Settings pane split out of the panel

`ui/favorites-panel.js` was the last module that had grown back into a second
script: 3,091 lines, of which the ⚙ Settings pane (its section builders, the
custom colour picker, and `renderSettingsView()`) was 1,373. It is now two
modules:

| file | lines | what it owns |
| --- | --- | --- |
| `ui/main-panel.js` | 1,715 | the panel itself - header, search, list, cards, mini-player, `refreshFavoritesPanel()` |
| `ui/settings.js` | 1,423 | the ⚙ pane - the section builders, the colour picker, and `renderSettingsView()` |

The move is mechanical. The helper block and `renderSettingsView()` are the
same code, dedented one level (they were nested inside `showFavoritesPanel()`,
now they are module-level), and the whole pane is wrapped in one exported
factory:

```js
const settings = createSettingsView({ makeBtn, formatDate, renderList,
                                      updateCollectionsBtn, updateFooterStatus, setView });
const { element: settingsView } = settings;  // the panel mounts this
settings.render();                            // the panel calls this from setView(true)
```

`deps` carries those six names because they are closures of one *panel
instance*, not module state. Everything else the pane needs - storage, Gist,
osu! API, enrichment, mirrors, media cache, theme - is imported at the top of
`settings.js`, exactly as before. Two signatures changed to keep the boundary
honest: `makeColorInput(root, initialHex, onChange)` receives the settings
container whose teardown event it listens for instead of closing over it, and
`setView(true)` now calls `settings.render()`.

`ui/settings.js` sits before `ui/main-panel.js` in `modules.json` only to keep
the concatenation order close to the original single-file section order; every
name involved is a function declaration, so neither position depends on the
other.

What the five gates do **not** cover: they evaluate the bundle but never
*render* the pane, so a statement swallowed by a comment - or a name that only
exists inside `showFavoritesPanel()` - fails at runtime, not at build time.
This split is the first one where that gap bit for real: the factory's
`return { element, render }` ended up glued to the end of a comment line, so
the stripper removed it, and the bundle still built cleanly through all five
gates - a broken Settings button that no check would have caught.
