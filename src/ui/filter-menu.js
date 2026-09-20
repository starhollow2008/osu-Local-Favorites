// ── Generic filter popover ──
// One popover implementation shared by every toolbar filter (Date, Title,
// Artist, Status, Genre). It was previously written once, inline, for the
// genre filter; every other toolbar button was sort-only. Generalising it
// here is what lets all five categories behave identically:
//
//   3-tap cycle per row: neutral -> include (green) -> exclude (red) -> neutral
//
// Within one category, "include" terms are OR'd together and any "exclude"
// term always drops the entry, even if it would otherwise match an include.
// (Across categories the results are AND'd - see data model in ui/filters.js.)
//
// `state` is { [termKey]: "include" | "exclude" }; onApply is called after
// every tap with a fresh copy, so the caller re-renders live without the
// menu closing.
//
// `config`:
//   collect()      -> [{ label, terms: [{ key, display, count }], cap? }]
//   hint           -> the small explainer line at the top
//   searchable     -> show the live filter box (for long lists)
//   placeholder    -> filter box placeholder
//   emptyText      -> shown when collect() returns nothing at all
//   sortOptions    -> [{ asc, label }] pinned above everything else - the
//                     category's own two-way sort (Newest/Oldest, A-Z/Z-A).
//                     Omitted entirely for a category with no natural order
//                     (Status). Selecting one re-sorts the whole list; it is
//                     a single live choice, not an include/exclude term, so
//                     it has no neutral state and clicking the active option
//                     again is a no-op.
//   isSortActive   -> whether THIS category currently drives the list order
//   sortAsc        -> current direction, meaningful only if isSortActive
//   onSortSelect(asc) -> called on a sort pick; omitted if sortOptions is

const MENU_ID = "osu-fav-filter-menu";

// Long lists (tags, artists) used to build a DOM row per term on open,
// which is where the multi-second "click handler" jank came from. Rows are
// capped; the live filter box (with its own larger cap) reaches the rest.
const DEFAULT_CAP_UNFILTERED = 60;
const DEFAULT_CAP_FILTERED = 150;

