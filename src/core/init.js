import { osuApiHandleOAuthCallback } from "../api/osu-api.js";
import { _GM_CROSS_TAB_CHANNEL, _GM_CROSS_TAB_SYNC_KEY } from "./gm-shim.js";
import { injectInterceptor } from "./interceptor.js";
import { COLLECTIONS_KEY, invalidateCollectionsCache } from "../data/collections.js";
import { addManyToEnrichQueue, ensureEnrichDrainerRunning, getEnrichQueue } from "../data/enrichment.js";
import { invalidateLoginCache } from "../data/mirrors.js";
import { STORAGE_KEY, getFavorites, invalidateFavoritesCache, onFavoritesChanged } from "../data/storage.js";
import { autoUpdateChecksEnabled, checkVersionUpdate, getCurrentVersion, isNewerVersion } from "../data/version-check.js";
import { setMediaSessionMetadata, setMediaSessionPlaybackState } from "../ui/media-session.js";
import { addFavoriteAllButtons } from "../ui/copy-all-button.js";
import { refreshFavoritesPanel, showFavoritesPanel } from "../ui/main-panel.js";
import {
  ensureHeartIndicator,
  invalidateButtonMarkers,
  refreshButtons,
  resyncFavoriteButtons,
  updateFloatingHeart,
} from "../ui/floating-heart.js";
import { enableGuestDownloads, injectMirrorButtons } from "../ui/guest-downloads.js";
import { addGuestFavoriteButton } from "../ui/guest-fallback.js";
import {
  THEME_ACCENT_KEY,
  THEME_ACTIVE_OPACITY_KEY,
  THEME_HEART_KEY,
  THEME_HOVER_DIM_KEY,
  THEME_IDLE_DIM_KEY,
  THEME_IDLE_OPACITY_KEY,
  applyTheme,
} from "../ui/theme.js";
import { showUpdatePrompt } from "../ui/update-prompt.js";

