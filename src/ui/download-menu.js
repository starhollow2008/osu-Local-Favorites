import { GM_getValue } from "../core/gm-shim.js";
import { DL_SOURCE_PREF_KEY, DL_VIDEO_PREF_KEY, MIRRORS, isLoggedIn, isMirrorEnabled } from "../data/mirrors.js";

export function buildDownloadOptions(id) {
  const videoPref = GM_getValue(DL_VIDEO_PREF_KEY, "video");
  const sourcePref = GM_getValue(DL_SOURCE_PREF_KEY, "official");
  const loggedIn = isLoggedIn();

  let officialEntries;
  if (loggedIn) {
    officialEntries = [
      { label: "Official Download", url: `https://osu.ppy.sh/beatmapsets/${id}/download` },
      { label: "Official Download (no video)", url: `https://osu.ppy.sh/beatmapsets/${id}/download?noVideo=1` },
    ];
    if (videoPref === "novideo") officialEntries.reverse();
  } else {
    officialEntries = [{ label: "Official Download (requires sign-in)", url: `https://osu.ppy.sh/beatmapsets/${id}/download` }];
  }

  const mirrorEntries = [];
  MIRRORS.forEach((m) => {
    if (!isMirrorEnabled(m)) return;
    const variants = m.variants(id);
    if (videoPref === "novideo" && variants.length > 1) variants.reverse();
    mirrorEntries.push(...variants);
  });

  if (!loggedIn) return [...mirrorEntries, ...officialEntries];
  return sourcePref === "mirrors" ? [...mirrorEntries, ...officialEntries] : [...officialEntries, ...mirrorEntries];
}

// Shows a small popover of download options (official + enabled mirrors)
// anchored to the triggering element. Appended to <body> - not the
// scrollable panel list - so it's never clipped by overflow:auto. Closes
// on outside click, Escape, or if any ancestor (e.g. the panel list)
// scrolls out from under it.
export function showDownloadMenu(anchorEl, beatmapId) {
  const existing = document.getElementById("osu-fav-dl-menu");
  const reopening = existing && existing._anchor === anchorEl;
  if (existing && existing._cleanup) existing._cleanup();
  if (reopening) return; // Clicking the same button again just closes it

  const options = buildDownloadOptions(beatmapId);
  const menu = document.createElement("div");
  menu.id = "osu-fav-dl-menu";
  menu._anchor = anchorEl;
  menu.style.cssText =
    "position:fixed;z-index:100002;min-width:180px;max-width:240px;" +
    "background:#1a1a1a;border:1px solid #333;border-radius:4px;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.5);padding:4px;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

  function cleanup() {
    menu.remove();
    document.removeEventListener("click", onOutsideClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onWindowScroll, true);
  }
  function onOutsideClick(e) {
    if (menu.contains(e.target)) return;
    cleanup();
  }
  function onKey(e) {
    if (e.key === "Escape") cleanup();
  }
  // Only close on a scroll that moves the menu's anchor out from under it
  // (page/panel scroll) - a scroll *inside* the menu itself (e.g. the
  // scrollable genre/tag or collections list) must not close it.
  function onWindowScroll(e) {
    if (menu.contains(e.target)) return;
    cleanup();
  }
  menu._cleanup = cleanup;

  if (options.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "font-size:11px;color:#666;padding:8px 10px;line-height:1.4";
    empty.textContent = "No download source available - enable a mirror in Settings.";
    menu.appendChild(empty);
  } else {
    options.forEach((opt) => {
      const row = document.createElement("a");
      row.href = opt.url;
      row.target = "_blank";
      row.rel = "noopener";
      row.textContent = opt.label;
      row.style.cssText =
        "display:block;padding:6px 10px;font-size:11px;color:#ddd;text-decoration:none;" +
        "border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      row.addEventListener("mouseenter", () => {
        row.style.background = "var(--osu-fav-accent)";
        row.style.color = "#fff";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "transparent";
        row.style.color = "#ddd";
      });
      row.addEventListener("click", cleanup);
      menu.appendChild(row);
    });
  }

  document.body.appendChild(menu);

  // Position under the anchor, right-aligned, flipping above if it would
  // overflow the bottom of the viewport
  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  if (top + menuRect.height > window.innerHeight) top = Math.max(8, rect.top - menuRect.height - 4);
  let left = rect.right - menuRect.width;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
  menu.style.top = top + "px";
  menu.style.left = left + "px";

  // Defer attaching so this same click doesn't immediately close the menu
  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onWindowScroll, true);
}

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
