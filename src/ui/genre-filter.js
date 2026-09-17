import { getFavorites } from "../data/storage.js";

const TAG_TRIM_PUNCT_RE = /^[\s"'.,;:!?()\[\]「」『』【】]+|[\s"'.,;:!?()\[\]「」『』【】]+$/g;
function normalizeTagText(raw) {
  let t = raw.normalize("NFKC").replace(TAG_TRIM_PUNCT_RE, "");
  return t;
}

function collectGenreAndTagTerms(favs) {
  const genreCounts = new Map(); // lowercase key -> { display, count }
  const tagCounts = new Map();
  Object.values(favs).forEach((f) => {
    const genre = (f.genre && f.genre.trim()) || "Unspecified";
    const gKey = genre.toLowerCase();
    const gEntry = genreCounts.get(gKey) || { display: genre, count: 0 };
    gEntry.count++;
    genreCounts.set(gKey, gEntry);

    const seen = new Set();
    (f.tags || "").split(/\s+/).forEach((raw) => {
      const tag = normalizeTagText(raw.trim());
      if (!tag) return;
      const tKey = tag.toLowerCase();
      if (seen.has(tKey)) return;
      seen.add(tKey);
      const tEntry = tagCounts.get(tKey) || { display: tag, count: 0 };
      tEntry.count++;
      tagCounts.set(tKey, tEntry);
    });
  });
  // A term that's ever used as an actual genre value is a genre, not a tag.
  genreCounts.forEach((_, key) => tagCounts.delete(key));
  return { genreCounts, tagCounts };
}

// Whether a favorite matches a given genre/tag filter key (both compared
// lowercase, tags run through the same NFKC-normalize + trim as the
// popover list) - true if it's that favorite's genre, or one of its tags.
export function favMatchesGenreTerm(f, key) {
  const genre = ((f.genre && f.genre.trim()) || "Unspecified").toLowerCase();
  if (genre === key) return true;
  return (f.tags || "")
    .split(/\s+/)
    .map((t) => normalizeTagText(t.trim()).toLowerCase())
    .includes(key);
}

// ── Genre + Tags filter popover ──
// 3-tap cycle per row: neutral → include (green) → exclude (red) → neutral.
// Multiple "include" terms are OR'd together; any "exclude" term is always
// dropped, even if it would otherwise match an include. currentState is
// { [lowercaseTerm]: "include" | "exclude" }; onApply is called after every
// tap with a fresh copy so the caller can re-render live without closing
// the menu. Rows are split into a "Genres" section (osu!'s own taxonomy)
// and a "Tags" section (freeform, can be large - hence the search box).
export function showGenreFilterMenu(anchorEl, currentState, onApply) {
  const existing = document.getElementById("osu-fav-genre-menu");
  const reopening = existing && existing._anchor === anchorEl;
  if (existing && existing._cleanup) existing._cleanup();
  if (reopening) return;

  const state = Object.assign({}, currentState);

  const favs = getFavorites();
  const { genreCounts, tagCounts } = collectGenreAndTagTerms(favs);
  let genreList = Array.from(genreCounts.entries())
    .map(([key, v]) => ({ key, display: v.display, count: v.count }))
    .sort((a, b) => a.display.localeCompare(b.display));
  let tagList = Array.from(tagCounts.entries())
    .map(([key, v]) => ({ key, display: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));

  const menu = document.createElement("div");
  menu.id = "osu-fav-genre-menu";
  menu._anchor = anchorEl;
  menu.style.cssText =
    "position:fixed;z-index:100002;min-width:190px;max-width:240px;max-height:360px;overflow-y:auto;" +
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

  const hint = document.createElement("div");
  hint.style.cssText = "font-size:9px;color:#666;padding:2px 6px 6px;line-height:1.4";
  hint.textContent = "Tap: include (green) → exclude (red) → off";
  menu.appendChild(hint);

  // Tags can run into the hundreds for a big library - a live filter box
  // keeps that usable instead of relying on scrolling alone.
  const searchBox = document.createElement("input");
  searchBox.type = "text";
  searchBox.placeholder = "Filter list...";
  searchBox.style.cssText =
    "width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
    "font-size:10px;padding:4px 6px;outline:none;margin-bottom:4px";
  searchBox.addEventListener("click", (e) => e.stopPropagation());
  searchBox.addEventListener("keydown", (e) => e.stopPropagation());
  menu.appendChild(searchBox);

  const rowsWrap = document.createElement("div");
  menu.appendChild(rowsWrap);

  function styleForState(s) {
    if (s === "include") return { bg: "#215a2b", border: "#3fa54a", color: "#fff" };
    if (s === "exclude") return { bg: "#5a2121", border: "#c0392b", color: "#fff" };
    return { bg: "transparent", border: "#333", color: "#ccc" };
  }

  function makeRow(term) {
    const row = document.createElement("button");
    row.type = "button";
    const sty = styleForState(state[term.key]);
    row.style.cssText =
      `display:flex;justify-content:space-between;align-items:center;gap:6px;width:100%;text-align:left;` +
      `margin:2px 0;padding:5px 8px;font-size:11px;border:1px solid ${sty.border};border-radius:3px;` +
      `background:${sty.bg};color:${sty.color};cursor:pointer;box-sizing:border-box`;
    const label = document.createElement("span");
    label.textContent = term.display;
    label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const count = document.createElement("span");
    count.textContent = term.count;
    count.style.cssText = "flex-shrink:0;opacity:0.65;font-size:10px";
    row.append(label, count);
    row.addEventListener("click", () => {
      const cur = state[term.key];
      const next = cur === undefined ? "include" : cur === "include" ? "exclude" : undefined;
      if (next === undefined) delete state[term.key];
      else state[term.key] = next;
      const s2 = styleForState(state[term.key]);
      row.style.borderColor = s2.border;
      row.style.background = s2.bg;
      row.style.color = s2.color;
      onApply(Object.assign({}, state));
    });
    return row;
  }

  // Tags can number in the hundreds/thousands for a big library - building
  // a DOM row for every single one on open was the source of multi-second
  // "click handler" jank. Cap what's actually rendered; the live filter
  // box (with its own smaller cap) is how the rest get reached.
  const MAX_UNFILTERED_TAGS = 60;
  const MAX_FILTERED_TAGS = 150;

  function renderRows(query) {
    const q = (query || "").toLowerCase();
    const filteredGenres = q ? genreList.filter((t) => t.display.toLowerCase().includes(q)) : genreList;
    const filteredTagsAll = q ? tagList.filter((t) => t.display.toLowerCase().includes(q)) : tagList;
    const cap = q ? MAX_FILTERED_TAGS : MAX_UNFILTERED_TAGS;
    const shownTags = filteredTagsAll.slice(0, cap);
    const hiddenCount = filteredTagsAll.length - shownTags.length;

    // Build off-DOM, then attach once - avoids a forced layout per row.
    const frag = document.createDocumentFragment();

    if (filteredGenres.length === 0 && shownTags.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:11px;color:#666;padding:8px 10px";
      empty.textContent = q ? "No matches." : "No favorites to filter yet.";
      frag.appendChild(empty);
    } else {
      if (filteredGenres.length) {
        const label = document.createElement("div");
        label.style.cssText = "font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.03em;padding:4px 8px 2px";
        label.textContent = "Genres";
        frag.appendChild(label);
        filteredGenres.forEach((t) => frag.appendChild(makeRow(t)));
      }
      if (shownTags.length) {
        const label = document.createElement("div");
        label.style.cssText = "font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.03em;padding:6px 8px 2px";
        label.textContent = "Tags";
        frag.appendChild(label);
        shownTags.forEach((t) => frag.appendChild(makeRow(t)));
      }
      if (hiddenCount > 0) {
        const note = document.createElement("div");
        note.style.cssText = "font-size:9px;color:#555;padding:5px 8px;line-height:1.4";
        note.textContent = `+${hiddenCount} more tag${hiddenCount === 1 ? "" : "s"} - type to narrow`;
        frag.appendChild(note);
      }
    }

    rowsWrap.innerHTML = "";
    rowsWrap.appendChild(frag);
  }
  renderRows("");
  searchBox.addEventListener("input", () => renderRows(searchBox.value.trim()));
  menu._refreshTerms = () => {
    const latest = collectGenreAndTagTerms(getFavorites());
    genreList = Array.from(latest.genreCounts.entries())
      .map(([key, v]) => ({ key, display: v.display, count: v.count }))
      .sort((a, b) => a.display.localeCompare(b.display));
    tagList = Array.from(latest.tagCounts.entries())
      .map(([key, v]) => ({ key, display: v.display, count: v.count }))
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
    renderRows(searchBox.value.trim());
  };

  if (genreList.length || tagList.length) {
    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;background:#333;margin:4px 2px";
    menu.appendChild(divider);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Clear filters";
    clearBtn.style.cssText =
      "display:block;width:100%;text-align:center;padding:5px 8px;font-size:10px;box-sizing:border-box;" +
      "border:1px solid #333;border-radius:3px;background:transparent;color:#888;cursor:pointer";
    clearBtn.addEventListener("mouseenter", () => (clearBtn.style.color = "var(--osu-fav-accent)"));
    clearBtn.addEventListener("mouseleave", () => (clearBtn.style.color = "#888"));
    clearBtn.addEventListener("click", () => {
      Object.keys(state).forEach((k) => delete state[k]);
      onApply({});
      cleanup();
    });
    menu.appendChild(clearBtn);
  }

  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  if (top + menuRect.height > window.innerHeight) top = Math.max(8, rect.top - menuRect.height - 4);
  let left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  menu.style.top = top + "px";
  menu.style.left = left + "px";

  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onWindowScroll, true);
}

// ── Collections selector popover (toolbar) ──
// Lets the user pick which collection to filter the list by ("All favorites"
// clears it), create new collections, and delete existing ones (two-tap
// confirm, matching the "Remove all favorites" pattern elsewhere).