// ═══ Init ═══
function init() {
  applyTheme();

  // osu!'s own qtip tooltips/popups (difficulty hover cards, user cards,
  // achievement popups, etc.) sit at z-index ~512 on the live site - far
  // below the favorites panel's z-index (100000+). Whenever a tooltip
  // would land underneath the panel's screen area (fixed to the right
  // edge, full viewport height), it rendered completely invisible instead
  // of on top like it should. This is injected unconditionally at init,
  // not folded into the panel's own lazily-created stylesheet, so it's in
  // effect from the very first hover - not just after the panel has been
  // opened once.
  if (!document.getElementById("osu-fav-qtip-style")) {
    const qtipStyle = document.createElement("style");
    qtipStyle.id = "osu-fav-qtip-style";
    qtipStyle.textContent = ".qtip{z-index:100003!important}";
    document.head.appendChild(qtipStyle);
  }

  // Single place where a change to the favorites store becomes visible.
  // Everything that mutates favorites - the panel, a heart on a card, the
  // floating heart, Copy All, a Gist restore, another tab - routes through
  // here, so no mutation site has to remember to refresh the UI itself
  // (which is how the page's hearts and the open panel used to end up
  // needing a reload to catch up).
  //
  // Registered before anything can mutate the store.
  let metadataRefreshTimer = null;
  onFavoritesChanged((detail) => {
    if (detail && detail.membershipChanged === false) {
      // Enrichment filled in metadata for maps that are already favorited.
      // Hearts are unaffected. Coalesce these - a bulk pass fires roughly
      // once a second and rebuilding the list each time would make the
      // panel unusable while it runs.
      if (metadataRefreshTimer) return;
      metadataRefreshTimer = setTimeout(() => {
        metadataRefreshTimer = null;
        refreshFavoritesPanel();
      }, 1500);
      return;
    }
    resyncFavoriteButtons();
    refreshFavoritesPanel();
  });

  injectInterceptor();
  // OAuth callback must be handled as early as possible so the user never
  // sees a flash of the raw ?code=…&state=… query string on /home.
  osuApiHandleOAuthCallback();

  // One-time-per-favorite migration: back-fill the enrichment queue with
  // any favorite that has not completed metadata enrichment. Defer this potentially large
  // scan and persist it with one batched GM write after the page gets a
  // chance to render. The old per-favorite loop serialized and persisted
  // the entire queue once per item, making first load scale badly in
  // Tampermonkey, especially on Firefox Android.
  const migrateEnrichmentQueue = () => {
    try {
      const favs = getFavorites();
      const favsNeedingEnrichment = Object.keys(favs).filter((id) => !favs[id].metadata_enriched);
      addManyToEnrichQueue(favsNeedingEnrichment);
      if (getEnrichQueue().length) ensureEnrichDrainerRunning();
    } catch (e) { /* never break page load over this */ }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(migrateEnrichmentQueue, { timeout: 2500 });
  } else {
    setTimeout(migrateEnrichmentQueue, 1500);
  }

  // ═══ Cross-tab sync ═══
  // When another tab writes to the favorites key, refresh all UI in this tab.
  // GM_addValueChangeListener isn't implemented at all in some userscript
  // managers (a hard ReferenceError rather than a graceful no-op stub like
  // GM_getValue/GM_setValue get) - left unguarded, that throw would abort
  // every line below it in this function, including the MutationObserver
  // setup further down that keeps the page's hearts working after the
  // first render. Cross-tab sync is a nice-to-have; losing it silently is
  // far better than losing everything after it.
  if (typeof GM_addValueChangeListener === "function") {
    try {
      GM_addValueChangeListener(STORAGE_KEY, (_key, _oldVal, newVal, remote) => {
        if (!remote) return; // ignore writes from this same tab

        // Use the value delivered with the notification instead of asking
        // GM_getValue() immediately. Some managers notify sibling tabs before
        // their storage read API has caught up; rebuilding from that read
        // would leave page A showing page B's old list until another event.
        invalidateFavoritesCache(newVal);
        invalidateCollectionsCache();

        // Re-render floating heart (filled/outline SVG) for the current beatmap
        updateFloatingHeart();

        // Re-render the existing panel in place. Reopening it here would
        // create a new closure and can race with a chunked render already in
        // progress, leaving page A with the old list or a partial list.
        refreshFavoritesPanel(true);

        // Re-check all visible card hearts (clear the "already scanned" flag first)
        document.querySelectorAll("[data-osu-fav-checked]").forEach((btn) => {
          btn.removeAttribute("data-osu-fav-checked");
        });
        refreshButtons();
      });
    } catch (e) {
      console.warn("[osu-local-favorites] cross-tab sync unavailable:", e);
    }
  } else {
    console.warn(
      "[osu-local-favorites] GM_addValueChangeListener not supported by this userscript manager - cross-tab sync disabled",
    );
  }

  // Some userscript managers expose working GM_getValue/GM_setValue but
  // do not implement a reliable GM_addValueChangeListener. gm-shim now
  // broadcasts a tiny cross-tab signal through BroadcastChannel, with a
  // localStorage storage-event fallback. The receiver waits briefly before
  // reading native GM storage because some managers propagate the notification
  // slightly before the updated value is visible to another tab. A second
  // settle pass covers slower extension-storage implementations.
  let crossTabSyncTimer1 = null;
  let crossTabSyncTimer2 = null;
  function settleCrossTabSync(changedKey) {
    const apply = () => {
      if (changedKey === STORAGE_KEY) {
        // The signal only carries the key; wait for the manager's storage
        // read to settle before invalidating and rebuilding the panel.
        invalidateFavoritesCache();
        refreshFavoritesPanel(true);
        return;
      }
      if (changedKey === COLLECTIONS_KEY) {
        invalidateCollectionsCache();
        refreshFavoritesPanel(true);
      }
    };

    if (changedKey === STORAGE_KEY) {
      if (crossTabSyncTimer1) clearTimeout(crossTabSyncTimer1);
      if (crossTabSyncTimer2) clearTimeout(crossTabSyncTimer2);
      crossTabSyncTimer1 = setTimeout(() => {
        crossTabSyncTimer1 = null;
        apply();
        crossTabSyncTimer2 = setTimeout(() => {
          crossTabSyncTimer2 = null;
          apply();
        }, 350);
      }, 75);
      return;
    }

    apply();
  }

  function handleCrossTabSignal(changedKey) {
    if (changedKey !== STORAGE_KEY && changedKey !== COLLECTIONS_KEY) return;
    settleCrossTabSync(changedKey);
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== _GM_CROSS_TAB_SYNC_KEY || !e.newValue) return;
    const changedKey = String(e.newValue).split("|", 1)[0];
    handleCrossTabSignal(changedKey);
  });

  // BroadcastChannel is more reliable than storage events in extension
  // sandboxes and reaches sibling tabs/windows on the same origin directly.
  try {
    if (typeof BroadcastChannel === "function") {
      const crossTabChannel = new BroadcastChannel(_GM_CROSS_TAB_CHANNEL);
      if (typeof crossTabChannel.unref === "function") crossTabChannel.unref();
      crossTabChannel.addEventListener("message", (e) => {
        const changedKey = e && e.data ? String(e.data.key || "") : "";
        handleCrossTabSignal(changedKey);
      });
    }
  } catch (e) {
    // storage-event fallback above remains active.
  }

  // A tab can be backgrounded while another tab changes the store. On return,
  // do one cheap authoritative re-read so a throttled background context
  // cannot leave the open panel visually stale.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      invalidateFavoritesCache();
      invalidateCollectionsCache();
      refreshFavoritesPanel(true);
      updateFloatingHeart();
    }
  });

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
  if (typeof GM_addValueChangeListener === "function") {
    try {
      GM_addValueChangeListener(COLLECTIONS_KEY, (_key, _oldVal, _newVal, remote) => {
        if (!remote) return;
        invalidateCollectionsCache();
        refreshFavoritesPanel(true);
      });
    } catch (e) {
      console.warn("[osu-local-favorites] collections cross-tab sync unavailable:", e);
    }
  }

  // Same story for the Appearance settings (accent, heart color, cover-art
  // opacity/dim sliders): each lives under its own GM key and is applied by
  // calling applyTheme(), which every mutation site already calls in its
  // own tab. Nothing replayed that call in *other* open tabs, so changing
  // the accent color in one tab left every other open tab showing the old
  // colors until reload. applyTheme() just re-reads all six keys and
  // rewrites the CSS custom properties on <html>, so it's cheap and
  // idempotent to call from any of them changing remotely.
  if (typeof GM_addValueChangeListener === "function") {
    try {
      [
        THEME_ACCENT_KEY,
        THEME_HEART_KEY,
        THEME_IDLE_OPACITY_KEY,
        THEME_IDLE_DIM_KEY,
        THEME_HOVER_DIM_KEY,
        THEME_ACTIVE_OPACITY_KEY,
      ].forEach((key) => {
        GM_addValueChangeListener(key, (_key, _oldVal, _newVal, remote) => {
          if (remote) applyTheme();
        });
      });
    } catch (e) {
      console.warn("[osu-local-favorites] theme cross-tab sync unavailable:", e);
    }
  }

  ensureHeartIndicator();
  addFavoriteAllButtons();
  addGuestFavoriteButton();
  enableGuestDownloads();
  injectMirrorButtons();

  // Auto-check version updates only when the user has left the setting on.
  if (autoUpdateChecksEnabled()) {
    checkVersionUpdate().then((latestVersion) => {
      const currentVersion = getCurrentVersion();
      if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
        showUpdatePrompt(latestVersion);
      }
    });
  }

  // Debounced observer - runs at most once per 600ms to avoid freezing the page
  let timer = null;
  const debouncedRefresh = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      // Skip while the tab is in the background - a MutationObserver on
      // the whole document body fires on osu!'s own live-updating content
      // too (dashboard activity feed, notification counts, relative
      // timestamps, etc.), not just our own changes, so on a busy page
      // this can otherwise re-run every ~600ms indefinitely even while
      // nobody's looking at the tab. The visibilitychange listener below
      // catches up in one pass as soon as it's foregrounded again, so
      // nothing actually goes stale - this just stops paying for it while
      // backgrounded.
      if (document.hidden) return;
      refreshButtons();
      if (!document.getElementById("osu-local-fav-ind"))
        ensureHeartIndicator();
      addFavoriteAllButtons();
      addGuestFavoriteButton();
      updateFloatingHeart();
      enableGuestDownloads();
      injectMirrorButtons();
    }, 600);
  };

  let mainObserver = null;
  function attachMainObserver() {
    if (mainObserver) mainObserver.disconnect();
    if (!document.body) return;
    mainObserver = new MutationObserver(debouncedRefresh);
    mainObserver.observe(document.body, { childList: true, subtree: true });
  }
  attachMainObserver();

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
  let restorePanelAfterNavigation = false;

  function rememberPanelBeforeNavigation() {
    restorePanelAfterNavigation = !!document.getElementById("osu-local-fav-panel");
  }

  // Listen for the browser's native SPA navigation signal as well. The
  // history API itself does not emit popstate for pushState/replaceState,
  // which is why the URL poll remains as a final fallback.
  window.addEventListener("popstate", () => {
    rememberPanelBeforeNavigation();
    setTimeout(hardResync, 0);
  });

  function hardResync() {
    const panelWasOpen = restorePanelAfterNavigation || !!document.getElementById("osu-local-fav-panel");
    restorePanelAfterNavigation = false;

    // Keep a live panel node when osu! swaps content in place. If a
    // Turbolinks/Turbo snapshot cloned it, the clone has no render closure,
    // so discard that inert copy and recreate it below when it was open.
    const existingPanel = document.getElementById("osu-local-fav-panel");
    if (existingPanel && typeof existingPanel._osuFavRefresh !== "function") {
      existingPanel.remove();
    }

    ["osu-local-fav-ind", "osu-local-guest-fav-btn", "osu-fav-mirror-row", "osu-fav-dl-menu"]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    document.querySelectorAll(".osu-fav-all-btn").forEach((el) => el.remove());
    invalidateButtonMarkers();
    // Beatmap context (isLoggedIn's cached user blob, mirror row state)
    // is per-page - a Turbolinks navigation may land on a different page
    // as a different (or no) user, so stale caches must not survive it.
    invalidateLoginCache();
    attachMainObserver();
    ensureHeartIndicator();
    addFavoriteAllButtons();
    addGuestFavoriteButton();
    updateFloatingHeart();
    enableGuestDownloads();
    injectMirrorButtons();
    if (panelWasOpen && !document.getElementById("osu-local-fav-panel")) {
      showFavoritesPanel();
    }
    refreshFavoritesPanel(true);
    refreshButtons();
  }

  // Remember whether the panel should be restored if navigation replaces the
  // document with a cached snapshot. The panel itself is intentionally not
  // removed during an in-place navigation, so its search/sort/filter state
  // survives page changes.
  document.addEventListener("turbolinks:before-cache", rememberPanelBeforeNavigation);
  document.addEventListener("turbo:before-cache", rememberPanelBeforeNavigation);

  // Turbolinks (classic) fires "turbolinks:load"; Hotwire Turbo renamed it
  // to "turbo:load" - listen for both since we can't be sure which is live.
  document.addEventListener("turbolinks:load", hardResync);
  document.addEventListener("turbo:load", hardResync);
  // Fallback for a genuine browser back/forward-cache restore, in case any
  // navigation path bypasses Turbolinks entirely.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) hardResync();
  });

  // Polling for SPA navigation (low overhead). Some osu! routes do not emit
  // either navigation event, and replacing <body> removes the panel before
  // the next observer can run. Remember its open state between URL checks so
  // the panel is recreated on the new page instead of silently disappearing.
  let lastUrl = location.href;
  let panelWasOpenAtLastUrl = !!document.getElementById("osu-local-fav-panel");
  setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      const panelShouldRemainOpen = panelWasOpenAtLastUrl || restorePanelAfterNavigation;
      restorePanelAfterNavigation = false;
      // The page content changed without a Turbolinks event. Markers left
      // on nodes that survived the swap would make refreshButtons() skip
      // them forever, so drop them and let the refresh below redraw from
      // scratch.
      invalidateButtonMarkers();
      ensureHeartIndicator();
      addGuestFavoriteButton();
      enableGuestDownloads();
      injectMirrorButtons();
      if (panelShouldRemainOpen && !document.getElementById("osu-local-fav-panel")) {
        showFavoritesPanel();
      }
      refreshFavoritesPanel(true);
      debouncedRefresh();
    }
    panelWasOpenAtLastUrl = !!document.getElementById("osu-local-fav-panel");
  }, 800);

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
  setInterval(() => {
    if (document.hidden) return;
    refreshButtons();
    addFavoriteAllButtons();
    addGuestFavoriteButton();
    enableGuestDownloads();
    injectMirrorButtons();
    if (!document.getElementById("osu-local-fav-ind")) ensureHeartIndicator();
  }, 1500);

  // Firefox Android may hand a media session to Android right as its tab is
  // backgrounded. Re-publish an active preview at that boundary: this keeps
  // the OS-owned session authoritative while osu!'s page is hidden and its
  // regular page timers are throttled. Do not call play() here - playback
  // was already user-initiated, and calling it again from this lifecycle
  // event would violate Android's autoplay policy.
  document.addEventListener("visibilitychange", () => {
    const audio = window._osuFavAudio;
    if (audio && !audio.paused && !audio.ended && audio._npCurrentId) {
      setMediaSessionMetadata(audio);
      setMediaSessionPlaybackState("playing");
      if (typeof audio._updateMediaSessionPositionState === "function") {
        audio._updateMediaSessionPositionState();
      }
    }

    // Catch up in one pass after returning to the tab, so pausing the scans
    // above while hidden never leaves the page UI stale.
    if (document.hidden) return;
    refreshButtons();
    addFavoriteAllButtons();
    addGuestFavoriteButton();
    updateFloatingHeart();
    enableGuestDownloads();
    injectMirrorButtons();
    if (!document.getElementById("osu-local-fav-ind")) ensureHeartIndicator();
  });

  // Initial refresh after page settles
  setTimeout(refreshButtons, 800);
  setTimeout(refreshButtons, 2000);
  setTimeout(addGuestFavoriteButton, 1200);
  setTimeout(addGuestFavoriteButton, 2500);
  setTimeout(enableGuestDownloads, 1000);
  setTimeout(enableGuestDownloads, 2200);
  setTimeout(injectMirrorButtons, 1000);
  setTimeout(injectMirrorButtons, 2200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
