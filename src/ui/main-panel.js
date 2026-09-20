import { GH_AUTO_BACKUP_KEY, GH_LAST_SYNC_KEY, GH_TOKEN_KEY } from "../api/gist-backup.js";
import { scheduleAutoBackup } from "../api/osu-api.js";
import { fetchHinaiSong, hinaiDurationSec, previewSourceUrl, storeHinaiSongMetadata } from "../api/previews.js";
import { GM_getValue, GM_setValue } from "../core/gm-shim.js";
import { collectionsContainingMap, getCollections } from "../data/collections.js";
import { _blobUrlCache, cacheDurationMode, getKnownCachedBlob, hasFreshCachedCopy, lookupCachedBlob, prewarmCachedPreview, resolveCachedMediaUrl, startStreamingCacheWrite } from "../data/media-cache-db.js";
import { resolveDefaultMirror } from "../data/mirrors.js";
import { MUSIC_LOOP_KEY, MUSIC_SHUFFLE_KEY, musicLoopEnabled, musicShuffleEnabled } from "../data/playback-settings.js";
import { getFavorites, setFavorites } from "../data/storage.js";
import { autoUpdateChecksEnabled, checkVersionUpdate, getCurrentVersion, isNewerVersion } from "../data/version-check.js";
import { ensureAudio } from "./audio-player.js";
import { clearMediaSession, setMediaSessionMetadata } from "./media-session.js";
import { showAddToCollectionMenu, showCollectionsMenu } from "./collections-menu.js";
import { buildDownloadOptions, showDownloadMenu } from "./download-menu.js";
import { clearFavoritesPanelAudio, updateFloatingHeart } from "./floating-heart.js";
import { closeFilterMenu, showFilterMenu } from "./filter-menu.js";
import { FILTER_CATEGORIES, buildFilterPlan, collectSectionsFor, countActiveFilterTerms, favMatchesPlan, makeEmptyFilterState } from "./filters.js";
import { loopSVG, nextSVG, pauseSVG, playSVG, prevSVG, shuffleSVG } from "./theme.js";
import { createSettingsView } from "./settings.js";