export function showFilterMenu(anchorEl, config, currentState, onApply) {
  const existing = document.getElementById(MENU_ID);
  const reopening = existing && existing._anchor === anchorEl;
  if (existing && existing._cleanup) existing._cleanup();
  if (reopening) return; // second tap on the same button closes it

  const state = Object.assign({}, currentState);
  let sections = config.collect() || [];

  const menu = document.createElement("div");
  menu.id = MENU_ID;
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
  // (page/panel scroll) - a scroll *inside* the menu itself must not close it.
  function onWindowScroll(e) {
    if (menu.contains(e.target)) return;
    cleanup();
  }
  menu._cleanup = cleanup;

  const hint = document.createElement("div");
  hint.style.cssText = "font-size:9px;color:#666;padding:2px 6px 6px;line-height:1.4";
  hint.textContent = config.hint || "Tap: include (green) \u2192 exclude (red) \u2192 off";
  menu.appendChild(hint);

  // ── Sort row ──
  // Sits above the term list because it answers a different question
  // ("what order is the whole list in") from everything below it ("which
  // rows are in the list at all"). A single live choice - no neutral state,
  // so the two options just swap which one is highlighted.
  if (config.sortOptions && config.sortOptions.length && config.onSortSelect) {
    const sortLabel = document.createElement("div");
    sortLabel.style.cssText =
      "font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.03em;padding:0 6px 3px";
    sortLabel.textContent = "Sort";
    menu.appendChild(sortLabel);

    const sortRow = document.createElement("div");
    sortRow.style.cssText = "display:flex;gap:4px;padding:0 2px 6px";
    const sortBtnEls = [];
    const paintSort = () => {
      sortBtnEls.forEach((b) => {
        const on = config.isSortActive && config.sortAsc === b._asc;
        b.style.borderColor = on ? "var(--osu-fav-accent)" : "#333";
        b.style.background = on ? "var(--osu-fav-accent)" : "transparent";
        b.style.color = on ? "#fff" : "#999";
      });
    };
    config.sortOptions.forEach((opt) => {
      const sBtn = document.createElement("button");
      sBtn.type = "button";
      sBtn._asc = opt.asc;
      sBtn.textContent = opt.label;
      sBtn.style.cssText =
        "flex:1;min-width:0;font-size:10px;font-weight:500;padding:4px 4px;border-radius:3px;" +
        "cursor:pointer;box-sizing:border-box;border:1px solid #333;background:transparent;color:#999";
      sBtn.addEventListener("click", () => {
        if (config.isSortActive && config.sortAsc === opt.asc) return; // already active
        config.isSortActive = true;
        config.sortAsc = opt.asc;
        paintSort();
        config.onSortSelect(opt.asc);
      });
      sortBtnEls.push(sBtn);
      sortRow.appendChild(sBtn);
    });
    paintSort();
    menu.appendChild(sortRow);

    const sortDivider = document.createElement("div");
    sortDivider.style.cssText = "height:1px;background:#333;margin:0 2px 6px";
    menu.appendChild(sortDivider);
  }

  let searchBox = null;
  if (config.searchable) {
    searchBox = document.createElement("input");
    searchBox.type = "text";
    searchBox.placeholder = config.placeholder || "Filter list...";
    searchBox.style.cssText =
      "width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
      "font-size:10px;padding:4px 6px;outline:none;margin-bottom:4px";
    searchBox.addEventListener("click", (e) => e.stopPropagation());
    searchBox.addEventListener("keydown", (e) => e.stopPropagation());
    menu.appendChild(searchBox);
  }

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
      "display:flex;justify-content:space-between;align-items:center;gap:6px;width:100%;text-align:left;" +
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

  function renderRows(query) {
    const q = (query || "").toLowerCase();
    // Build off-DOM, then attach once - avoids a forced layout per row.
    const frag = document.createDocumentFragment();
    let shownAny = false;
    let hiddenTotal = 0;

    sections.forEach((section) => {
      const all = q
        ? section.terms.filter((t) => t.display.toLowerCase().includes(q))
        : section.terms;
      const cap = section.cap === false
        ? Infinity
        : q
          ? section.capFiltered || DEFAULT_CAP_FILTERED
          : section.capUnfiltered || DEFAULT_CAP_UNFILTERED;
      const shown = all.length > cap ? all.slice(0, cap) : all;
      hiddenTotal += all.length - shown.length;
      if (!shown.length) return;
      shownAny = true;
      if (section.label) {
        const label = document.createElement("div");
        label.style.cssText =
          "font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.03em;padding:5px 8px 2px";
        label.textContent = section.label;
        frag.appendChild(label);
      }
      shown.forEach((t) => frag.appendChild(makeRow(t)));
    });

    if (!shownAny) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:11px;color:#666;padding:8px 10px";
      empty.textContent = q ? "No matches." : config.emptyText || "Nothing to filter yet.";
      frag.appendChild(empty);
    } else if (hiddenTotal > 0) {
      const note = document.createElement("div");
      note.style.cssText = "font-size:9px;color:#555;padding:5px 8px;line-height:1.4";
      note.textContent = `+${hiddenTotal} more - type to narrow`;
      frag.appendChild(note);
    }

    rowsWrap.innerHTML = "";
    rowsWrap.appendChild(frag);
  }

  renderRows("");
  if (searchBox) searchBox.addEventListener("input", () => renderRows(searchBox.value.trim()));

  const hasTerms = sections.some((s) => s.terms && s.terms.length);
  if (hasTerms) {
    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;background:#333;margin:4px 2px";
    menu.appendChild(divider);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = config.clearLabel || "Clear this filter";
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
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  menu.style.top = top + "px";
  menu.style.left = left + "px";

  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onWindowScroll, true);
}

// Closes whichever filter popover is open, if any. Used when the panel is
// torn down or the view switches to Settings, so a popover is never left
// floating over unrelated content.
export function closeFilterMenu() {
  const existing = document.getElementById(MENU_ID);
  if (existing && existing._cleanup) existing._cleanup();
}
