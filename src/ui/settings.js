import { GH_AUTO_BACKUP_KEY, GH_GIST_ID_KEY, GH_GIST_URL_KEY, GH_LAST_SYNC_KEY, GH_PRIVACY_KEY, GH_TOKEN_KEY, GH_USERNAME_KEY, OSU_API_CLIENT_ID_KEY, OSU_API_CLIENT_SECRET_KEY, OSU_API_USERNAME_KEY, ghFindExistingGist, ghGetGistContent, ghGetUser, parseGistId } from "../api/gist-backup.js";
import { osuApiDisconnect, osuApiIsConnected, osuApiStartAuth, performGistBackup, scheduleAutoBackup } from "../api/osu-api.js";
import { PREVIEW_FULLSONG_KEY, fullSongPreviewsEnabled } from "../api/previews.js";
import { reportError } from "../core/errors.js";
import { GM_getValue, GM_setValue } from "../core/gm-shim.js";
import { showOsuFavToast } from "../core/toast.js";
import { getCollections, setCollections } from "../data/collections.js";
import { addManyToEnrichQueue, ensureEnrichDrainerRunning, getEnrichQueue } from "../data/enrichment.js";
import { CACHE_CUSTOM_MINUTES_KEY, CACHE_DURATION_KEY, cacheClearAll, cacheCustomMinutes, cacheDurationMode, cacheStats, formatCacheBytes } from "../data/media-cache-db.js";
import { DL_DEFAULT_MIRROR_KEY, DL_SOURCE_PREF_KEY, DL_VIDEO_PREF_KEY, MIRRORS, getAllDownloadDestinations, isMirrorEnabled } from "../data/mirrors.js";
import { MUSIC_AUTONEXT_KEY, MUSIC_LOOP_KEY, MUSIC_SHUFFLE_KEY, MUSIC_VOLUME_KEY, musicAutoNextEnabled, musicLoopEnabled, musicShuffleEnabled, musicVolumePct } from "../data/playback-settings.js";
import { cancelGlobalReenrichment, isReenrichRunning, runGlobalReenrichment, updateReenrichmentUI } from "../data/reenrichment.js";
import { getFavorites, setFavorites } from "../data/storage.js";
import { AUTO_UPDATE_CHECK_KEY, autoUpdateChecksEnabled, checkVersionUpdate, getCurrentVersion } from "../data/version-check.js";
import { updateFloatingHeart } from "./floating-heart.js";
import { THEME_ACCENT_KEY, THEME_ACTIVE_OPACITY_KEY, THEME_DEFAULTS, THEME_HEART_KEY, THEME_HOVER_DIM_KEY, THEME_IDLE_DIM_KEY, THEME_IDLE_OPACITY_KEY, applyTheme, getThemeSettings } from "./theme.js";

// ═══ Settings view (⚙ in the panel header) ═══
// Everything the ⚙ pane is made of: the scroll container, the control
// builders each section is assembled from, and renderSettingsView() itself.
// Split out of what used to be a single 3,000-line ui/favorites-panel.js so
// that file is only about the favorites list; createSettingsView() at the
// bottom of this one is the whole interface between the two.

// Settings' own toast: a little wider than the page-level default, because
// these messages tend to be full sentences ("Disconnected from osu! API").
function showToast(msg) {
  showOsuFavToast(msg, "380px");
}

// ── Settings view helpers ────────────────────────────────
function sectionLabel(text) {
  const el = document.createElement("div");
  el.style.cssText =
    "font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--osu-fav-accent);padding:14px 0 8px";
  el.textContent = text;
  return el;
}

function divider() {
  const d = document.createElement("div");
  d.style.cssText = "height:1px;background:#222;margin:4px 0";
  return d;
}

function settingsRow(labelText, controlEl, subtitleText) {
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0";
  const left = document.createElement("div");
  left.style.cssText = "flex:1;min-width:0";
  const lbl = document.createElement("div");
  lbl.style.cssText = "font-size:11px;color:#ddd;font-weight:500";
  lbl.textContent = labelText;
  left.appendChild(lbl);
  if (subtitleText) {
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:10px;color:#666;margin-top:2px;line-height:1.4";
    // Usually plain text, but a row can also pass a Node/DocumentFragment
    // (e.g. to embed a real hyperlink inside the subtitle)
    if (typeof subtitleText === "string") sub.textContent = subtitleText;
    else sub.appendChild(subtitleText);
    left.appendChild(sub);
  }
  row.append(left, controlEl);
  return row;
}

// Pink pill switch - matches the accent color used throughout the panel
function makeToggleSwitch(initialOn, onChange) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  let on = initialOn;
  wrap.style.cssText = `position:relative;width:34px;height:18px;border-radius:9px;flex-shrink:0;padding:0;cursor:pointer;border:1px solid ${on ? "var(--osu-fav-accent)" : "#333"};background:${on ? "var(--osu-fav-accent)" : "#222"};transition:background .15s,border-color .15s`;
  const knob = document.createElement("span");
  knob.style.cssText = `position:absolute;top:1px;left:${on ? "17px" : "1px"};width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s`;
  wrap.appendChild(knob);
  wrap.addEventListener("click", () => {
    on = !on;
    wrap.style.background = on ? "var(--osu-fav-accent)" : "#222";
    wrap.style.borderColor = on ? "var(--osu-fav-accent)" : "#333";
    knob.style.left = on ? "17px" : "1px";
    onChange(on);
  });
  return wrap;
}

// Two/three-way segmented control - mirrors the sort-button pill style
function makeSegmented(options, initial, onChange) {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;gap:2px;background:#111;border:1px solid #333;border-radius:3px;padding:2px;flex-shrink:0";
  let current = initial;
  const btns = {};
  options.forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `font-size:10px;font-weight:500;padding:3px 10px;border:none;border-radius:2px;cursor:pointer;background:${value === current ? "var(--osu-fav-accent)" : "transparent"};color:${value === current ? "#fff" : "#666"}`;
    btn.addEventListener("click", () => {
      if (current === value) return;
      current = value;
      options.forEach((o) => {
        btns[o.value].style.background = o.value === current ? "var(--osu-fav-accent)" : "transparent";
        btns[o.value].style.color = o.value === current ? "#fff" : "#666";
      });
      onChange(current);
    });
    btns[value] = btn;
    wrap.appendChild(btn);
  });
  return wrap;
}