// ═══ Favorites panel ═══
export function showFavoritesPanel() {
  const existing = document.getElementById("osu-local-fav-panel");
  if (existing) {
    // The audio element is page-lifetime, while the player UI belongs to the
    // panel. Detach only the old UI binding; never stop the preview when closing.
    closeFilterMenu();
    clearFavoritesPanelAudio();
    existing.remove();
    return;
  }

  let currentSort = "date",
    sortAsc = false,
    searchQuery = "",
    settingsOpen = false,
    // { [categoryId]: { [termKey]: "include" | "exclude" } } - one entry per
    // category in ui/filters.js (date, title, artist, status, genre).
    filterState = makeEmptyFilterState(),
    activeCollectionId = ""; // "" = no collection filter (show all)

  // Inject shared styles once - covers scrollbar, slide-down banner, and slide-up prompt
  if (!document.getElementById("osu-fav-panel-style")) {
    const s = document.createElement("style");
    s.id = "osu-fav-panel-style";
    s.textContent =
      "#osu-fav-list::-webkit-scrollbar{width:4px}" +
      "#osu-fav-list::-webkit-scrollbar-thumb{background:#333;border-radius:2px}" +
      "#osu-fav-list::-webkit-scrollbar-thumb:hover{background:var(--osu-fav-accent)}" +
      "#osu-fav-settings::-webkit-scrollbar{width:4px}" +
      "#osu-fav-settings::-webkit-scrollbar-thumb{background:#333;border-radius:2px}" +
      "#osu-fav-settings::-webkit-scrollbar-thumb:hover{background:var(--osu-fav-accent)}" +
      "@keyframes osuFavSlideDown{from{max-height:0;opacity:0;overflow:hidden}to{max-height:50px;opacity:1}}" +
      "@keyframes osuFavSlideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}" +
      "#osu-fav-nowplaying{height:74px!important;min-height:74px!important;max-height:74px!important;flex:0 0 74px!important;padding:8px 12px!important;gap:10px!important;}" +
      "#osu-fav-nowplaying .osu-fav-np-thumb{width:54px!important;height:54px!important;}" +
      "#osu-fav-nowplaying .osu-fav-np-title{font-size:13px!important;line-height:1.3!important;}" +
      "#osu-fav-nowplaying .osu-fav-np-artist{font-size:11px!important;line-height:1.25!important;margin-top:3px!important;}" +
      "#osu-fav-nowplaying .osu-fav-np-controls{gap:5px!important;}" +
      "#osu-fav-nowplaying .osu-fav-np-btn{width:38px!important;height:38px!important;padding:7px!important;}" +
      "#osu-fav-footer-status{height:29px!important;min-height:29px!important;max-height:29px!important;padding:6px 14px!important;line-height:15px!important;}" +
      "#osu-fav-bottom-bar{height:auto!important;min-height:0!important;max-height:none!important;padding-bottom:0!important;}" +
      "@media(max-width:600px){#osu-local-fav-panel>div:first-child{min-height:0!important;max-height:100px!important;box-sizing:border-box!important;overflow:hidden!important;}#osu-local-fav-panel button[title=Settings],#osu-local-fav-panel button[title=Close]{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important;padding:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;}#osu-local-fav-panel input[type=text]{height:40px!important;min-height:40px!important;max-height:40px!important;box-sizing:border-box!important;}#osu-fav-nowplaying{height:76px!important;min-height:76px!important;max-height:76px!important;flex:0 0 76px!important;padding:8px 10px!important;gap:8px!important;padding-bottom:8px!important;}#osu-fav-nowplaying .osu-fav-np-thumb{width:50px!important;height:50px!important;}#osu-fav-nowplaying .osu-fav-np-controls{gap:3px!important;}#osu-fav-nowplaying .osu-fav-np-btn{width:34px!important;height:34px!important;padding:6px!important;}#osu-fav-nowplaying .osu-fav-np-title{font-size:12px!important;}#osu-fav-nowplaying .osu-fav-np-artist{font-size:10px!important;}#osu-fav-nowplaying .osu-fav-np-info{min-width:72px!important;}#osu-fav-footer-status{height:28px!important;min-height:28px!important;max-height:28px!important;padding:6px 10px!important;line-height:14px!important;}}";
    document.head.appendChild(s);
  }

  const panel = document.createElement("div");
  panel.id = "osu-local-fav-panel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "0",
    right: "0",
    zIndex: "100000",
    width: "min(360px, 100vw)",
    height: "100vh",
    maxHeight: "100dvh",
    background: "#111",
    color: "#ddd",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "13px",
    borderLeft: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "-2px 0 16px rgba(0,0,0,.5)",
  });

  // Shows an overlay popup centered inside the panel
  function showPanelUpdateOverlay(latestVersion) {
    if (document.getElementById("osu-fav-update-overlay")) return;
    const dismissed = GM_getValue("osu_dismissed_version", "");
    if (dismissed === latestVersion) return;

    // Backdrop - covers the panel content but not the header
    const backdrop = document.createElement("div");
    backdrop.id = "osu-fav-update-overlay";
    backdrop.style.cssText =
      "position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.55);" +
      "display:flex;align-items:center;justify-content:center;padding:20px";

    // Card
    const card = document.createElement("div");
    card.style.cssText =
      "width:100%;max-width:280px;background:#111;border:1px solid #333;" +
      "border-radius:4px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.7);" +
      "animation:osuFavSlideUp 0.2s ease-out";

    // Accent header
    const accent = document.createElement("div");
    accent.style.cssText =
      "background:var(--osu-fav-accent);padding:10px 14px;display:flex;align-items:center;" +
      "justify-content:space-between;gap:8px";

    const accentTitle = document.createElement("span");
    accentTitle.style.cssText = "font-size:12px;font-weight:700;color:#fff";
    accentTitle.innerHTML = `Update available - <b>v${latestVersion}</b>`;

    const accentClose = document.createElement("button");
    accentClose.textContent = "✕";
    accentClose.style.cssText =
      "background:none;border:none;color:#fff;cursor:pointer;font-size:13px;" +
      "font-weight:bold;padding:0 2px;opacity:0.8;flex-shrink:0";
    accentClose.addEventListener("mouseenter", () => (accentClose.style.opacity = "1"));
    accentClose.addEventListener("mouseleave", () => (accentClose.style.opacity = "0.8"));
    accentClose.addEventListener("click", () => {
      backdrop.remove();
      GM_setValue("osu_dismissed_version", latestVersion);
    });

    accent.append(accentTitle, accentClose);

    // Body
    const body = document.createElement("div");
    body.style.cssText = "padding:14px;font-size:12px;color:#bbb;line-height:1.5";
    body.innerHTML =
      `<b style="color:#ddd">osu! Local Favorites</b> has a new version ready.<br>` +
      `Install it to get the latest fixes and features.`;

    // Footer
    const foot = document.createElement("div");
    foot.style.cssText =
      "display:flex;justify-content:flex-end;gap:6px;padding:10px 14px;" +
      "border-top:1px solid #222;background:#1a1a1a";

    const laterBtn = document.createElement("button");
    laterBtn.textContent = "Later";
    laterBtn.style.cssText =
      "font-size:10px;padding:4px 10px;border:1px solid #333;border-radius:3px;" +
      "background:transparent;color:#888;cursor:pointer;font-weight:500";
    laterBtn.addEventListener("mouseenter", () => { laterBtn.style.borderColor = "var(--osu-fav-accent)"; laterBtn.style.color = "var(--osu-fav-accent)"; });
    laterBtn.addEventListener("mouseleave", () => { laterBtn.style.borderColor = "#333"; laterBtn.style.color = "#888"; });
    laterBtn.addEventListener("click", () => {
      backdrop.remove();
      GM_setValue("osu_dismissed_version", latestVersion);
    });

    const updateBtn = document.createElement("button");
    updateBtn.textContent = "Update Now";
    updateBtn.style.cssText =
      "font-size:10px;padding:4px 10px;border:none;border-radius:3px;" +
      "background:var(--osu-fav-accent);color:#fff;cursor:pointer;font-weight:600";
    updateBtn.addEventListener("mouseenter", () => (updateBtn.style.background = "var(--osu-fav-accent-dark)"));
    updateBtn.addEventListener("mouseleave", () => (updateBtn.style.background = "var(--osu-fav-accent)"));
    updateBtn.addEventListener("click", () => {
      window.open(
        "https://github.com/starhollow2008/LOF/raw/refs/heads/main/dist/osu-local-favorites.user.js",
        "_blank",
      );
      backdrop.remove();
    });

    foot.append(laterBtn, updateBtn);
    card.append(accent, body, foot);
    backdrop.appendChild(card);
    panel.appendChild(backdrop);
  }

  // ── Header ─────────────────────────────────────────────
  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "10px 14px 8px",
    background: "#1a1a1a",
    borderBottom: "2px solid var(--osu-fav-accent)",
    flex: "0 0 auto",
    minHeight: "0",
    maxHeight: "110px",
    boxSizing: "border-box",
    overflow: "hidden",
    transition: "height 160ms ease, padding 160ms ease",
  });

  const headerTop = document.createElement("div");
  headerTop.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:8px;height:34px;min-height:34px;box-sizing:border-box";

  const logoImg = document.createElement("img");
  logoImg.src = "https://raw.githubusercontent.com/starhollow2008/LOF/main/icons/icon48.png";
  logoImg.style.cssText = "width:28px;height:28px;border-radius:50%;flex-shrink:0";
  logoImg.addEventListener("error", () => logoImg.style.display = "none");

  const titleEl = document.createElement("span");
  titleEl.style.cssText = "font-weight:600;font-size:14px;flex:1";
  const countBadge = document.createElement("span");
  countBadge.id = "osu-fav-count";
  countBadge.style.cssText =
    "color:var(--osu-fav-accent);background:rgba(255,102,170,.12);padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px";
  titleEl.append("Local Favorites", countBadge);

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙";
  settingsBtn.title = "Settings";
  settingsBtn.setAttribute("aria-label", "Settings");
  settingsBtn.style.cssText =
    "background:none;border:1px solid #333;color:#999;cursor:pointer;width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;padding:0;border-radius:3px;font-size:13px;flex:0 0 34px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:1";
  settingsBtn.addEventListener("mouseenter", () => {
    if (!settingsOpen) {
      settingsBtn.style.borderColor = "var(--osu-fav-accent)";
      settingsBtn.style.color = "var(--osu-fav-accent)";
    }
  });
  settingsBtn.addEventListener("mouseleave", () => {
    if (!settingsOpen) {
      settingsBtn.style.borderColor = "#333";
      settingsBtn.style.color = "#999";
    }
  });
  settingsBtn.addEventListener("click", () => setView(!settingsOpen));

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.style.cssText =
    "background:none;border:1px solid #333;color:#999;cursor:pointer;width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;padding:0;border-radius:3px;font-size:13px;line-height:1;flex:0 0 34px;box-sizing:border-box;display:flex;align-items:center;justify-content:center";
  closeBtn.addEventListener("click", () => {
    closeFilterMenu();
    clearFavoritesPanelAudio();
    panel.remove();
  });

  headerTop.append(logoImg, titleEl, settingsBtn, closeBtn);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search title, artist, mapper...";
  searchInput.style.cssText =
    "width:100%;height:40px;min-height:40px;max-height:40px;box-sizing:border-box;padding:6px 10px;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;font-size:12px;outline:none;display:block";
  searchInput.addEventListener(
    "focus",
    () => (searchInput.style.borderColor = "var(--osu-fav-accent)"),
  );
  searchInput.addEventListener(
    "blur",
    () => (searchInput.style.borderColor = "#333"),
  );
  // Debounced search: renderList() re-filters, re-sorts, and rebuilds the
  // whole visible list from scratch (chunked over rAF, but still). On a
  // 500+ map library every keystroke used to pay that full price - typing
  // a 10-character query ran it 10 times in quick succession. A 150ms
  // debounce keeps the live-filter feel while collapsing a typing burst
  // into one render.
  let searchRenderTimer = null;
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    if (searchRenderTimer) clearTimeout(searchRenderTimer);
    searchRenderTimer = setTimeout(() => {
      searchRenderTimer = null;
      renderList();
    }, 150);
  });

  header.appendChild(headerTop);
  header.appendChild(searchInput);

  // ── GitHub star notice (shown once, ever, on first panel open) ──
  let githubBanner = null;
  if (!GM_getValue("osu_fav_github_star_shown", false)) {
    GM_setValue("osu_fav_github_star_shown", true);

    githubBanner = document.createElement("div");
    githubBanner.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(255,102,170,.1);" +
      "border-bottom:1px solid var(--osu-fav-accent);flex-shrink:0;animation:osuFavSlideDown 0.3s ease-out";

    const starIcon = document.createElement("span");
    starIcon.textContent = "\u2b50";
    starIcon.style.cssText = "font-size:13px;flex-shrink:0";

    const starLink = document.createElement("a");
    starLink.href = "https://github.com/starhollow2008/LOF";
    starLink.target = "_blank";
    starLink.rel = "noopener";
    starLink.textContent = "Enjoying Local Favorites? Star it on GitHub";
    starLink.style.cssText =
      "flex:1;color:#ddd;text-decoration:none;font-size:11px;line-height:1.4";
    starLink.addEventListener("mouseenter", () => (starLink.style.color = "var(--osu-fav-accent)"));
    starLink.addEventListener("mouseleave", () => (starLink.style.color = "#ddd"));

    const dismissBtn = document.createElement("button");
    dismissBtn.textContent = "\u2715";
    dismissBtn.title = "Dismiss";
    dismissBtn.style.cssText =
      "background:none;border:none;color:#888;cursor:pointer;font-size:12px;padding:2px 4px;flex-shrink:0;line-height:1";
    dismissBtn.addEventListener("mouseenter", () => (dismissBtn.style.color = "var(--osu-fav-accent)"));
    dismissBtn.addEventListener("mouseleave", () => (dismissBtn.style.color = "#888"));
    dismissBtn.addEventListener("click", () => githubBanner.remove());

    githubBanner.append(starIcon, starLink, dismissBtn);
  }

  // ── Toolbar ────────────────────────────────────────────
  // One grid of six chips - Date | Title | Artist / Status | Genre |
  // Collections - each doing both jobs a separate sort row used to split
  // across two rows: opening a chip's popover offers that category's own
  // sort choice (Newest/Oldest for Date, A-Z/Z-A for Title/Artist/Genre) at
  // the top, above its filter terms. Status has no natural order, so its
  // popover is filter-only. Grid columns are sized from the track, not the
  // content, so a chip growing from "Genre" to "Genre (1)" can never reflow
  // its neighbours; labels ellipsis inside their own cell instead.
  const toolbar = document.createElement("div");
  toolbar.id = "osu-fav-toolbar";
  toolbar.style.cssText =
    "display:flex;flex-direction:column;gap:5px;padding:6px 14px;background:#1a1a1a;" +
    "border-bottom:1px solid #333;flex-shrink:0";

  const filterRow = document.createElement("div");
  filterRow.style.cssText =
    "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;align-items:stretch";

  const CHIP_BASE =
    "font-size:10px;font-weight:500;padding:4px 6px;border:1px solid transparent;border-radius:3px;" +
    "background:transparent;cursor:pointer;user-select:none;color:#666;white-space:nowrap;" +
    "overflow:hidden;text-overflow:ellipsis;text-align:center;box-sizing:border-box;min-width:0;width:100%";

  // Every category is driven by the same descriptor list, so adding one is
  // an entry in ui/filters.js rather than another hand-built button here.
  const filterBtns = {};
  FILTER_CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = cat.title;
    btn.style.cssText = CHIP_BASE + ";border-color:#333;color:#999";
    btn.addEventListener("click", () => {
      showFilterMenu(
        btn,
        {
          collect: () => collectSectionsFor(cat),
          searchable: cat.searchable,
          placeholder: cat.placeholder,
          emptyText: cat.emptyText,
          sortOptions: cat.sortOptions,
          isSortActive: !!cat.sortField && currentSort === cat.sortField,
          sortAsc,
          onSortSelect: cat.sortField
            ? (asc) => {
                currentSort = cat.sortField;
                sortAsc = asc;
                updateFilterBtns();
                renderList();
              }
            : undefined,
        },
        filterState[cat.id],
        (newState) => {
          filterState[cat.id] = newState;
          updateFilterBtn(cat.id);
          updateClearAllRow();
          renderList();
        },
      );
    });
    filterRow.appendChild(btn);
    filterBtns[cat.id] = btn;
  });

  function updateFilterBtn(id) {
    const cat = FILTER_CATEGORIES.find((c) => c.id === id);
    const btn = filterBtns[id];
    if (!cat || !btn) return;
    const active = countActiveFilterTerms(filterState, id);
    const isSort = !!cat.sortField && currentSort === cat.sortField;
    const sortArrow = isSort ? (sortAsc ? " \u2191" : " \u2193") : "";
    btn.textContent = cat.label + sortArrow + (active ? ` (${active})` : "") + " \u25be";
    if (active) {
      // Actively filtered wins the solid fill - it is the stronger claim on
      // the list's contents. A category that's merely the current sort
      // order, with no terms applied, gets the quieter outline instead so
      // the two states stay visually distinct at a glance.
      btn.style.background = "var(--osu-fav-accent)";
      btn.style.color = "#fff";
      btn.style.borderColor = "var(--osu-fav-accent)";
    } else if (isSort) {
      btn.style.background = "transparent";
      btn.style.color = "var(--osu-fav-accent)";
      btn.style.borderColor = "var(--osu-fav-accent)";
    } else {
      btn.style.background = "transparent";
      btn.style.color = "#999";
      btn.style.borderColor = "#333";
    }
  }
  function updateFilterBtns() {
    FILTER_CATEGORIES.forEach((c) => updateFilterBtn(c.id));
  }
  updateFilterBtns();

  function makeBtn(label, extraStyle = "") {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `font-size:10px;padding:3px 7px;border:1px solid #333;border-radius:3px;background:transparent;color:#999;cursor:pointer;${extraStyle}`;
    btn.addEventListener("mouseenter", () => {
      btn.style.borderColor = "var(--osu-fav-accent)";
      btn.style.color = "var(--osu-fav-accent)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.borderColor = "#333";
      btn.style.color = "#999";
    });
    return btn;
  }

  // Collections is a filter too, so it shares the filter row's last cell -
  // but it keeps its own popover, which also creates and deletes playlists.
  const collectionsBtn = document.createElement("button");
  collectionsBtn.type = "button";
  collectionsBtn.title = "Filter by collection";
  collectionsBtn.style.cssText = CHIP_BASE + ";border-color:#333;color:#999";
  function updateCollectionsBtn() {
    if (!activeCollectionId) {
      collectionsBtn.textContent = "\ud83d\udcc1 All \u25be";
      collectionsBtn.style.background = "transparent";
      collectionsBtn.style.color = "#999";
      collectionsBtn.style.borderColor = "#333";
      return;
    }
    const col = getCollections()[activeCollectionId];
    if (!col) {
      activeCollectionId = "";
      updateCollectionsBtn();
      return;
    }
    collectionsBtn.textContent = `\ud83d\udcc1 ${col.name} \u25be`;
    collectionsBtn.style.background = "var(--osu-fav-accent)";
    collectionsBtn.style.color = "#fff";
    collectionsBtn.style.borderColor = "var(--osu-fav-accent)";
  }
  updateCollectionsBtn();
  collectionsBtn.addEventListener("click", () => {
    showCollectionsMenu(collectionsBtn, activeCollectionId, (newId) => {
      activeCollectionId = newId;
      updateCollectionsBtn();
      updateClearAllRow();
      renderList();
    });
  });
  filterRow.appendChild(collectionsBtn);

  // "Clear all" appears only while something is filtered, and occupies the
  // full width below the grid so its arrival cannot shift the rows above it.
  const clearAllRow = document.createElement("div");
  clearAllRow.style.cssText = "display:none";
  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.textContent = "Clear all filters";
  clearAllBtn.style.cssText =
    "width:100%;box-sizing:border-box;font-size:10px;padding:3px 6px;border:1px solid #333;" +
    "border-radius:3px;background:transparent;color:#888;cursor:pointer";
  clearAllBtn.addEventListener("mouseenter", () => (clearAllBtn.style.color = "var(--osu-fav-accent)"));
  clearAllBtn.addEventListener("mouseleave", () => (clearAllBtn.style.color = "#888"));
  clearAllBtn.addEventListener("click", () => {
    closeFilterMenu();
    filterState = makeEmptyFilterState();
    activeCollectionId = "";
    updateFilterBtns();
    updateCollectionsBtn();
    updateClearAllRow();
    renderList();
  });
  clearAllRow.appendChild(clearAllBtn);

  function updateClearAllRow() {
    const any = countActiveFilterTerms(filterState) > 0 || !!activeCollectionId;
    clearAllRow.style.display = any ? "block" : "none";
  }
  updateClearAllRow();

  toolbar.append(filterRow, clearAllRow);

  // ── Content area (favorites list + settings view share this space) ──
  const contentArea = document.createElement("div");
  contentArea.style.cssText =
    "flex:1 1 0%;min-height:0;display:flex;flex-direction:column;overflow:hidden;position:relative";

  // ── List ───────────────────────────────────────────────
  const listEl = document.createElement("div");
  listEl.id = "osu-fav-list";
  Object.assign(listEl.style, {
    flex: "1 1 0%",
    minHeight: "0",
    overflowY: "auto",
    padding: "4px 0 58px",
    boxSizing: "border-box",
  });

  // ── Settings view (hidden until the gear button is clicked) ──
  // The pane itself is built by ui/settings.js; this file only decides where
  // it sits (inside the scrolling content area, as a sibling of the list) and
  // when it is visible. The deps object is that view's whole interface back
  // into the panel instance: each name is a function declaration in this
  // scope, so they are already defined by the time anything calls them.
  const settings = createSettingsView({
    makeBtn,
    formatDate,
    renderList,
    updateCollectionsBtn,
    updateFooterStatus,
    setView,
  });
  const { element: settingsView } = settings;

  contentArea.append(listEl, settingsView);

  // ── Footer - sync status bar, doubles as a shortcut into Settings ──
  const footer = document.createElement("div");
  footer.id = "osu-fav-footer-status";
  footer.style.cssText =
    "width:100%;height:29px;min-height:29px;max-height:29px;box-sizing:border-box;padding:6px 14px;border-top:1px solid #333;background:#1a1a1a;font-size:10px;line-height:15px;color:#555;text-align:center;cursor:pointer;user-select:none;overflow:hidden";
  footer.addEventListener("click", () => setView(true));
  footer.addEventListener("mouseenter", () => (footer.style.color = "var(--osu-fav-accent)"));
  footer.addEventListener("mouseleave", () => (footer.style.color = "#555"));

  function updateFooterStatus() {
    const token = GM_getValue(GH_TOKEN_KEY, "");
    const auto = GM_getValue(GH_AUTO_BACKUP_KEY, false);
    const lastSync = GM_getValue(GH_LAST_SYNC_KEY, 0);
    if (!token) {
      footer.textContent = "⚙ Set up Gist backup in Settings";
    } else if (auto) {
      footer.textContent = lastSync
        ? "Auto-backup on · synced " + formatDate(new Date(lastSync).toISOString())
        : "Auto-backup on · not yet synced";
    } else {
      footer.textContent = lastSync
        ? "Manual backup · synced " + formatDate(new Date(lastSync).toISOString())
        : "Manual backup · not yet synced";
    }
  }
  footer._refresh = updateFooterStatus;

  // ── Now Playing bar - persistent mini-player ─────────────────
  // This intentionally lives as a direct child of the fixed panel rather
  // than inside the scrolling content area. It therefore never moves with
  // the favorites/settings scroll position.
  const nowPlayingBar = document.createElement("div");
  nowPlayingBar.id = "osu-fav-nowplaying";
  nowPlayingBar.style.cssText =
    "display:none;position:relative;align-items:center;gap:9px;padding:7px 14px;" +
    "height:74px;min-height:74px;max-height:74px;box-sizing:border-box;border-top:1px solid #333;" +
    "border-bottom:1px solid #222;background:#1a1a1a;flex:0 0 74px;overflow:hidden;" +
    "box-shadow:0 -3px 12px rgba(0,0,0,.35);margin-top:0;padding-bottom:7px";

  // Album-art backdrop - subtle and blurred, so the bar visually inherits
  // the same artwork as the track without making the controls unreadable.
  const npBg = document.createElement("div");
  npBg.style.cssText =
    "position:absolute;inset:-14px;background-position:center;background-size:cover;" +
    "background-repeat:no-repeat;filter:blur(12px);transform:scale(1.08);opacity:.24;" +
    "pointer-events:none";

  const npBgShade = document.createElement("div");
  npBgShade.style.cssText =
    "position:absolute;inset:0;background:rgba(17,17,17,.64);pointer-events:none;z-index:1";

  // Track thumbnail - this is deliberately a normal img rather than a
  // background-only image, so the current cover remains identifiable.
  const npThumb = document.createElement("img");
  npThumb.alt = "";
  npThumb.className = "osu-fav-np-thumb";
  npThumb.style.cssText =
    "position:relative;z-index:2;width:42px;height:42px;border-radius:3px;object-fit:cover;" +
    "background:#111;display:block;flex-shrink:0;border:1px solid rgba(255,255,255,.08)";
  npThumb.addEventListener("error", () => {
    npThumb.removeAttribute("src");
    npThumb.style.visibility = "hidden";
  });

  const npInfo = document.createElement("div");
  npInfo.className = "osu-fav-np-info";
  npInfo.style.cssText = "position:relative;z-index:2;flex:1;min-width:0;overflow:hidden";
  const npTitle = document.createElement("div");
  npTitle.className = "osu-fav-np-title";
  npTitle.style.cssText =
    "font-size:12px;color:#eee;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35";
  const npArtist = document.createElement("div");
  npArtist.className = "osu-fav-np-artist";
  npArtist.style.cssText =
    "font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;line-height:1.25";
  npInfo.append(npTitle, npArtist);

  const npProgressWrap = document.createElement("div");
  npProgressWrap.style.cssText =
    "position:absolute;left:0;right:0;bottom:0;height:2px;background:#111;overflow:hidden;z-index:4";
  const npProgressBar = document.createElement("div");
  npProgressBar.style.cssText =
    "height:100%;width:0%;background:var(--osu-fav-accent);transition:width .05s linear";
  npProgressWrap.appendChild(npProgressBar);

  const npControls = document.createElement("div");
  npControls.className = "osu-fav-np-controls";
  npControls.style.cssText =
    "position:relative;z-index:2;display:flex;align-items:center;gap:4px;flex-shrink:0";

  function npIconBtn(svgFn, title) {
    const b = document.createElement("button");
    b.className = "osu-fav-np-btn";
    b.type = "button";
    b.title = title;
    b.innerHTML = svgFn();
    b.style.cssText =
      "background:rgba(17,17,17,.46);border:1px solid #333;border-radius:3px;color:#999;cursor:pointer;" +
      "padding:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0";
    b.addEventListener("mouseenter", () => {
      if (!b._active) { b.style.borderColor = "var(--osu-fav-accent)"; b.style.color = "var(--osu-fav-accent)"; }
    });
    b.addEventListener("mouseleave", () => {
      if (!b._active) { b.style.borderColor = "#333"; b.style.color = "#999"; }
    });
    return b;
  }

  function setNpToggleActive(btn, active) {
    btn._active = active;
    btn.style.borderColor = active ? "var(--osu-fav-accent)" : "#333";
    btn.style.color = active ? "var(--osu-fav-accent)" : "#999";
  }

  const npShuffleBtn = npIconBtn(shuffleSVG, "Shuffle");
  const npBackBtn = npIconBtn(prevSVG, "Previous");
  const npPlayBtn = npIconBtn(playSVG, "Play/Pause");
  const npNextBtn = npIconBtn(nextSVG, "Next");
  const npLoopBtn = npIconBtn(loopSVG, "Loop");
  setNpToggleActive(npShuffleBtn, musicShuffleEnabled());
  setNpToggleActive(npLoopBtn, musicLoopEnabled());

  npShuffleBtn.addEventListener("click", () => {
    const on = !musicShuffleEnabled();
    GM_setValue(MUSIC_SHUFFLE_KEY, on);
    setNpToggleActive(npShuffleBtn, on);
  });
  npLoopBtn.addEventListener("click", () => {
    const on = !musicLoopEnabled();
    GM_setValue(MUSIC_LOOP_KEY, on);
    setNpToggleActive(npLoopBtn, on);
  });
  npBackBtn.addEventListener("click", () => queueAdvance(-1));
  npNextBtn.addEventListener("click", () => queueAdvance(1));
  npPlayBtn.addEventListener("click", () => {
    const audio = window._osuFavAudio;
    if (!audio || !audio.src) return;
    // The current track's source is still being decided (cache lookup in
    // flight), so audio.src is whatever played before: play/pause here would
    // act on that instead. The pending request starts playback by itself.
    if (audio._pendingSourceId) return;
    if (audio.paused) audio.play();
    else audio.pause();
  });

  npControls.append(npShuffleBtn, npBackBtn, npPlayBtn, npNextBtn, npLoopBtn);
  nowPlayingBar.append(npBg, npBgShade, npThumb, npInfo, npControls, npProgressWrap);

  // Resets whatever card is currently linked to the audio element back to
  // its idle look - shared by the "switch to a different track" path and
  // the natural end-of-track path.
  function resetActiveCardUI(audio) {
    if (audio._activeBtn) {
      audio._activeBtn.innerHTML = playSVG();
      audio._activeBtn._playing = false;
      audio._activeBtn.style.opacity = "var(--osu-fav-idle-opacity, 0.15)";
      audio._activeBtn.style.borderColor = "#333";
      audio._activeBtn.style.color = "#999";
    }
    if (audio._activeBar) {
      audio._activeBar.parentElement.style.display = "none";
      audio._activeBar.style.width = "0%";
    }
    if (audio._activeDim) audio._activeDim.style.background = "rgba(51,51,51,var(--osu-fav-idle-dim, 0))";
    audio._activeBtn = null;
    audio._activeBar = null;
    audio._activeDim = null;
    if (audio._npProgressBar) audio._npProgressBar.style.width = "0%";
  }

  function getPlaybackCover(f, id) {
    const stored = f && f.covers && (
      f.covers.card ||
      f.covers["card@2x"] ||
      f.covers.list ||
      f.covers.cover
    );
    // Older local favorites may not have a stored covers object. Fall back to
    // osu!'s deterministic beatmapset cover URL so the mini-player still gets
    // artwork even for those entries.
    return stored || (id ? `https://assets.ppy.sh/beatmaps/${id}/covers/card.jpg` : "");
  }

  // Starts a track by id/record, linking up whichever card is currently
  // on screen for it (if any - long lists build cards lazily) and the
  // Now Playing bar. `navigated` marks a track reached via Back/Next/
  // auto-next/shuffle rather than a direct click on its own preview
  // button, which is what gates the "skip if not on Hina" check in
  // ensureAudio(). The full-song mirror remains the primary source whenever
  // enabled; the official short preview is selected only by the fallback
  // path if the mirror fails or reports a short clip.
  function startPlayback(id, f, opts = {}) {
    const { navigated = false, direction = 1, skipAttempt = 0 } = opts;
    const audio = ensureAudio();
    resetActiveCardUI(audio);
    audio.pause();

    const fallbackPreviewUrl = f.preview || `https://b.ppy.sh/preview/${id}.mp3`;
    const previewUrl = previewSourceUrl(id, fallbackPreviewUrl);
    audio._fallbackPreviewUrl = fallbackPreviewUrl;
    audio._usingFullSongSource = previewUrl !== fallbackPreviewUrl;
    audio._sourceFallbackAttempted = false;
    // Per-track: true once this track started playing from the local cache
    // copy (see the cache-first swap below). Reset here so a cached track
    // never suppresses the streaming cache write for a *different* one.
    audio._usingBlobCache = false;
    audio._hinaiDurationSec = hinaiDurationSec(f.duration_sec);
    audio._queueNavigated = navigated;
    audio._queueDirection = direction;
    audio._queueSkipAttempt = skipAttempt;
    audio._npCurrentId = id;
    audio._npCurrentTitle = f.title || f.title_unicode || "Unknown";
    audio._npCurrentArtist = f.artist || f.artist_unicode || "";

    const playbackCover = getPlaybackCover(f, id);
    setMediaSessionMetadata(audio);
    // Don't drop playbackState to "none" here: this runs on every track
    // handoff (including auto-next while backgrounded), and the load()
    // below takes a moment before the "play" listener sets it back to
    // "playing". Reporting "none" during that gap is a second way Android
    // can read the session as ended and kill the notification's
    // foreground service on a locked screen. Leave the previous state
    // (normally still "playing") in place; the "play" event corrects it
    // moments later regardless.
    if (audio._npThumb) {
      if (playbackCover) {
        audio._npThumb.src = playbackCover;
        audio._npThumb.style.visibility = "visible";
      } else {
        audio._npThumb.removeAttribute("src");
        audio._npThumb.style.visibility = "hidden";
      }
    }
    if (audio._npBg) {
      audio._npBg.style.backgroundImage = playbackCover
        ? 'url("' + playbackCover.replace(/"/g, '\"') + '")'
        : "none";
    }

    const cardEl = listEl.querySelector('[data-fav-id="' + id + '"]');
    if (cardEl) {
      const btn = cardEl.querySelector(".osu-fav-preview-btn");
      const barWrap = cardEl.querySelector(".osu-fav-progress-wrap");
      const bar = cardEl.querySelector(".osu-fav-progress-bar");
      const dim = cardEl.querySelector(".osu-fav-dim-overlay");
      if (btn) {
        audio._activeBtn = btn;
        btn.innerHTML = pauseSVG();
        btn._playing = true;
        btn.style.opacity = "var(--osu-fav-active-opacity, 0.8)";
        btn.style.borderColor = "var(--osu-fav-accent)";
        btn.style.color = "var(--osu-fav-accent)";
      }
      if (barWrap) barWrap.style.display = "block";
      if (bar) { audio._activeBar = bar; bar.style.width = "0%"; }
      if (dim) { audio._activeDim = dim; dim.style.background = "rgba(51,51,51,var(--osu-fav-hover-dim, 0.65))"; }
    }

    // Now Playing artwork: same cache-first rule as list covers. Swap in
    // the cached blob asynchronously; the network URL set above renders
    // immediately and stays if the cache has nothing fresh.
    const npCover = playbackCover;
    if (npCover && cacheDurationMode() !== "never") {
      resolveCachedMediaUrl(npCover).then((resolved) => {
        if (audio._npCurrentId !== id || !audio._npThumb) return;
        if (resolved && resolved !== npCover) {
          audio._npThumb.src = resolved;
          audio._npBg.style.backgroundImage = 'url("' + resolved.replace(/"/g, '\\"') + '")';
        }
      });
    }

    if (audio._npBar) {
      audio._npBar.style.display = !settingsOpen ? "flex" : "none";
      if (audio._npTitle) audio._npTitle.textContent = audio._npCurrentTitle;
      if (audio._npArtist) audio._npArtist.textContent = audio._npCurrentArtist;
      if (audio._npProgressBar) audio._npProgressBar.style.width = "0%";
    }

    // Release the previous track's cached object URL before switching away.
    // Keyed by the source URL its bytes were cached under - which is
    // `_activePreviewUrl` only until a track has been swapped onto its local
    // copy, after which that property holds the blob: URL itself and the
    // lookup below would miss (leaking the object URL for the whole tab).
    if (audio._activeCacheKey && audio._activeCacheKey !== previewUrl) {
      const prevBlobUrl = _blobUrlCache.get(audio._activeCacheKey);
      if (prevBlobUrl) {
        URL.revokeObjectURL(prevBlobUrl);
        _blobUrlCache.delete(audio._activeCacheKey);
      }
    }
    audio._activeCacheKey = previewUrl;

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
    const cacheAllowed = cacheDurationMode() !== "never";
    // Stamped on every request so a decision that lands after the user has
    // already moved on cannot write its source, or its UI state, over the
    // newer request's.
    const requestSeq = (audio._playRequestSeq || 0) + 1;
    audio._playRequestSeq = requestSeq;
    // Tells the card's own button that a source decision is still in flight,
    // so a second click is not mistaken for pause/resume of the *previous*
    // track - audio.src still points at it until beginWithSource() runs.
    audio._pendingSourceId = id;

    function beginWithSource(cachedBlob) {
      // Superseded while the lookup was in flight (another card, Back/Next,
      // auto-next, a shuffle jump): that request owns the element now.
      if (requestSeq !== audio._playRequestSeq) return;
      if (audio._npCurrentId !== id) return;
      audio._pendingSourceId = null;

      let localSourceUrl = null;
      if (cachedBlob) {
        localSourceUrl = _blobUrlCache.get(previewUrl) || null;
        if (!localSourceUrl) {
          localSourceUrl = URL.createObjectURL(cachedBlob);
          _blobUrlCache.set(previewUrl, localSourceUrl);
        }
      }
      // Cache hit: the element only ever sees the local blob: URL. Miss: the
      // network source, which the streaming writer below fills in so the
      // next play of this song is a hit.
      audio._usingBlobCache = !!localSourceUrl;
      audio._activePreviewUrl = localSourceUrl || previewUrl;
      audio.src = audio._activePreviewUrl;
      audio.load();

      if (audio._usingFullSongSource) {
        fetchHinaiSong(id).then((song) => {
          if (!song) return;
          storeHinaiSongMetadata(id, song);
          // A response may arrive after the user chose another card. Only
          // apply it to the media element while this exact track/source is
          // still active.
          if (!audio._usingFullSongSource || audio._npCurrentId !== id) return;
          audio._hinaiDurationSec = hinaiDurationSec(song.duration_sec);
          // This often arrives after playback has already created Android's
          // media notification, so submit a second position state now.
          audio._updateMediaSessionPositionState();
          audio._maybeFallbackToOfficial();
        });
      }

      // Keep this request's source so a late rejection from a failed mirror
      // cannot tear down the UI after fallbackToOfficialPreview() has already
      // replaced it with osu!'s working preview (e.g. Nightrunning (7_7
      // Bootleg)). Read back from the property that was just set, so it
      // matches a cached local copy and a network URL alike - a blob: URL
      // never string-matches the request URL.
      const sourceAtPlayRequest = audio._activePreviewUrl;
      const wasFullSongRequest = audio._usingFullSongSource;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // This play() belonged to a source that has since been replaced by
          // the official fallback, or to a track the user has moved away
          // from. Its rejection is stale and must not hide the active
          // mini-player.
          if (audio._npCurrentId !== id) return;
          if (audio._activePreviewUrl !== sourceAtPlayRequest) return;
          // Firefox can reject the original mirror play() asynchronously even
          // after its error event has selected the official fallback. That
          // promise belongs to the mirror forever; only the media error path
          // may decide whether the replacement preview has genuinely failed.
          if (wasFullSongRequest) return;
          // A direct official preview has no alternative source to recover to.
          resetActiveCardUI(audio);
          if (audio._npBar) audio._npBar.style.display = "none";
          clearMediaSession(audio);
        });
      }

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
      if (cacheAllowed && !audio._usingBlobCache) {
        const stillWanted = () =>
          audio._npCurrentId === id &&
          !audio._sourceFallbackAttempted &&
          !audio._usingBlobCache;

        const startStreamCache = () => {
          // Explicit pre-request check: if this browser already holds a
          // written cache entry for the song, do not issue any request at
          // all. Only a genuine miss downloads; an interrupted download is
          // not a miss either - it resumes from its stored chunks with a
          // Range request for the remainder (see startStreamingCacheWrite).
          hasFreshCachedCopy(previewUrl).then((alreadyCached) => {
            if (alreadyCached || !stillWanted()) return;
            startStreamingCacheWrite(previewUrl, { isStillWanted: stillWanted });
          });
        };
        if (audio.paused) audio.addEventListener("play", startStreamCache, { once: true });
        else startStreamCache();
      }
    }

    // The decision itself. A synchronous in-memory hit skips the lookup
    // entirely; otherwise this is the one bounded IndexedDB read that has to
    // happen before play().
    const knownCachedBlob = cacheAllowed ? getKnownCachedBlob(previewUrl) : null;
    const sourceLookup = knownCachedBlob
      ? Promise.resolve(knownCachedBlob)
      : (cacheAllowed ? lookupCachedBlob(previewUrl) : Promise.resolve(null));
    sourceLookup.then(beginWithSource).catch(() => {
      // Nothing on this path is expected to throw (the lookup swallows its
      // own failures and resolves null instead), but a source that could not
      // be assigned at all must not leave the row stuck showing pause.
      if (requestSeq !== audio._playRequestSeq || audio._npCurrentId !== id) return;
      audio._pendingSourceId = null;
      resetActiveCardUI(audio);
      if (audio._npBar) audio._npBar.style.display = "none";
      clearMediaSession(audio);
    });
  }

// Moves to the next (direction 1) or previous (direction -1) track in
// the currently visible, sorted/filtered list. Shuffle picks a random
// track instead of stepping in order.
  function queueAdvance(direction, opts = {}) {
    const entries = renderList._entries || [];
    if (!entries.length) return;
    const skipAttempt = opts.skipAttempt || 0;
    if (skipAttempt > entries.length) return;

    const audio = ensureAudio();
    const currentIdx = entries.findIndex(([eid]) => eid === audio._npCurrentId);

    let nextIdx;
    if (musicShuffleEnabled() && entries.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * entries.length);
      } while (nextIdx === currentIdx);
    } else if (currentIdx === -1) {
      nextIdx = direction > 0 ? 0 : entries.length - 1;
    } else {
      nextIdx = (currentIdx + direction + entries.length) % entries.length;
    }

    const [id, f] = entries[nextIdx];
    startPlayback(id, f, { navigated: true, direction, skipAttempt });
  }

  // Wire this panel's Now Playing bar + queue functions into the
  // (page-lifetime, singleton) audio element. The bar itself is mounted
  // directly in this panel's content area, so it never scrolls away with
  // the list/settings view.
  const npAudio = ensureAudio();
  npAudio._npBar = nowPlayingBar;
  npAudio._npTitle = npTitle;
  npAudio._npArtist = npArtist;
  npAudio._npPlayBtn = npPlayBtn;
  npAudio._npProgressBar = npProgressBar;
  npAudio._npThumb = npThumb;
  npAudio._npBg = npBg;
  npAudio._queueAdvance = queueAdvance;

  // Reconcile the freshly-rendered favorite cards with the singleton audio.
  // renderList() can replace the DOM node for the current song while playback
  // is still alive; never let the detached node remain the active UI owner.
  function syncCurrentCardUI() {
    const audio = window._osuFavAudio;
    if (!audio || !audio._npCurrentId) return;
    const cardEl = listEl.querySelector('[data-fav-id="' + audio._npCurrentId + '"]');
    if (!cardEl) return;

    const btn = cardEl.querySelector(".osu-fav-preview-btn");
    const barWrap = cardEl.querySelector(".osu-fav-progress-wrap");
    const bar = cardEl.querySelector(".osu-fav-progress-bar");
    const dim = cardEl.querySelector(".osu-fav-dim-overlay");

    // Clear the old card refs first; then link them to this newly-mounted node.
    audio._activeBtn = btn || null;
    audio._activeBar = bar || null;
    audio._activeDim = dim || null;

    if (btn) {
      const playing = !audio.paused;
      btn.innerHTML = playing ? pauseSVG() : playSVG();
      btn._playing = playing;
      btn.style.opacity = playing
        ? "var(--osu-fav-active-opacity, 0.8)"
        : "var(--osu-fav-idle-opacity, 0.15)";
      btn.style.borderColor = playing ? "var(--osu-fav-accent)" : "#333";
      btn.style.color = playing ? "var(--osu-fav-accent)" : "#999";
    }
    if (barWrap) barWrap.style.display = !audio.paused ? "block" : "none";
    if (bar) {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      bar.style.width = pct + "%";
    }
    if (dim) {
      dim.style.background = !audio.paused
        ? "rgba(51,51,51,var(--osu-fav-hover-dim, 0.65))"
        : "rgba(51,51,51,var(--osu-fav-idle-dim, 0))";
    }
  }

  if (npAudio.src && npAudio._npCurrentId) {
    nowPlayingBar.style.display = !settingsOpen ? "flex" : "none";
    npTitle.textContent = npAudio._npCurrentTitle || "";
    npArtist.textContent = npAudio._npCurrentArtist || "";
    const currentFav = getFavorites()[npAudio._npCurrentId];
    const currentCover = getPlaybackCover(currentFav, npAudio._npCurrentId);
    if (currentCover) {
      npThumb.src = currentCover;
      npThumb.style.visibility = "visible";
      npBg.style.backgroundImage = 'url("' + currentCover.replace(/"/g, '\"') + '")';
    } else {
      npThumb.removeAttribute("src");
      npThumb.style.visibility = "hidden";
      npBg.style.backgroundImage = "none";
    }
    npPlayBtn.innerHTML = npAudio.paused ? playSVG() : pauseSVG();
    npProgressBar.style.width =
      npAudio.duration ? (npAudio.currentTime / npAudio.duration) * 100 + "%" : "0%";
    syncCurrentCardUI();
  }

  // ── View switching ───────────────────────────────────────
  function setView(showSettings) {
    settingsOpen = showSettings;
    toolbar.style.display = showSettings ? "none" : "flex";
    if (showSettings) closeFilterMenu();
    listEl.style.display = showSettings ? "none" : "block";
    settingsView.style.display = showSettings ? "block" : "none";
    searchInput.style.display = showSettings ? "none" : "block";
    if (showSettings) {
      // The search field belongs only to the favorites list. Collapse the
      // header to its title row while Settings is open so it does not leave
      // an empty search-sized gap above the controls.
      header.style.height = "54px";
      header.style.maxHeight = "54px";
    }
    footer.style.display = showSettings ? "block" : "none";
    nowPlayingBar.style.display = !showSettings && npAudio.src && npAudio._npCurrentId ? "flex" : "none";
    bottomBar.setAttribute("data-view", showSettings ? "settings" : "favorites");
    settingsBtn.style.color = showSettings ? "var(--osu-fav-accent)" : "#999";
    settingsBtn.style.borderColor = showSettings ? "var(--osu-fav-accent)" : "#333";
    settingsBtn.title = showSettings ? "Back to favorites" : "Settings";
    if (showSettings) {
      settings.render();
    } else {
      // Returning to the list from Settings rebuilds rows so controls pick
      // up changed settings, then reconnects the current audio track to the
      // newly-created card instead of leaving stale detached DOM refs.
      renderList();
      requestAnimationFrame(syncCurrentCardUI);
      updateMobileSearchBar();
    }
  }

  // ── Helpers ────────────────────────────────────────────
  function statusColor(s) {
    return (
      {
        ranked: "#4caf50",
        loved: "var(--osu-fav-accent)",
        qualified: "#4fc3f7",
        approved: "#4caf50",
        pending: "#ff9800",
        wip: "#f44336",
        graveyard: "#666",
        vip: "#f6c243",
      }[s] || "#888"
    );
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso),
      diff = Date.now() - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  }

  // ── Render list ────────────────────────────────────────
  function renderList() {
    panel._osuFavRenderCount = (panel._osuFavRenderCount || 0) + 1;
    const favs = getFavorites();
    let entries = Object.entries(favs);

    // Scroll preservation. renderList() empties the list node and rebuilds
    // it, which throws away scrollTop - so a refresh triggered by anything
    // other than the user (a tab regaining focus, a cross-tab write, an
    // enrichment pass finishing) used to fling the list back to the top.
    // The position is only worth keeping while the *same* view is on screen;
    // changing the sort, search or any filter should land at the top, which
    // is what comparing a view key gives us for free.
    const viewKey = JSON.stringify([
      currentSort,
      sortAsc,
      searchQuery.trim().toLowerCase(),
      filterState,
      activeCollectionId,
    ]);
    const sameView = viewKey === renderList._viewKey;
    renderList._viewKey = viewKey;
    const savedScroll = sameView ? listEl.scrollTop : 0;

    const cBadge = panel.querySelector("#osu-fav-count");

    // Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        ([, f]) =>
          (f.title || "").toLowerCase().includes(q) ||
          (f.artist || "").toLowerCase().includes(q) ||
          (f.creator || "").toLowerCase().includes(q) ||
          (f.tags || "").toLowerCase().includes(q) ||
          (f.source || "").toLowerCase().includes(q) ||
          (f.id || "").includes(q),
      );
    }

    // Category filters (date / title / artist / status / genre). Terms are
    // lowercase keys; within a category the "include" terms are OR'd and any
    // "exclude" term always drops the entry, even if it also matched an
    // include. Across categories the surviving sets are AND'd. The plan is
    // flattened once per render rather than per row - see ui/filters.js.
    const filterPlan = buildFilterPlan(filterState);
    if (filterPlan.length) entries = entries.filter(([, f]) => favMatchesPlan(f, filterPlan));

    // Collection filter
    if (activeCollectionId) {
      const col = getCollections()[activeCollectionId];
      const idSet = new Set(col && Array.isArray(col.ids) ? col.ids : []);
      entries = entries.filter(([id]) => idSet.has(id));
    }

    // The badge reflects the visible result set after search, genre/tag,
    // and collection filters, rather than always showing the library total.
    if (cBadge) cBadge.textContent = entries.length;

    // Sort
    entries.sort(([idA, a], [idB, b]) => {
      let cmp = 0;
      if (currentSort === "date")
        cmp = (a.favourited_at || "").localeCompare(b.favourited_at || "");
      if (currentSort === "title")
        cmp = (a.title || "").localeCompare(b.title || "");
      if (currentSort === "artist")
        cmp = (a.artist || "").localeCompare(b.artist || "");
      if (currentSort === "status")
        cmp = (a.status || "").localeCompare(b.status || "");
      if (currentSort === "genre")
        cmp = (a.genre || "").localeCompare(b.genre || "");
      if (cmp === 0) cmp = idB.localeCompare(idA);
      return sortAsc ? cmp : -cmp;
    });

    // Snapshot for the Now Playing bar's Back/Next/shuffle - always the
    // currently visible, filtered/sorted order.
    renderList._entries = entries;

    listEl.innerHTML = "";
    // Emptying the node zeroes scrollTop in a browser, but say so explicitly:
    // the early-return paths below never reach the restore logic, and a view
    // change must land at the top whether or not the engine obliges.
    if (savedScroll <= 0) {
      listEl.scrollTop = 0;
      lastListScrollTop = 0;
    }
    // Invalidate any chunk-append from a previous render (also covers the
    // early-return paths below).
    renderList._token = (renderList._token || 0) + 1;

    // Disconnect any previous lazy-load observer so orphaned refs don't linger
    if (renderList._imgObserver) {
      renderList._imgObserver.disconnect();
      renderList._imgObserver = null;
    }
    // IntersectionObserver rooted on the scroll container, 100px look-ahead on each side
    const imgObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          obs.unobserve(img);
          if (img.dataset.src) {
            const url = img.dataset.src;
            delete img.dataset.src;
            // IndexedDB lookup is local and fast, so it's fine to wait for
            // it before assigning src - avoids a network fetch now and a
            // second, cached-copy swap-in moments later (which would
            // otherwise cause a visible flicker on every card).
            resolveCachedMediaUrl(url).then((resolvedUrl) => {
              img.src = resolvedUrl;
            });
          }
        });
      },
      { root: listEl, rootMargin: "100px 0px", threshold: 0 },
    );
    renderList._imgObserver = imgObserver;

    if (Object.keys(favs).length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center;color:#666;padding:40px 20px;font-size:12px">No favorites yet.</p>';
      return;
    }
    if (entries.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center;color:#666;padding:40px 20px;font-size:12px">No matches.</p>';
      return;
    }


    // Card BUILDER - rows are constructed lazily, one chunk per animation
    // frame (see renderChunk below), so opening the panel with 500+ favorites
    // doesn't build ~15k DOM nodes inside the click handler.
    const buildCard = ([id, f]) => {
      const card = document.createElement("div");
      card.dataset.favId = id;
      card.style.cssText =
        "display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid #1e1e1e;align-items:center";
      card.addEventListener(
        "mouseenter",
        () => (card.style.background = "#1a1a1a"),
      );
      card.addEventListener("mouseleave", () => (card.style.background = ""));

      // Cover
      const coverUrl =
        (f.covers || {}).card ||
        (f.covers || {})["card@2x"] ||
        (f.covers || {}).list ||
        (f.covers || {}).cover ||
        "";
      const coverEl = document.createElement("div");
      coverEl.style.cssText =
        "position:relative;width:56px;height:42px;border-radius:2px;overflow:hidden;flex-shrink:0;background:#1a1a1a;display:flex;align-items:center;justify-content:center;cursor:pointer";
      if (coverUrl) {
        const img = document.createElement("img");
        // Don't set src yet - the IntersectionObserver will do it when the row
        // scrolls within 100px of the list viewport
        img.dataset.src = coverUrl;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
        img.addEventListener("error", () => {
          img.remove();
          coverEl.style.fontSize = "16px";
          coverEl.style.color = "#444";
          // insertBefore instead of textContent= so dimOverlay & previewBtn
          // (appended after this block) are not destroyed
          coverEl.insertBefore(document.createTextNode("?"), coverEl.firstChild);
        });
        coverEl.appendChild(img);
        imgObserver.observe(img);
      } else {
        coverEl.style.cssText += ";font-size:16px;color:#444";
        coverEl.textContent = "?";
      }

      // Dim overlay - sits at --osu-fav-idle-dim normally (0 by default,
      // i.e. invisible) and brightens to --osu-fav-hover-dim on hover/while playing
      const dimOverlay = document.createElement("div");
      dimOverlay.className = "osu-fav-dim-overlay";
      dimOverlay.style.cssText =
        "position:absolute;inset:0;background:rgba(51,51,51,var(--osu-fav-idle-dim, 0));transition:background 0.15s;pointer-events:none";
      coverEl.appendChild(dimOverlay);

      // Info
      const info = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0";

      const titleDiv = document.createElement("div");
      titleDiv.style.cssText =
        "font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3";
      titleDiv.textContent = f.title || f.title_unicode || "Unknown";
      if (f.nsfw) {
        const badge = document.createElement("span");
        badge.textContent = "EXPLICIT";
        badge.style.cssText =
          "font-size:7px;color:#f6c243;border:1px solid #f6c243;border-radius:2px;padding:0 3px;margin-left:4px;vertical-align:middle;font-weight:600";
        titleDiv.appendChild(badge);
      }
      const artistDiv = document.createElement("div");
      artistDiv.style.cssText =
        "font-size:10px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;display:flex;align-items:center;gap:4px";
      const artistText = document.createElement("span");
      artistText.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      artistText.textContent = f.artist || f.artist_unicode || "";
      artistDiv.appendChild(artistText);
      if (f.is_artist_featured) {
        const faBadge = document.createElement("span");
        faBadge.textContent = "FEATURED ARTIST";
        faBadge.style.cssText =
          "font-size:7px;color:#66ccff;border:1px solid #66ccff;border-radius:2px;padding:0 3px;vertical-align:middle;font-weight:600;flex-shrink:0";
        artistDiv.appendChild(faBadge);
      }

      const metaDiv = document.createElement("div");
      metaDiv.style.cssText =
        "display:flex;gap:5px;align-items:center;margin-top:2px";

      if (f.creator) {
        const m = document.createElement("span");
        m.style.cssText =
          "font-size:10px;color:var(--osu-fav-accent);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px";
        m.textContent = f.creator;
        metaDiv.appendChild(m);
      }
      if (f.status) {
        const st = document.createElement("span");
        st.textContent = f.status.toUpperCase();
        st.style.cssText = `font-size:8px;font-weight:700;letter-spacing:.3px;color:${statusColor(f.status)}`;
        metaDiv.appendChild(st);
      }
      if (f.bpm) {
        const bpm = document.createElement("span");
        bpm.style.cssText = "font-size:9px;color:#555";
        bpm.textContent = `${f.bpm} BPM`;
        metaDiv.appendChild(bpm);
      }

      const dateRow = document.createElement("div");
      dateRow.style.cssText = "display:flex;align-items:center;gap:5px;margin-top:1px";

      const dateDiv = document.createElement("span");
      dateDiv.style.cssText =
        "font-size:9px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      dateDiv.textContent = formatDate(f.favourited_at);

      // Add-to-collection dropdown - sits right next to the date-added text.
      // Shows a checkmark + count once the map is in at least one collection.
      const collCount = () => collectionsContainingMap(id).length;
      const addToCollBtn = document.createElement("button");
      addToCollBtn.type = "button";
      function refreshAddToCollBtn() {
        const n = collCount();
        addToCollBtn.textContent = n ? `\u2713 ${n}` : "+ Playlist";
        addToCollBtn.title = n
          ? `In ${n} collection${n > 1 ? "s" : ""} - click to manage`
          : "Add to a collection";
        addToCollBtn.style.borderColor = n ? "var(--osu-fav-accent)" : "#333";
        addToCollBtn.style.color = n ? "var(--osu-fav-accent)" : "#666";
      }
      addToCollBtn.style.cssText =
        "font-size:8px;font-weight:600;padding:1px 5px;border-radius:2px;flex-shrink:0;cursor:pointer;background:transparent";
      refreshAddToCollBtn();
      addToCollBtn.style.border = `1px solid ${collCount() ? "var(--osu-fav-accent)" : "#333"}`;
      addToCollBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showAddToCollectionMenu(addToCollBtn, id, () => {
          refreshAddToCollBtn();
          addToCollBtn.style.borderColor = collCount() ? "var(--osu-fav-accent)" : "#333";
          // Membership changed - if a collection filter is active, this
          // card may need to appear/disappear from the visible list.
          if (activeCollectionId) renderList();
        });
      });

      dateRow.append(dateDiv, addToCollBtn);

      // Progress bar (shown during playback)
      const progressWrap = document.createElement("div");
      progressWrap.className = "osu-fav-progress-wrap";
      progressWrap.style.cssText = "height:2px;background:#333;border-radius:1px;margin-top:3px;overflow:hidden;display:none";
      const progressBar = document.createElement("div");
      progressBar.className = "osu-fav-progress-bar";
      progressBar.style.cssText = "height:100%;width:0%;background:var(--osu-fav-accent);border-radius:1px";
      progressWrap.appendChild(progressBar);

      info.append(titleDiv, artistDiv, metaDiv, dateRow, progressWrap);

      // Actions
      const actions = document.createElement("div");
      actions.style.cssText =
        "display:flex;flex-direction:column;gap:4px;flex-shrink:0;justify-content:center";

      const openLink = document.createElement("a");
      openLink.href = f.url || `https://osu.ppy.sh/beatmapsets/${id}`;
      openLink.target = "_blank";
      openLink.textContent = "Open";
      openLink.style.cssText =
        "font-size:10px;padding:4px 8px;border:1px solid #333;border-radius:2px;color:#999;text-decoration:none;text-align:center;display:block;white-space:nowrap";
      openLink.addEventListener("mouseenter", () => {
        openLink.style.borderColor = "var(--osu-fav-accent)";
        openLink.style.color = "var(--osu-fav-accent)";
      });
      openLink.addEventListener("mouseleave", () => {
        openLink.style.borderColor = "#333";
        openLink.style.color = "#999";
      });

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
      const defaultMirror = resolveDefaultMirror(id);
      let soleOption = null;
      if (!defaultMirror) {
        const opts = buildDownloadOptions(id);
        if (opts.length === 1) soleOption = opts[0];
      }
      const downloadStyle =
        "font-size:10px;padding:4px 8px;border:1px solid #333;border-radius:2px;background:none;color:#999;" +
        "cursor:pointer;text-align:center;white-space:nowrap;width:100%;text-decoration:none;display:block;box-sizing:border-box";

      let downloadLink;
      if (defaultMirror || soleOption) {
        const target = defaultMirror || soleOption;
        downloadLink = document.createElement("a");
        downloadLink.href = target.url;
        downloadLink.target = "_blank";
        downloadLink.rel = "noopener";
        downloadLink.textContent = "Download";
        downloadLink.title = defaultMirror
          ? `Download via ${target.label} - change default in Settings`
          : `Download via ${target.label}`;
      } else {
        downloadLink = document.createElement("button");
        downloadLink.type = "button";
        downloadLink.title = "Download map (official + mirrors)";
        downloadLink.textContent = "Download ▾";
        downloadLink.addEventListener("click", (e) => {
          e.stopPropagation();
          showDownloadMenu(downloadLink, id);
        });
      }
      downloadLink.style.cssText = downloadStyle;
      downloadLink.addEventListener("mouseenter", () => {
        downloadLink.style.borderColor = "var(--osu-fav-accent)";
        downloadLink.style.color = "var(--osu-fav-accent)";
      });
      downloadLink.addEventListener("mouseleave", () => {
        downloadLink.style.borderColor = "#333";
        downloadLink.style.color = "#999";
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.style.cssText =
        "font-size:10px;padding:4px 8px;border:1px solid #333;border-radius:2px;background:none;color:#999;cursor:pointer;white-space:nowrap";
      removeBtn.addEventListener("mouseenter", () => {
        removeBtn.style.borderColor = "#e55";
        removeBtn.style.color = "#e55";
      });
      removeBtn.addEventListener("mouseleave", () => {
        removeBtn.style.borderColor = "#333";
        removeBtn.style.color = "#999";
      });
      removeBtn.addEventListener("click", () => {
        const favs = getFavorites();
        delete favs[id];
        setFavorites(favs);
        updateFloatingHeart();
        scheduleAutoBackup();
        renderList();
      });

      // Preview button - singleton audio (module-level ensureAudio()), only one plays at a time
      ensureAudio();

      const previewUrl = previewSourceUrl(id, f.preview || `https://b.ppy.sh/preview/${id}.mp3`);

      // Hydrate this track's cache entry as soon as the user shows intent
      // (hover or pointer-down on the row, or keyboard focus). Then the
      // click's cache lookup is a synchronous memory hit and the local copy
      // is chosen without ever awaiting IndexedDB - see the cache-first
      // source selection in startPlayback(). Prewarming only ever populates
      // the small LRU, so sweeping a few rows costs no retained memory.
      const prewarmPreview = () => prewarmCachedPreview(previewUrl);
      card.addEventListener("mouseenter", prewarmPreview, { once: true });
      card.addEventListener("pointerdown", prewarmPreview, { once: true });
      card.addEventListener("focusin", prewarmPreview, { once: true });

      // Play button - lives inside the cover, centred, shown on hover or while playing
      const previewBtn = document.createElement("button");
      previewBtn.className = "osu-fav-preview-btn";
      previewBtn.innerHTML = playSVG();
      previewBtn.title = "Preview audio";
      previewBtn.style.cssText =
        "position:absolute;inset:0;margin:auto;width:fit-content;height:fit-content;" +
        "font-size:11px;padding:2px 6px;border:1px solid #333;border-radius:2px;" +
        "background:none;color:#999;cursor:pointer;text-align:center;line-height:1;" +
        "opacity:var(--osu-fav-idle-opacity, 0.15);transition:opacity 0.15s";

      // Show/hide button on cover hover; restore original border/color on hover
      coverEl.addEventListener("mouseenter", () => {
        previewBtn.style.opacity = "var(--osu-fav-active-opacity, 0.8)";
        dimOverlay.style.background = "rgba(51,51,51,var(--osu-fav-hover-dim, 0.65))";
        if (!previewBtn._playing) { previewBtn.style.borderColor = "var(--osu-fav-accent)"; previewBtn.style.color = "var(--osu-fav-accent)"; }
      });
      coverEl.addEventListener("mouseleave", () => {
        if (!previewBtn._playing) {
          previewBtn.style.opacity = "var(--osu-fav-idle-opacity, 0.15)";
          previewBtn.style.borderColor = "#333";
          previewBtn.style.color = "#999";
          dimOverlay.style.background = "rgba(51,51,51,var(--osu-fav-idle-dim, 0))";
        }
      });

      previewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const audio = window._osuFavAudio;
        // Compare by id, not by src string - a cached play sets audio.src
        // to a local blob: URL, which never string-matches previewUrl.
        const isSame = audio._npCurrentId === id;
        // A source decision for this same track is still in flight, so
        // audio.src does not point at it yet - a play/pause here would act on
        // whatever played before. The pending play() starts on its own.
        if (isSame && audio._pendingSourceId === id) return;
        if (isSame) {
          if (!audio.paused) {
            audio.pause();
            previewBtn.innerHTML = playSVG();
            previewBtn._playing = false;
            previewBtn.style.opacity = "var(--osu-fav-idle-opacity, 0.15)";
            previewBtn.style.borderColor = "#333";
            previewBtn.style.color = "#999";
            dimOverlay.style.background = "rgba(51,51,51,var(--osu-fav-idle-dim, 0))";
          } else {
            // Re-link the bar/dim to this card every time we (re)start
            // playback, not just on a genuinely new src - if the previous
            // play ran to completion, the "ended" handler already cleared
            // audio._activeBar/_activeDim and hid the progress wrap, so a
            // plain audio.play() here would resume sound with nothing
            // wired up to draw progress for it.
            audio._activeBtn = previewBtn;
            audio._activeBar = progressBar;
            audio._activeDim = dimOverlay;
            progressWrap.style.display = "block";
            audio.play();
            previewBtn.innerHTML = pauseSVG();
            previewBtn._playing = true;
            previewBtn.style.opacity = "var(--osu-fav-active-opacity, 0.8)";
            previewBtn.style.borderColor = "var(--osu-fav-accent)";
            previewBtn.style.color = "var(--osu-fav-accent)";
            dimOverlay.style.background = "rgba(51,51,51,var(--osu-fav-hover-dim, 0.65))";
          }
          return;
        }
        // Different track - hand off to the shared player so the Now
        // Playing bar and Back/Next queue stay in sync too.
        startPlayback(id, f, { navigated: false });
      });

      coverEl.appendChild(previewBtn);

      // Reconcile a track that is already loaded in the singleton audio
      // element with this freshly built card. renderList() runs on panel
      // open, close/reopen, and every external refresh while playback
      // keeps going; buildCard always rendered the button in its idle
      // state, and syncCurrentCardUI() fires before the chunked append has
      // created this row - so the playing/paused state and progress bar
      // were forgotten on every rebuild. Link the live card here, per
      // chunk, exactly when the node comes into existence.
      const liveAudio = window._osuFavAudio;
      if (liveAudio && liveAudio._npCurrentId === String(id)) {
        liveAudio._activeBtn = previewBtn;
        liveAudio._activeBar = progressBar;
        liveAudio._activeDim = dimOverlay;
        const playing = !liveAudio.paused && !liveAudio.ended;
        previewBtn._playing = playing;
        previewBtn.innerHTML = playing ? pauseSVG() : playSVG();
        if (playing) {
          previewBtn.style.opacity = "var(--osu-fav-active-opacity, 0.8)";
          previewBtn.style.borderColor = "var(--osu-fav-accent)";
          previewBtn.style.color = "var(--osu-fav-accent)";
          progressWrap.style.display = "block";
          dimOverlay.style.background = "rgba(51,51,51,var(--osu-fav-hover-dim, 0.65))";
          const pct = liveAudio.duration ? (liveAudio.currentTime / liveAudio.duration) * 100 : 0;
          progressBar.style.width = pct + "%";
        }
      }

      actions.append(openLink, downloadLink, removeBtn);
      card.append(coverEl, info, actions);
      return card;
    };

    // Chunked build+append - mounting 500+ rows in one synchronous pass
    // blocked the click handler for seconds and forced full-layout reflows.
    // Smaller chunks keep each frame comfortably under the ~50ms budget
    // Chrome flags as janky, at the cost of slightly more frames to finish
    // mounting a very long list - imperceptible either way while scrolled
    // near the top, and it's non-blocking regardless.
    const CHUNK_SIZE = 25;
    const renderToken = renderList._token; // set at top of this function
    let cursor = 0;
    // Rows arrive a chunk at a time, so the saved offset usually does not
    // exist yet on the first frame. Restore as soon as the list has grown
    // tall enough to hold it (or once every row is mounted, if the list is
    // now shorter than it was), then stop checking.
    let scrollRestored = savedScroll <= 0;
    const tryRestoreScroll = (finished) => {
      if (scrollRestored) return;
      const maxScroll = listEl.scrollHeight - listEl.clientHeight;
      if (maxScroll < savedScroll && !finished) return;
      listEl.scrollTop = Math.min(savedScroll, Math.max(0, maxScroll));
      scrollRestored = true;
      // Keep the mobile search bar's own scroll tracking in step, so the
      // restore is not read as the user scrolling and does not collapse or
      // expand the header behind their back.
      lastListScrollTop = listEl.scrollTop;
    };
    const renderChunk = () => {
      if (renderList._token !== renderToken) return; // superseded by newer render
      const end = Math.min(cursor + CHUNK_SIZE, entries.length);
      const chunk = document.createDocumentFragment();
      for (; cursor < end; cursor++) chunk.appendChild(buildCard(entries[cursor]));
      listEl.appendChild(chunk);
      const finished = cursor >= entries.length;
      tryRestoreScroll(finished);
      if (!finished) requestAnimationFrame(renderChunk);
    };
    if (entries.length) requestAnimationFrame(renderChunk);
  }

  // ── Mobile search bar behavior ─────────────────────────────
  // On narrow screens the search field collapses while the favorites list is
  // scrolled down, giving the cards more vertical room. The mini-player is
  // deliberately outside the scrolling list, so it remains pinned while the
  // search bar hides/reappears.
  let lastListScrollTop = 0;
  let searchBarCollapsed = false;
  function updateMobileSearchBar() {
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    if (!isMobile) {
      searchInput.style.maxHeight = "40px";
      searchInput.style.opacity = "1";
      searchInput.style.marginBottom = "0";
      searchInput.style.paddingTop = "6px";
      searchInput.style.paddingBottom = "6px";
      searchInput.style.borderWidth = "1px";
      searchInput.style.pointerEvents = "auto";
      header.style.height = "100px";
      header.style.maxHeight = "100px";
      header.style.paddingTop = "10px";
      header.style.paddingBottom = "8px";
      headerTop.style.marginBottom = "8px";
      searchBarCollapsed = false;
      return;
    }

    const scrollTop = listEl.scrollTop;
    const scrollingDown = scrollTop > lastListScrollTop + 2;
    const scrollingUp = scrollTop < lastListScrollTop - 2;
    if (scrollTop <= 4 || scrollingUp) searchBarCollapsed = false;
    else if (scrollingDown) searchBarCollapsed = true;
    lastListScrollTop = scrollTop;

    searchInput.style.maxHeight = searchBarCollapsed ? "0" : "40px";
    searchInput.style.opacity = searchBarCollapsed ? "0" : "1";
    searchInput.style.marginBottom = searchBarCollapsed ? "-1px" : "0";
    searchInput.style.paddingTop = searchBarCollapsed ? "0" : "6px";
    searchInput.style.paddingBottom = searchBarCollapsed ? "0" : "6px";
    searchInput.style.borderWidth = searchBarCollapsed ? "0" : "1px";
    searchInput.style.pointerEvents = searchBarCollapsed ? "none" : "auto";

    // Collapse the header itself with the search field. The input alone can
    // disappear while osu!'s global CSS still leaves a large header box.
    const headerHeight = searchBarCollapsed ? "54px" : "100px";
    header.style.height = headerHeight;
    header.style.maxHeight = headerHeight;
    header.style.paddingTop = "10px";
    header.style.paddingBottom = "8px";
    headerTop.style.marginBottom = searchBarCollapsed ? "0" : "8px";
  }
  listEl.addEventListener("scroll", updateMobileSearchBar, { passive: true });
  window.addEventListener("resize", updateMobileSearchBar);

  // ── Assemble & wire events ─────────────────────────────
  // Bottom UI is a panel-level sibling of the scrolling content, exactly like
  // the top header: it is absolutely pinned to the panel bottom and never
  // participates in the scrollable list/settings viewport.
  const bottomBar = document.createElement("div");
  bottomBar.id = "osu-fav-bottom-bar";
  bottomBar.style.cssText =
    "position:absolute;left:0;right:0;bottom:0;z-index:20;overflow:hidden;" +
    "background:#1a1a1a;box-shadow:0 -3px 12px rgba(0,0,0,.35);" +
    "padding-bottom:0;box-sizing:border-box;min-height:0;height:auto;";
  bottomBar.append(nowPlayingBar, footer);
  panel.append(header, ...(githubBanner ? [githubBanner] : []), toolbar, contentArea, bottomBar);
  document.body.appendChild(panel);
  // Expose the in-place re-render so changes made anywhere else (a heart
  // clicked on the page behind, Copy All, a Gist restore, another tab) can
  // update this panel without tearing it down. renderList() re-reads the
  // store and rebuilds the rows while keeping the closure state - search
  // text, sort, genre filter, active collection - and the mini-player's
  // binding intact, which destroying and reopening the panel does not.
  panel._osuFavRefresh = renderList;
  renderList();
  updateFooterStatus();
      updateMobileSearchBar();

  // Automatic checks can be disabled in Settings. Manual checks remain
  // available from Settings and the userscript menu either way.
  if (autoUpdateChecksEnabled()) {
    const currentVersion = getCurrentVersion();
    checkVersionUpdate(true).then((latestVersion) => {
      if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
        showPanelUpdateOverlay(latestVersion);
      }
    });
  }
}

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
let _panelRefreshQueued = false;
let _panelRefreshForced = false;