// Native <select> for settings with many choices - segmented pills work
// well for 2-3 options, but a real dropdown scales better once there
// are this many (every mirror × video variant, plus both Official
// variants, plus "not set").
function makeDropdown(options, initial, onChange) {
  const select = document.createElement("select");
  select.style.cssText =
    "background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
    "font-size:10px;font-family:inherit;padding:4px 6px;cursor:pointer;flex-shrink:0;max-width:150px";
  options.forEach(({ value, label }) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    if (value === initial) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

// 0–100 percentage slider with a live-updating label - used by Appearance
function makeSlider(initialPct, onChange) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;align-items:center;gap:8px;flex-shrink:0;width:130px";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.value = String(initialPct);
  slider.style.cssText = "flex:1;min-width:0;accent-color:var(--osu-fav-accent);cursor:pointer";
  const valSpan = document.createElement("span");
  valSpan.style.cssText = "font-size:10px;color:#666;width:32px;text-align:right;flex-shrink:0";
  valSpan.textContent = initialPct + "%";
  slider.addEventListener("input", () => {
    valSpan.textContent = slider.value + "%";
    onChange(Number(slider.value) / 100);
  });
  wrap.append(slider, valSpan);
  return wrap;
}

// ── Custom color picker ──
// We used to hand off to a real <input type="color">, but the
// saturation/value "plane" it opens is drawn by the browser's own
// chrome (not page content), so a userscript has zero access to it -
// on some Firefox/PC setups it drags very sluggishly and there is no
// code-side fix. Built our own instead: a plain-CSS gradient square
// for saturation/value, a gradient strip for hue, and a hex field.
// Dragging just repositions an absolutely-positioned cursor div - no
// canvas, no redraw loop, nothing outside our own DOM to be slow.

function hexToRgb(hex) {
  hex = String(hex).replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  if (Number.isNaN(num)) return { r: 255, g: 102, b: 170 }; // falls back to the original #ff66aa-ish accent
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// rAF-throttled pointer drag: reads the latest pointer position but
// only applies it once per frame, so fast mouse/finger movement can't
// queue up more work than the display can actually show.
function attachColorDrag(el, onMove) {
  let dragging = false, rafId = null, lastX = 0, lastY = 0;
  function apply() {
    rafId = null;
    const rect = el.getBoundingClientRect();
    onMove(lastX - rect.left, lastY - rect.top, rect.width, rect.height);
  }
  function point(e) {
    lastX = e.clientX; lastY = e.clientY;
    if (rafId == null) rafId = requestAnimationFrame(apply);
  }
  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    point(e);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => { if (dragging) point(e); });
  const stop = () => { dragging = false; };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
}

// Tracks whichever custom color panel is currently open (across both
// the accent and heart-color swatches) so opening one closes the other
// instead of leaving two floating at once.
let _openColorPanelCleanup = null;  // `root` is the settings scroll container this swatch lives in: an open
  // picker closes itself when that container is torn down and rebuilt, so it
  // never lingers detached from its swatch.
  function makeColorInput(root, initialHex, onChange) {
  const swatch = document.createElement("div");
  swatch.style.cssText =
    `width:40px;height:24px;border:1px solid #333;border-radius:3px;cursor:pointer;` +
    `background:${initialHex};flex-shrink:0`;

  const rgb0 = hexToRgb(initialHex);
  let hsv = rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
  let panel = null;

  function currentHex() {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return rgbToHex(r, g, b);
  }

  function openPanel() {
    if (_openColorPanelCleanup) _openColorPanelCleanup();

    panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;z-index:100002;width:200px;box-sizing:border-box;" +
      "background:#1a1a1a;border:1px solid #333;border-radius:4px;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.5);padding:10px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "display:flex;flex-direction:column;gap:8px";

    const plane = document.createElement("div");
    plane.style.cssText =
      "position:relative;width:100%;height:130px;border-radius:3px;cursor:crosshair;touch-action:none";
    const planeCursor = document.createElement("div");
    planeCursor.style.cssText =
      "position:absolute;width:12px;height:12px;border-radius:50%;" +
      "border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.6);" +
      "transform:translate(-50%,-50%);pointer-events:none";
    plane.appendChild(planeCursor);

    const hueBar = document.createElement("div");
    hueBar.style.cssText =
      "position:relative;width:100%;height:14px;border-radius:3px;cursor:pointer;touch-action:none;" +
      "background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)";
    const hueCursor = document.createElement("div");
    hueCursor.style.cssText =
      "position:absolute;top:-2px;bottom:-2px;width:4px;border-radius:2px;" +
      "background:#fff;border:1px solid #000;box-shadow:0 0 2px rgba(0,0,0,.8);" +
      "transform:translateX(-50%);pointer-events:none";
    hueBar.appendChild(hueCursor);

    const hexRow = document.createElement("div");
    hexRow.style.cssText = "display:flex;gap:6px;align-items:center";
    const preview = document.createElement("div");
    preview.style.cssText =
      "width:24px;height:24px;border:1px solid #333;border-radius:3px;flex-shrink:0";
    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.maxLength = 7;
    hexInput.style.cssText =
      "flex:1;min-width:0;box-sizing:border-box;background:#111;border:1px solid #333;" +
      "border-radius:3px;color:#ddd;font-size:11px;font-family:inherit;padding:5px 6px";
    hexRow.append(preview, hexInput);

    panel.append(plane, hueBar, hexRow);
    document.body.appendChild(panel);

    function render() {
      plane.style.background =
        `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${hsv.h},100%,50%)`;
      planeCursor.style.left = hsv.s * 100 + "%";
      planeCursor.style.top = (1 - hsv.v) * 100 + "%";
      hueCursor.style.left = (hsv.h / 360) * 100 + "%";
      const hex = currentHex();
      preview.style.background = hex;
      swatch.style.background = hex;
      if (document.activeElement !== hexInput) hexInput.value = hex;
    }
    render();

    attachColorDrag(plane, (x, y, w, h) => {
      hsv.s = Math.max(0, Math.min(1, x / w));
      hsv.v = Math.max(0, Math.min(1, 1 - y / h));
      render();
      onChange(currentHex());
    });
    attachColorDrag(hueBar, (x, y, w) => {
      hsv.h = Math.max(0, Math.min(360, (x / w) * 360));
      render();
      onChange(currentHex());
    });

    function commitHex() {
      let v = hexInput.value.trim();
      if (!/^#?[0-9a-f]{6}$/i.test(v)) { hexInput.value = currentHex(); return; }
      if (v[0] !== "#") v = "#" + v;
      const rgb = hexToRgb(v);
      hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      render();
      onChange(currentHex());
    }
    hexInput.addEventListener("change", commitHex);
    hexInput.addEventListener("keydown", (e) => { if (e.key === "Enter") hexInput.blur(); });

    // Same off-screen clamping the native-input version used: prefer
    // opening to the left (the panel this lives in is docked to the
    // right edge of the viewport), fall back to the right, clamp both.
    const w = 220, h = 210;
    const rect = swatch.getBoundingClientRect();
    let left = rect.left - w - 8;
    if (left < 8) left = rect.right + 8;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    const top = Math.max(8, Math.min(window.innerHeight - h - 8, rect.top));
    panel.style.left = left + "px";
    panel.style.top = top + "px";

    function cleanup() {
      panel.remove();
      panel = null;
      if (_openColorPanelCleanup === cleanup) _openColorPanelCleanup = null;
      document.removeEventListener("pointerdown", onOutsideDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onWindowScroll, true);
    }
    function onOutsideDown(e) {
      if (panel.contains(e.target) || e.target === swatch) return;
      cleanup();
    }
    function onKey(e) { if (e.key === "Escape") cleanup(); }
    function onWindowScroll(e) {
      if (panel.contains(e.target)) return;
      cleanup();
    }
    document.addEventListener("pointerdown", onOutsideDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onWindowScroll, true);

    panel._cleanup = cleanup;
    _openColorPanelCleanup = cleanup;
  }

  swatch.addEventListener("click", () => {
    if (panel) { panel._cleanup(); return; } // clicking again toggles it closed
    openPanel();
  });

  // Clean up an open panel if the row is ever torn down (e.g. Settings
  // re-rendered) so it doesn't linger detached from its swatch.
  root.addEventListener(
    "osu-fav-settings-teardown",
    () => { if (panel) panel._cleanup(); },
    { once: true },
  );

  return swatch;
}

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
export function createSettingsView(deps) {
  const { makeBtn, formatDate, renderList, updateCollectionsBtn, updateFooterStatus, setView } = deps;

  // The scroll container. flex:1 inside the panel's content area; hidden
  // until the gear button flips it on (see setView in ui/main-panel.js).
  const settingsView = document.createElement("div");
  settingsView.id = "osu-fav-settings";
  settingsView.style.cssText = "flex:1 1 0%;min-height:0;overflow-y:auto;display:none;padding-bottom:42px;box-sizing:border-box";

  // ── Render settings view ─────────────────────────────────
  function renderSettingsView() {
    // Clean up any real <input type="color"> elements a previous render
    // parked on <body> (see makeColorInput) before we rebuild everything.
    settingsView.dispatchEvent(new Event("osu-fav-settings-teardown"));
    settingsView.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:0 14px 20px";
    // Attach immediately (while still empty) rather than at the end of this
    // function - some sub-sections (e.g. Library Maintenance) sync their
    // initial state via document.getElementById, which only finds nodes
    // that are actually part of the live document tree.
    settingsView.appendChild(wrap);

    function appendBackupRestoreSection() {
      // ── Backup & Restore (Export / Import) ──
      wrap.appendChild(sectionLabel("Backup & Restore"));

    const backupRow = document.createElement("div");
    backupRow.style.cssText = "display:flex;gap:6px;padding-bottom:4px";

    const exportBtn = makeBtn("Export JSON", "flex:1;text-align:center;padding:6px");
    const importBtn = makeBtn("Import JSON", "flex:1;text-align:center;padding:6px");
    const importFile = document.createElement("input");
    importFile.type = "file";
    importFile.accept = ".json";
    importFile.style.display = "none";
    backupRow.append(exportBtn, importBtn, importFile);
    wrap.appendChild(backupRow);

    exportBtn.addEventListener("click", () => {
      const data = JSON.stringify(getFavorites(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `osu-favorites-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Exported!");
    });

    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      try {
        const text = await e.target.files[0].text();
        const data = JSON.parse(text);
        if (typeof data !== "object" || Array.isArray(data))
          throw new Error("Expected JSON object");
        const existing = getFavorites();
        let added = 0;
        for (const [id, fav] of Object.entries(data)) {
          if (!existing[id]) {
            existing[id] = fav;
            added++;
          }
        }
        setFavorites(existing);
        updateFloatingHeart();
        scheduleAutoBackup();
        renderList();
        showToast(`Added ${added}. Total: ${Object.keys(existing).length}`);
      } catch (err) {
        reportError("Import backup", err);
      }
      e.target.value = "";
    });

    // Collections have their own portable backup: map memberships are small
    // and useful to move independently of the (potentially much larger)
    // favorite library. The exported object deliberately matches the
    // COLLECTIONS_KEY storage format so it remains simple and future-proof.
    const collectionsRow = document.createElement("div");
    collectionsRow.style.cssText = "display:flex;gap:6px;padding-bottom:4px";
    const backupCollectionsBtn = makeBtn("Backup Collections", "flex:1;text-align:center;padding:6px");
    const importCollectionsBtn = makeBtn("Import Collections", "flex:1;text-align:center;padding:6px");
    const importCollectionsFile = document.createElement("input");
    importCollectionsFile.type = "file";
    importCollectionsFile.accept = ".json,application/json";
    importCollectionsFile.style.display = "none";
    collectionsRow.append(backupCollectionsBtn, importCollectionsBtn, importCollectionsFile);
    wrap.appendChild(collectionsRow);

    function collectionBackupUsername() {
      let username = "";
      try {
        const currentUser = document.getElementById("json-current-user");
        const user = currentUser && JSON.parse(currentUser.textContent || "{}");
        username = (user && user.username) || "";
      } catch (_) {}
      username = username || GM_getValue(OSU_API_USERNAME_KEY, "") || GM_getValue(GH_USERNAME_KEY, "") || "local";
      // Keep the suggested filename valid on Windows, Android, and macOS.
      return String(username).trim().replace(/[\\/:*?"<>|]+/g, "_") || "local";
    }

    backupCollectionsBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(getCollections(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `collections-${collectionBackupUsername()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Collections backed up!");
    });

    importCollectionsBtn.addEventListener("click", () => importCollectionsFile.click());
    importCollectionsFile.addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      try {
        const imported = JSON.parse(await e.target.files[0].text());
        if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
          throw new Error("Expected a collections JSON object");
        }

        const collections = getCollections();
        const importedMapIds = new Set();
        const byName = new Map(
          Object.entries(collections).map(([id, col]) => [String((col && col.name) || "").trim().toLowerCase(), id]),
        );
        let added = 0;
        let merged = 0;
        for (const [sourceId, source] of Object.entries(imported)) {
          if (!source || typeof source !== "object" || Array.isArray(source)) continue;
          const name = String(source.name || "Untitled").trim() || "Untitled";
          const ids = Array.isArray(source.ids) ? [...new Set(source.ids.map(String).filter(Boolean))] : [];
          ids.forEach((id) => importedMapIds.add(id));
          const nameKey = name.toLowerCase();
          const existingId = byName.get(nameKey);
          if (existingId && collections[existingId]) {
            const existingIds = Array.isArray(collections[existingId].ids) ? collections[existingId].ids.map(String) : [];
            const combined = [...new Set([...existingIds, ...ids])];
            if (combined.length !== existingIds.length) merged++;
            collections[existingId].ids = combined;
            continue;
          }

          let id = String(sourceId || "");
          while (!id || collections[id] || ["__proto__", "constructor", "prototype"].includes(id)) {
            id = "col_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          }
          collections[id] = {
            name,
            created: typeof source.created === "string" ? source.created : new Date().toISOString(),
            ids,
          };
          byName.set(nameKey, id);
          added++;
        }
        // Collections store only beatmapset IDs. Materialize any missing IDs in
        // the local favorites library as lightweight placeholders, then queue
        // them for the existing background enrichment system. This keeps the
        // collection immediately usable while resolving title/artist/covers/
        // tags/genre/language/etc. in the background without a request burst.
        const favorites = getFavorites();
        const idsToEnrich = [];
        for (const id of importedMapIds) {
          const existing = favorites[id];
          if (!existing) {
            favorites[id] = {
              id,
              url: "https://osu.ppy.sh/beatmapsets/" + id,
              favourited_at: new Date().toISOString(),
              metadata_enriched: false,
            };
            idsToEnrich.push(id);
          } else if (!existing.metadata_enriched) {
            idsToEnrich.push(id);
          }
        }
        if (idsToEnrich.length) {
          addManyToEnrichQueue(idsToEnrich);
          setFavorites(favorites);
          updateFloatingHeart();
          scheduleAutoBackup();
          ensureEnrichDrainerRunning();
        }

        setCollections(collections);
        updateCollectionsBtn();
        renderList();
        showToast(
          `Imported ${added} collection${added === 1 ? "" : "s"}${merged ? `; merged ${merged}` : ""}` +
            (idsToEnrich.length ? `; resolving ${idsToEnrich.length} map${idsToEnrich.length === 1 ? "" : "s"} in background` : ""),
        );
      } catch (err) {
        reportError("Import collections", err);
      }
      e.target.value = "";
    });

    }

    // ── About / version / update check ──
    // The project links sit at the top of the update controls, so the version
    // they refer to introduces this block instead of trailing the panel. The
    // old "Running v..." line directly above is gone with it - the version is
    // already the first thing this hint says.
    wrap.appendChild(sectionLabel("About"));
    const aboutHint = document.createElement("div");
    aboutHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:8px";
    aboutHint.innerHTML =
      "osu! Local Favorites v" + getCurrentVersion() + " - " +
      '<a href="https://github.com/starhollow2008/osu-Local-Favorites" target="_blank" rel="noopener" style="color:var(--osu-fav-accent);text-decoration:none">GitHub repository</a>' +
      " &middot; " +
      '<a href="https://github.com/starhollow2008/osu-Local-Favorites/issues" target="_blank" rel="noopener" style="color:var(--osu-fav-accent);text-decoration:none">Report an issue</a>';
    wrap.appendChild(aboutHint);

    const autoUpdateToggle = makeToggleSwitch(autoUpdateChecksEnabled(), (on) => {
      GM_setValue(AUTO_UPDATE_CHECK_KEY, on);
      showToast(on ? "Automatic update checks enabled" : "Automatic update checks disabled");
    });
    wrap.appendChild(
      settingsRow(
        "Automatic updates",
        autoUpdateToggle,
        "Check for new script versions on page load and when opening this panel",
      ),
    );

    const checkUpdateBtn = makeBtn("Check for update", "width:100%;box-sizing:border-box;text-align:center;padding:6px;margin-bottom:4px");
    wrap.appendChild(checkUpdateBtn);
    checkUpdateBtn.addEventListener("click", () => {
      checkUpdateBtn.textContent = "Checking...";
      checkUpdateBtn.disabled = true;
      checkVersionUpdate(true)
        .then((latest) => {
          if (latest) {
            showToast("Update available: v" + latest + " - reinstall from the repo to update");
            // Offer a one-click jump to the install URL
            setTimeout(() => {
              window.open(
                "https://github.com/starhollow2008/LOF/raw/main/osu-local-favorites.user.js",
                "_blank",
              );
            }, 500);
          } else {
            showToast("You're on the latest version (v" + getCurrentVersion() + ")");
          }
        })
        .catch(() => showToast("Update check failed - try again later"))
        .then(() => {
          checkUpdateBtn.textContent = "Check for update";
          checkUpdateBtn.disabled = false;
        });
    });

    wrap.appendChild(divider());

    // ── osu! API v2 (OAuth) ──
    const apiSectionStart = document.createComment("osu-api-section-start");
    wrap.appendChild(apiSectionStart);
    wrap.appendChild(sectionLabel("osu! API"));

    const apiConnected = osuApiIsConnected();
    if (!apiConnected) {
      const apiHint = document.createElement("div");
      apiHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:8px";
      apiHint.innerHTML =
        "Connect the official osu! API v2 for reliable metadata enrichment. Create an " +
        '<a href="https://osu.ppy.sh/home/account/edit#new-oauth-application" target="_blank" style="color:var(--osu-fav-accent);text-decoration:none">new OAuth application →</a>' +
        " with callback URL <code style='color:#aaa'>https://osu.ppy.sh/osu-local-favorites</code> (not the GitHub repository URL), then paste its Client ID and Secret below.";
      wrap.appendChild(apiHint);
    } else {
      // Same status row as the Gist section below: coloured dot, ellipsised
      // text, action button on the right - so a connected account reads
      // identically wherever it appears in Settings. The dot carries the
      // "connected" signal the old ✔ prefix used to, and Disconnect moved
      // into the row (it used to be a separate full-width button below).
      const apiUsername = GM_getValue(OSU_API_USERNAME_KEY, "");
      const apiStatusRow = document.createElement("div");
      apiStatusRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:10px";
      const apiStatusDot = document.createElement("span");
      apiStatusDot.style.cssText = "width:6px;height:6px;border-radius:50%;background:#4caf50;flex-shrink:0";
      const apiStatusText = document.createElement("span");
      apiStatusText.style.cssText = "font-size:11px;color:#ddd;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      apiStatusText.textContent =
        "Connected" + (apiUsername ? " as " + apiUsername : "") + " - enrichment uses the API";
      const apiRowDisconnectBtn = makeBtn("Disconnect");
      apiStatusRow.append(apiStatusDot, apiStatusText, apiRowDisconnectBtn);
      wrap.appendChild(apiStatusRow);

      apiRowDisconnectBtn.addEventListener("click", () => {
        osuApiDisconnect();
        showToast("Disconnected from osu! API");
        renderSettingsView();
      });
    }

    if (!apiConnected) {
      const apiIdInput = document.createElement("input");
      apiIdInput.type = "text";
      apiIdInput.inputMode = "numeric";
      apiIdInput.placeholder = "Client ID";
      apiIdInput.value = GM_getValue(OSU_API_CLIENT_ID_KEY, "");
      const apiSecretInput = document.createElement("input");
      apiSecretInput.type = "password";
      apiSecretInput.placeholder = "Client Secret";
      apiSecretInput.value = GM_getValue(OSU_API_CLIENT_SECRET_KEY, "");
      for (const inp of [apiIdInput, apiSecretInput]) {
        inp.style.cssText = "width:100%;box-sizing:border-box;padding:6px 10px;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;font-size:12px;outline:none;margin-bottom:6px";
        inp.addEventListener("focus", () => (inp.style.borderColor = "var(--osu-fav-accent)"));
        inp.addEventListener("blur", () => (inp.style.borderColor = "#333"));
        wrap.appendChild(inp);
      }

      const apiConnectBtn = makeBtn("Connect osu! API", "width:100%;box-sizing:border-box;text-align:center;padding:6px;margin-bottom:4px");
      wrap.appendChild(apiConnectBtn);
      apiConnectBtn.addEventListener("click", () => {
        const id = apiIdInput.value.trim();
        const secret = apiSecretInput.value.trim();
        if (!id || !secret || Number.isNaN(Number(id))) {
          showToast("Enter a valid numeric Client ID and a Secret");
          return;
        }
        GM_setValue(OSU_API_CLIENT_ID_KEY, id);
        GM_setValue(OSU_API_CLIENT_SECRET_KEY, secret);
        // Redirects to osu!'s authorize page; we resume on /osu-local-favorites?code=…
        osuApiStartAuth();
      });
    }

    wrap.appendChild(divider());
    const apiSectionEnd = document.createComment("osu-api-section-end");
    wrap.appendChild(apiSectionEnd);

    // ── GitHub Gist Backup ──
    wrap.appendChild(sectionLabel("GitHub Gist Backup"));

    const token = GM_getValue(GH_TOKEN_KEY, "");
    const username = GM_getValue(GH_USERNAME_KEY, "");

    if (!token) {
      const hint = document.createElement("div");
      hint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:8px";
      hint.innerHTML =
        "Connect a GitHub account to back up your favorites to a Gist. " +
        '<a href="https://github.com/settings/tokens/new?scopes=gist&description=osu%20Local%20Favorites" target="_blank" style="color:var(--osu-fav-accent);text-decoration:none">Create a token →</a>';
      wrap.appendChild(hint);

      const tokenInput = document.createElement("input");
      tokenInput.type = "password";
      tokenInput.placeholder = "Paste a token with 'gist' scope";
      tokenInput.style.cssText =
        "width:100%;box-sizing:border-box;padding:6px 10px;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;font-size:12px;outline:none;margin-bottom:6px";
      tokenInput.addEventListener("focus", () => (tokenInput.style.borderColor = "var(--osu-fav-accent)"));
      tokenInput.addEventListener("blur", () => (tokenInput.style.borderColor = "#333"));
      wrap.appendChild(tokenInput);

      const connectBtn = makeBtn("Connect GitHub", "width:100%;box-sizing:border-box;text-align:center;padding:6px");
      wrap.appendChild(connectBtn);

      connectBtn.addEventListener("click", () => {
        const t = tokenInput.value.trim();
        if (!t) {
          showToast("Enter a token first");
          return;
        }
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;
        ghGetUser(t)
          .then((user) => {
            GM_setValue(GH_TOKEN_KEY, t);
            GM_setValue(GH_USERNAME_KEY, user.login);
            return ghFindExistingGist(t).then((found) => {
              if (found) {
                GM_setValue(GH_GIST_ID_KEY, found.id);
                GM_setValue(GH_GIST_URL_KEY, found.html_url || "");
                showToast("Connected - linked existing backup gist");
              } else {
                showToast("Connected as " + user.login);
              }
            });
          })
          .catch((err) => reportError("GitHub connect", err))
          .then(() => {
            renderSettingsView();
            updateFooterStatus();
          });
      });

      // Public gists can be read without authentication. Keep this import
      // path available before connection: it deliberately does not set the
      // backup target, so connecting/backing up later remains independent.
      const fetchRow = document.createElement("div");
      fetchRow.style.cssText = "display:flex;gap:6px;margin-top:10px";
      const fetchInput = document.createElement("input");
      fetchInput.type = "text";
      fetchInput.placeholder = "Gist ID or URL";
      fetchInput.style.cssText =
        "flex:1;min-width:0;box-sizing:border-box;padding:6px 10px;background:#111;" +
        "border:1px solid #333;border-radius:3px;color:#ddd;font-size:11px;outline:none";
      fetchInput.addEventListener("focus", () => (fetchInput.style.borderColor = "var(--osu-fav-accent)"));
      fetchInput.addEventListener("blur", () => (fetchInput.style.borderColor = "#333"));
      const fetchBtn = makeBtn("Fetch", "flex-shrink:0;padding:6px 12px");
      fetchRow.append(fetchInput, fetchBtn);
      wrap.appendChild(fetchRow);

      const fetchHint = document.createElement("div");
      fetchHint.style.cssText = "font-size:10px;color:#666;margin-top:4px;line-height:1.4";
      fetchHint.textContent =
        "Pull from any gist - your own or someone else's shared list - without " +
        "changing what Backup now targets. Handy on a new device before your first backup.";
      wrap.appendChild(fetchHint);

      fetchBtn.addEventListener("click", () => {
        const raw = fetchInput.value.trim();
        if (!raw) {
          showToast("Paste a gist ID or URL first");
          return;
        }
        const gistId = parseGistId(raw);
        fetchBtn.textContent = "Fetching...";
        fetchBtn.disabled = true;
        ghGetGistContent("", gistId)
          .then((data) => {
            if (typeof data !== "object" || Array.isArray(data)) {
              throw new Error("Malformed backup data");
            }
            const existing = getFavorites();
            let added = 0;
            for (const [id, fav] of Object.entries(data)) {
              if (!existing[id]) {
                existing[id] = fav;
                added++;
              }
            }
            setFavorites(existing);
            updateFloatingHeart();
            renderList();
            fetchInput.value = "";
            showToast(`Fetched - added ${added} maps`);
          })
          .catch((err) => reportError("Gist fetch", err))
          .then(() => {
            fetchBtn.disabled = false;
            fetchBtn.textContent = "Fetch";
          });
      });
    } else {
      const statusRow = document.createElement("div");
      statusRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:10px";
      const dot = document.createElement("span");
      dot.style.cssText = "width:6px;height:6px;border-radius:50%;background:#4caf50;flex-shrink:0";
      const statusText = document.createElement("span");
      statusText.style.cssText = "font-size:11px;color:#ddd;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      statusText.textContent = "Connected as " + (username || "GitHub user");
      const disconnectBtn = makeBtn("Disconnect");
      statusRow.append(dot, statusText, disconnectBtn);
      wrap.appendChild(statusRow);

      disconnectBtn.addEventListener("click", () => {
        GM_setValue(GH_TOKEN_KEY, "");
        GM_setValue(GH_USERNAME_KEY, "");
        GM_setValue(GH_AUTO_BACKUP_KEY, false);
        showToast("Disconnected from GitHub");
        renderSettingsView();
        updateFooterStatus();
      });

      const autoOn = GM_getValue(GH_AUTO_BACKUP_KEY, false);
      const autoToggle = makeToggleSwitch(autoOn, (on) => {
        GM_setValue(GH_AUTO_BACKUP_KEY, on);
        showToast(on ? "Auto-backup enabled" : "Switched to manual backup");
        updateFooterStatus();
        if (on) scheduleAutoBackup();
      });
      wrap.appendChild(
        settingsRow("Auto-backup", autoToggle, "Automatically push newly added maps to the Gist"),
      );

      const privacy = GM_getValue(GH_PRIVACY_KEY, "private");
      const privacyControl = makeSegmented(
        [
          { value: "private", label: "Private" },
          { value: "public", label: "Public" },
        ],
        privacy,
        (val) => {
          GM_setValue(GH_PRIVACY_KEY, val);
          const existingGistId = GM_getValue(GH_GIST_ID_KEY, "");
          if (existingGistId) {
            GM_setValue(GH_GIST_ID_KEY, "");
            GM_setValue(GH_GIST_URL_KEY, "");
            showToast("Visibility changed - a new gist will be created on next backup");
            renderSettingsView();
          }
        },
      );
      wrap.appendChild(
        settingsRow("Gist visibility", privacyControl, "GitHub can't change visibility later, so switching creates a new gist"),
      );

      const actionRow = document.createElement("div");
      actionRow.style.cssText = "display:flex;gap:6px;margin-top:10px";
      const backupNowBtn = makeBtn("Backup now", "flex:1;text-align:center;padding:6px");
      const restoreBtn = makeBtn("Restore from Gist", "flex:1;text-align:center;padding:6px");
      const gistIdNow = GM_getValue(GH_GIST_ID_KEY, "");
      if (!gistIdNow) restoreBtn.style.opacity = "0.5";
      actionRow.append(backupNowBtn, restoreBtn);
      wrap.appendChild(actionRow);

      backupNowBtn.addEventListener("click", () => {
        backupNowBtn.textContent = "Backing up...";
        backupNowBtn.disabled = true;
        performGistBackup()
          .then(() => {
            showToast("Backup complete!");
            updateFooterStatus();
            renderSettingsView();
          })
          .catch((err) => reportError("Gist backup", err))
          .then(() => {
            backupNowBtn.disabled = false;
            backupNowBtn.textContent = "Backup now";
          });
      });

      restoreBtn.addEventListener("click", () => {
        const gistId = GM_getValue(GH_GIST_ID_KEY, "");
        if (!gistId) {
          showToast("No backup gist linked yet - run a backup first");
          return;
        }
        restoreBtn.textContent = "Restoring...";
        restoreBtn.disabled = true;
        ghGetGistContent(token, gistId)
          .then((data) => {
            if (typeof data !== "object" || Array.isArray(data))
              throw new Error("Malformed backup data");
            const existing = getFavorites();
            let added = 0;
            for (const [id, fav] of Object.entries(data)) {
              if (!existing[id]) {
                existing[id] = fav;
                added++;
              }
            }
            setFavorites(existing);
            updateFloatingHeart();
            renderList();
            showToast(`Restored ${added} maps from Gist backup`);
          })
          .catch((err) => reportError("Gist restore", err))
          .then(() => {
            restoreBtn.disabled = false;
            restoreBtn.textContent = "Restore from Gist";
          });
      });

      const fetchRow = document.createElement("div");
      fetchRow.style.cssText = "display:flex;gap:6px;margin-top:6px";
      const fetchInput = document.createElement("input");
      fetchInput.type = "text";
      fetchInput.placeholder = "Gist ID or URL";
      fetchInput.style.cssText =
        "flex:1;min-width:0;box-sizing:border-box;padding:6px 10px;background:#111;" +
        "border:1px solid #333;border-radius:3px;color:#ddd;font-size:11px;outline:none";
      fetchInput.addEventListener("focus", () => (fetchInput.style.borderColor = "var(--osu-fav-accent)"));
      fetchInput.addEventListener("blur", () => (fetchInput.style.borderColor = "#333"));
      const fetchBtn = makeBtn("Fetch", "flex-shrink:0;padding:6px 12px");
      fetchRow.append(fetchInput, fetchBtn);
      wrap.appendChild(fetchRow);

      const fetchHint = document.createElement("div");
      fetchHint.style.cssText = "font-size:10px;color:#666;margin-top:4px;line-height:1.4";
      fetchHint.textContent =
        "Pull from any gist - your own or someone else's shared list - without " +
        "changing what Backup now targets. Handy on a new device before your first backup.";
      wrap.appendChild(fetchHint);

      fetchBtn.addEventListener("click", () => {
        const raw = fetchInput.value.trim();
        if (!raw) {
          showToast("Paste a gist ID or URL first");
          return;
        }
        const gistId = parseGistId(raw);
        fetchBtn.textContent = "Fetching...";
        fetchBtn.disabled = true;
        ghGetGistContent(token, gistId)
          .then((data) => {
            if (typeof data !== "object" || Array.isArray(data))
              throw new Error("Malformed backup data");
            const existing = getFavorites();
            let added = 0;
            for (const [id, fav] of Object.entries(data)) {
              if (!existing[id]) {
                existing[id] = fav;
                added++;
              }
            }
            setFavorites(existing);
            updateFloatingHeart();
            scheduleAutoBackup();
            renderList();
            fetchInput.value = "";
            showToast(`Fetched - added ${added} maps`);
          })
          .catch((err) => reportError("Gist fetch", err))
          .then(() => {
            fetchBtn.disabled = false;
            fetchBtn.textContent = "Fetch";
          });
      });

      const gistUrl = GM_getValue(GH_GIST_URL_KEY, "");
      const lastSync = GM_getValue(GH_LAST_SYNC_KEY, 0);
      const syncInfo = document.createElement("div");
      syncInfo.style.cssText =
        "font-size:10px;color:#666;margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:8px";
      const syncText = document.createElement("span");
      syncText.textContent = lastSync
        ? "Last synced " + formatDate(new Date(lastSync).toISOString())
        : "Not yet synced";
      syncInfo.appendChild(syncText);
      if (gistUrl) {
        const viewLink = document.createElement("a");
        viewLink.href = gistUrl;
        viewLink.target = "_blank";
        viewLink.textContent = "View on GitHub →";
        viewLink.style.cssText = "color:var(--osu-fav-accent);text-decoration:none;flex-shrink:0";
        syncInfo.appendChild(viewLink);
      }
      wrap.appendChild(syncInfo);
    }

    appendBackupRestoreSection();
    wrap.appendChild(divider());

    // ── Download Mirrors ──
    wrap.appendChild(sectionLabel("Download Mirrors"));
    const mirrorHint = document.createElement("div");
    mirrorHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:4px";
    mirrorHint.textContent =
      "osu!'s own download requires being signed in, and some maps have downloads " +
      "disabled entirely. Enable mirrors below to download anyway - they're offered " +
      "on the Download button in this panel and injected on beatmap pages.";
    wrap.appendChild(mirrorHint);
    MIRRORS.forEach((mirror) => {
      const toggle = makeToggleSwitch(isMirrorEnabled(mirror), (on) => {
        GM_setValue(mirror.settingKey, on);
      });
      wrap.appendChild(settingsRow(mirror.label, toggle));
    });

    const defaultMirrorControl = makeDropdown(
      [{ value: "", label: "Not set - show options" }, ...getAllDownloadDestinations().map((d) => ({ value: d.key, label: d.label }))],
      GM_getValue(DL_DEFAULT_MIRROR_KEY, ""),
      (val) => GM_setValue(DL_DEFAULT_MIRROR_KEY, val),
    );
    wrap.appendChild(
      settingsRow(
        "Default download mirror",
        defaultMirrorControl,
        "Skips the dropdown and downloads straight from this source. Falls back to showing the dropdown if it's disabled or unavailable (e.g. Official while signed out).",
      ),
    );

    const videoPrefControl = makeSegmented(
      [
        { value: "video", label: "With video" },
        { value: "novideo", label: "No video" },
      ],
      GM_getValue(DL_VIDEO_PREF_KEY, "video"),
      (val) => GM_setValue(DL_VIDEO_PREF_KEY, val),
    );
    wrap.appendChild(
      settingsRow("Preferred video option", videoPrefControl, "Only reorders - every option stays available in the dropdown"),
    );

    const sourcePrefControl = makeSegmented(
      [
        { value: "official", label: "Official first" },
        { value: "mirrors", label: "Mirrors first" },
      ],
      GM_getValue(DL_SOURCE_PREF_KEY, "official"),
      (val) => GM_setValue(DL_SOURCE_PREF_KEY, val),
    );
    wrap.appendChild(
      settingsRow("Preferred source order", sourcePrefControl, "Guests always see mirrors first - Official won't work without signing in"),
    );

    wrap.appendChild(divider());

    // ── Music Playback ──
    wrap.appendChild(sectionLabel("Music Playback"));
    const fullSongHint = document.createElement("div");
    fullSongHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:4px";
    fullSongHint.textContent =
      "The ▶ preview button in this panel plays osu!'s own ~10s clip by default. " +
      "Hinamizawa's music mirror streams the full track instead whenever it has one " +
      "cached, and falls back to that same clip automatically when it doesn't.";
    wrap.appendChild(fullSongHint);
    const fullSongToggle = makeToggleSwitch(fullSongPreviewsEnabled(), (on) => {
      GM_setValue(PREVIEW_FULLSONG_KEY, on);
    });
    const fullSongSubtitle = document.createDocumentFragment();
    const hinaLink = document.createElement("a");
    hinaLink.href = "https://mirror.hinamizawa.ai";
    hinaLink.target = "_blank";
    hinaLink.rel = "noopener";
    hinaLink.textContent = "mirror.hinamizawa.ai";
    hinaLink.style.cssText = "color:var(--osu-fav-accent);text-decoration:none";
    hinaLink.addEventListener("mouseenter", () => (hinaLink.style.textDecoration = "underline"));
    hinaLink.addEventListener("mouseleave", () => (hinaLink.style.textDecoration = "none"));
    fullSongSubtitle.append("Streams from ", hinaLink, " - no login required");
    wrap.appendChild(settingsRow("Full-length previews", fullSongToggle, fullSongSubtitle));

    const loopToggle = makeToggleSwitch(musicLoopEnabled(), (on) => {
      GM_setValue(MUSIC_LOOP_KEY, on);
    });
    wrap.appendChild(
      settingsRow("Loop track", loopToggle, "Replays the current song instead of stopping when it ends"),
    );

    const autoNextToggle = makeToggleSwitch(musicAutoNextEnabled(), (on) => {
      GM_setValue(MUSIC_AUTONEXT_KEY, on);
    });
    wrap.appendChild(
      settingsRow("Auto next", autoNextToggle, "Plays the next favorite automatically when a track ends - ignored while Loop track is on"),
    );

    const shuffleToggle = makeToggleSwitch(musicShuffleEnabled(), (on) => {
      GM_setValue(MUSIC_SHUFFLE_KEY, on);
    });
    wrap.appendChild(
      settingsRow("Shuffle", shuffleToggle, "Picks the next favorite at random instead of going in list order"),
    );

    const volumeSlider = makeSlider(musicVolumePct(), (frac) => {
      const pct = Math.round(frac * 100);
      GM_setValue(MUSIC_VOLUME_KEY, pct);
      // Applied immediately to whatever's already playing, not just future
      // playback - the audio element is a tab-lifetime singleton, so
      // without this the change wouldn't take effect until the next track.
      if (window._osuFavAudio) window._osuFavAudio.volume = frac;
    });
    wrap.appendChild(
      settingsRow("Preview volume", volumeSlider, "Applies to both the panel's preview player and the Now Playing bar"),
    );

    wrap.appendChild(divider());

    // ── Media Cache ──
    wrap.appendChild(sectionLabel("Media Cache"));
    const cacheHint = document.createElement("div");
    cacheHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:4px";
    cacheHint.textContent =
      "Background covers and preview clips are stored locally so reloading the page or " +
      "reopening the panel doesn't re-request them. Songs are written as they stream, so " +
      "a track that was interrupted half-way resumes instead of downloading again; a " +
      "fully cached song then plays from disk with no network request at all. \"Never\" " +
      "turns this off entirely; \"Always\" keeps a cached copy until you clear it below.";
    wrap.appendChild(cacheHint);

    const cacheDurationControl = makeDropdown(
      [
        { value: "custom", label: "Custom..." },
        { value: "30min", label: "30 minutes" },
        { value: "1h", label: "1 hour" },
        { value: "6h", label: "6 hours" },
        { value: "12h", label: "12 hours" },
        { value: "24h", label: "24 hours" },
        { value: "1week", label: "1 week" },
        { value: "1month", label: "1 month" },
        { value: "always", label: "Always" },
        { value: "never", label: "Never" },
      ],
      cacheDurationMode(),
      (val) => {
        GM_setValue(CACHE_DURATION_KEY, val);
        renderSettingsView(); // reveal/hide the custom-minutes row below
      },
    );
    wrap.appendChild(
      settingsRow(
        "Cache duration",
        cacheDurationControl,
        "How long a cached cover/preview stays valid before it's re-fetched",
      ),
    );

    if (cacheDurationMode() === "custom") {
      const customInput = document.createElement("input");
      customInput.type = "number";
      customInput.min = "1";
      customInput.step = "1";
      customInput.value = String(cacheCustomMinutes());
      customInput.style.cssText =
        "width:70px;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
        "font-size:10px;font-family:inherit;padding:4px 6px;flex-shrink:0";
      customInput.addEventListener("change", () => {
        const n = Math.max(1, Math.round(Number(customInput.value) || 60));
        customInput.value = String(n);
        GM_setValue(CACHE_CUSTOM_MINUTES_KEY, n);
      });
      wrap.appendChild(settingsRow("Custom duration (minutes)", customInput));
    }

    const cacheStatsText = document.createElement("div");
    cacheStatsText.style.cssText = "font-size:10px;color:#666;margin:4px 0 8px";
    cacheStatsText.textContent = "Checking cache size…";
    wrap.appendChild(cacheStatsText);
    cacheStats().then(({ count, bytes, partialBytes }) => {
      const partialNote = partialBytes ? ` (+${formatCacheBytes(partialBytes)} in progress)` : "";
      cacheStatsText.textContent = count || partialBytes
        ? `${count} item${count === 1 ? "" : "s"} cached, ${formatCacheBytes(bytes)}${partialNote}`
        : "Nothing cached yet";
    });

    const clearCacheBtn = makeBtn("Clear cache", "width:100%;box-sizing:border-box;text-align:center;padding:6px");
    clearCacheBtn.addEventListener("click", () => {
      clearCacheBtn.disabled = true;
      clearCacheBtn.textContent = "Clearing…";
      cacheClearAll().then(() => {
        clearCacheBtn.disabled = false;
        clearCacheBtn.textContent = "Clear cache";
        cacheStatsText.textContent = "Nothing cached yet";
      });
    });
    wrap.appendChild(clearCacheBtn);

    wrap.appendChild(divider());

    // ── Appearance ──
    wrap.appendChild(sectionLabel("Appearance"));
    const theme = getThemeSettings();

    const colorSwatch = makeColorInput(settingsView, theme.accent, (hex) => {
      GM_setValue(THEME_ACCENT_KEY, hex);
      applyTheme();
    });
    wrap.appendChild(settingsRow("Accent color", colorSwatch));

    const heartColorSwatch = makeColorInput(settingsView, theme.heartColor, (hex) => {
      GM_setValue(THEME_HEART_KEY, hex);
      applyTheme();
    });
    wrap.appendChild(
      settingsRow(
        "Heart fill color",
        heartColorSwatch,
        "Independent of accent - keeps our heart distinct from osu!'s own",
      ),
    );

    wrap.appendChild(
      settingsRow(
        "Play button idle opacity",
        makeSlider(Math.round(theme.idleOpacity * 100), (v) => {
          GM_setValue(THEME_IDLE_OPACITY_KEY, v);
          applyTheme();
        }),
      ),
    );
    wrap.appendChild(
      settingsRow(
        "Cover dim on idle",
        makeSlider(Math.round(theme.idleDim * 100), (v) => {
          GM_setValue(THEME_IDLE_DIM_KEY, v);
          applyTheme();
        }),
        "Baseline darkening on cover art before you hover - 0 leaves it untouched",
      ),
    );
    wrap.appendChild(
      settingsRow(
        "Cover dim on hover",
        makeSlider(Math.round(theme.hoverDim * 100), (v) => {
          GM_setValue(THEME_HOVER_DIM_KEY, v);
          applyTheme();
        }),
      ),
    );
    wrap.appendChild(
      settingsRow(
        "Play button active opacity",
        makeSlider(Math.round(theme.activeOpacity * 100), (v) => {
          GM_setValue(THEME_ACTIVE_OPACITY_KEY, v);
          applyTheme();
        }),
      ),
    );

    const resetThemeBtn = makeBtn(
      "Reset appearance to defaults",
      "width:100%;box-sizing:border-box;text-align:center;padding:6px;margin-top:6px",
    );
    resetThemeBtn.addEventListener("click", () => {
      GM_setValue(THEME_ACCENT_KEY, THEME_DEFAULTS.accent);
      GM_setValue(THEME_HEART_KEY, THEME_DEFAULTS.heartColor);
      GM_setValue(THEME_IDLE_OPACITY_KEY, THEME_DEFAULTS.idleOpacity);
      GM_setValue(THEME_IDLE_DIM_KEY, THEME_DEFAULTS.idleDim);
      GM_setValue(THEME_HOVER_DIM_KEY, THEME_DEFAULTS.hoverDim);
      GM_setValue(THEME_ACTIVE_OPACITY_KEY, THEME_DEFAULTS.activeOpacity);
      applyTheme();
      renderSettingsView();
    });
    wrap.appendChild(resetThemeBtn);

    wrap.appendChild(divider());

    // ── Library Maintenance ──
    wrap.appendChild(sectionLabel("Library Maintenance"));
    const maintHint = document.createElement("div");
    maintHint.style.cssText = "font-size:10px;color:#666;line-height:1.5;margin-bottom:8px";
    maintHint.textContent =
      "Re-fetches full metadata - tags, source, genre, language, BPM, status, cover - " +
      "for every favorited map. Useful if fields look stale or were saved in an older, " +
      "differently-formatted version. Runs one map at a time to respect osu!'s rate limits.";
    wrap.appendChild(maintHint);

    const currentFavorites = getFavorites();
    const queueLen = getEnrichQueue().filter(
      (id) => currentFavorites[id] && !currentFavorites[id].metadata_enriched,
    ).length;
    if (queueLen > 0) {
      const queueNote = document.createElement("div");
      queueNote.style.cssText = "font-size:10px;color:var(--osu-fav-accent);line-height:1.5;margin-bottom:8px";
      queueNote.textContent =
        `${queueLen} map${queueLen === 1 ? "" : "s"} missing genre/tags/language - ` +
        "filling in automatically in the background as you browse (no need to run the button below for these).";
      wrap.appendChild(queueNote);
    }

    const reenrichBtn = document.createElement("button");
    reenrichBtn.id = "osu-fav-reenrich-btn";
    reenrichBtn.style.cssText =
      "font-size:10px;padding:6px 10px;border:1px solid #333;border-radius:3px;background:transparent;color:#999;cursor:pointer;width:100%;box-sizing:border-box";
    reenrichBtn.addEventListener("mouseenter", () => {
      if (!isReenrichRunning()) {
        reenrichBtn.style.borderColor = "var(--osu-fav-accent)";
        reenrichBtn.style.color = "var(--osu-fav-accent)";
      }
    });
    reenrichBtn.addEventListener("mouseleave", () => {
      if (!isReenrichRunning()) {
        reenrichBtn.style.borderColor = "#333";
        reenrichBtn.style.color = "#999";
      }
    });
    reenrichBtn.addEventListener("click", () => {
      if (isReenrichRunning()) cancelGlobalReenrichment();
      else runGlobalReenrichment();
    });
    wrap.appendChild(reenrichBtn);

    const reenrichProgress = document.createElement("div");
    reenrichProgress.id = "osu-fav-reenrich-progress";
    reenrichProgress.style.cssText = "display:none;margin-top:8px";
    const reenrichBarTrack = document.createElement("div");
    reenrichBarTrack.style.cssText = "height:4px;background:#333;border-radius:2px;overflow:hidden";
    const reenrichBar = document.createElement("div");
    reenrichBar.id = "osu-fav-reenrich-bar";
    reenrichBar.style.cssText = "height:100%;width:0%;background:var(--osu-fav-accent);border-radius:2px;transition:width .2s";
    reenrichBarTrack.appendChild(reenrichBar);
    const reenrichText = document.createElement("div");
    reenrichText.id = "osu-fav-reenrich-text";
    reenrichText.style.cssText = "font-size:10px;color:#666;margin-top:4px;text-align:center";
    reenrichProgress.append(reenrichBarTrack, reenrichText);
    wrap.appendChild(reenrichProgress);

    // Sync button label/progress bar to the real state in case a run is
    // already in flight (e.g. started, then user switched view and back)
    updateReenrichmentUI(false, false);

    wrap.appendChild(divider());

    // ── Danger Zone ──
    wrap.appendChild(sectionLabel("Danger Zone"));
    const removeAllBtn = document.createElement("button");
    removeAllBtn.textContent = "Remove all favorites";
    removeAllBtn.style.cssText =
      "font-size:10px;padding:6px 10px;border:1px solid #555;border-radius:3px;background:none;color:#888;cursor:pointer;width:100%";
    wrap.appendChild(removeAllBtn);

    let confirmingRemoveAll = false;
    removeAllBtn.addEventListener("click", () => {
      if (!confirmingRemoveAll) {
        confirmingRemoveAll = true;
        removeAllBtn.textContent = "Click again to confirm";
        removeAllBtn.style.cssText =
          "font-size:10px;padding:6px 10px;border:1px solid #ff4444;border-radius:3px;background:#ff4444;color:#fff;cursor:pointer;width:100%;font-weight:600";
        setTimeout(() => {
          if (confirmingRemoveAll) {
            confirmingRemoveAll = false;
            removeAllBtn.textContent = "Remove all favorites";
            removeAllBtn.style.cssText =
              "font-size:10px;padding:6px 10px;border:1px solid #555;border-radius:3px;background:none;color:#888;cursor:pointer;width:100%";
          }
        }, 3000);
      } else {
        setFavorites({});
        updateFloatingHeart();
        scheduleAutoBackup();
        renderList();
        showToast("All favorites removed");
        setView(false);
      }
    });

    // Keep the osu! API controls at the top of Settings regardless of the
    // order in which the remaining settings sections are assembled above.
    const apiInsertBefore = wrap.firstChild;
    let apiNode = apiSectionStart.nextSibling;
    while (apiNode && apiNode !== apiSectionEnd) {
      const next = apiNode.nextSibling;
      wrap.insertBefore(apiNode, apiInsertBefore);
      apiNode = next;
    }
    apiSectionStart.remove();
    apiSectionEnd.remove();
  }

  // Handed back to the panel: the container to mount, and the render entry
  // point its setView() calls (and the pane itself calls after any change
  // that alters what should be on screen).
  return { element: settingsView, render: renderSettingsView };
}