// `force` is used for storage changes received from another tab. A local
// panel action may already have queued a render when that notification
// arrives; coalescing the notification away would leave page A showing its
// old list until the next local interaction.
export function refreshFavoritesPanel(force = false) {
  if (_panelRefreshQueued) {
    _panelRefreshForced = _panelRefreshForced || force;
    return;
  }
  const panel = document.getElementById("osu-local-fav-panel");
  if (!panel || typeof panel._osuFavRefresh !== "function") return;
  const countAtQueueTime = panel._osuFavRenderCount || 0;
  const forceThisRender = force;
  _panelRefreshQueued = true;

  const run = () => {
    _panelRefreshQueued = false;
    // Re-read: the panel may have been closed, or replaced by a newly
    // opened one, between queueing and now.
    const current = document.getElementById("osu-local-fav-panel");
    if (!current || typeof current._osuFavRefresh !== "function") {
      _panelRefreshForced = false;
      return;
    }
    if (!forceThisRender && current === panel && (current._osuFavRenderCount || 0) !== countAtQueueTime) {
      return; // the panel already re-rendered itself; nothing stale left
    }
    try {
      current._osuFavRefresh();
    } catch (e) {
      console.warn("[osu-local-favorites] panel refresh failed:", e);
    }
    // If an external notification arrived while this render was queued,
    // perform one authoritative follow-up instead of dropping it.
    const rerunForced = _panelRefreshForced;
    _panelRefreshForced = false;
    if (rerunForced) refreshFavoritesPanel(true);
  };

  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}
