import { createCollection, deleteCollection, getCollections, toggleMapInCollection } from "../data/collections.js";

export function showCollectionsMenu(anchorEl, activeId, onSelect) {
  const existing = document.getElementById("osu-fav-cols-menu");
  const reopening = existing && existing._anchor === anchorEl;
  if (existing && existing._cleanup) existing._cleanup();
  if (reopening) return;

  const menu = document.createElement("div");
  menu.id = "osu-fav-cols-menu";
  menu._anchor = anchorEl;
  menu.style.cssText =
    "position:fixed;z-index:100002;min-width:190px;max-width:240px;max-height:320px;overflow-y:auto;" +
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

  function renderRows() {
    menu.innerHTML = "";

    const allRow = document.createElement("button");
    allRow.type = "button";
    allRow.textContent = "All favorites";
    allRow.style.cssText =
      `display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:2px;font-size:11px;border:none;` +
      `border-radius:3px;cursor:pointer;box-sizing:border-box;` +
      `background:${activeId ? "transparent" : "var(--osu-fav-accent)"};color:${activeId ? "#ddd" : "#fff"}`;
    allRow.addEventListener("mouseenter", () => { if (activeId) allRow.style.background = "#242424"; });
    allRow.addEventListener("mouseleave", () => { if (activeId) allRow.style.background = "transparent"; });
    allRow.addEventListener("click", () => { onSelect(""); cleanup(); });
    menu.appendChild(allRow);

    const cols = getCollections();
    const entries = Object.entries(cols).sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:11px;color:#666;padding:8px 10px;line-height:1.4";
      empty.textContent = "No collections yet - create one below.";
      menu.appendChild(empty);
    }

    entries.forEach(([id, col]) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:4px";

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.textContent = `${col.name} (${(col.ids || []).length})`;
      selectBtn.style.cssText =
        `flex:1;min-width:0;text-align:left;padding:6px 10px;font-size:11px;border:none;border-radius:3px;` +
        `cursor:pointer;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;` +
        `background:${activeId === id ? "var(--osu-fav-accent)" : "transparent"};color:${activeId === id ? "#fff" : "#ddd"}`;
      selectBtn.addEventListener("mouseenter", () => { if (activeId !== id) selectBtn.style.background = "#242424"; });
      selectBtn.addEventListener("mouseleave", () => { if (activeId !== id) selectBtn.style.background = "transparent"; });
      selectBtn.addEventListener("click", () => { onSelect(activeId === id ? "" : id); cleanup(); });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "\u2715";
      delBtn.title = "Delete collection";
      delBtn.style.cssText =
        "flex-shrink:0;font-size:9px;padding:3px 5px;border:1px solid #333;border-radius:3px;background:transparent;color:#666;cursor:pointer";
      let confirming = false;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirming) {
          confirming = true;
          delBtn.textContent = "Sure?";
          delBtn.style.borderColor = "#e55";
          delBtn.style.color = "#e55";
          setTimeout(() => {
            if (confirming) {
              confirming = false;
              delBtn.textContent = "\u2715";
              delBtn.style.borderColor = "#333";
              delBtn.style.color = "#666";
            }
          }, 3000);
        } else {
          deleteCollection(id);
          if (activeId === id) onSelect("");
          renderRows();
        }
      });

      row.append(selectBtn, delBtn);
      menu.appendChild(row);
    });

    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;background:#333;margin:4px 2px";
    menu.appendChild(divider);

    const newRow = document.createElement("div");
    newRow.style.cssText = "display:flex;gap:4px;padding:4px";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "New collection...";
    input.style.cssText =
      "flex:1;min-width:0;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
      "font-size:10px;padding:4px 6px;outline:none;box-sizing:border-box";
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createBtn.click();
    });
    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.textContent = "Create";
    createBtn.style.cssText =
      "font-size:10px;padding:4px 8px;border:1px solid var(--osu-fav-accent);border-radius:3px;" +
      "background:var(--osu-fav-accent);color:#fff;cursor:pointer;flex-shrink:0";
    createBtn.addEventListener("click", () => {
      const name = input.value.trim();
      if (!name) return;
      createCollection(name);
      input.value = "";
      renderRows();
    });
    newRow.append(input, createBtn);
    menu.appendChild(newRow);
  }
  renderRows();

  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  if (top + menuRect.height > window.innerHeight) top = Math.max(8, rect.top - menuRect.height - 4);
  let left = rect.right - menuRect.width;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
  menu.style.top = top + "px";
  menu.style.left = left + "px";

  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onWindowScroll, true);
}

// ── Per-card "add to collection" popover ──
// Toggle-style checklist (a map can belong to several collections at once),
// plus the same inline "new collection" creator as the toolbar selector.
export function showAddToCollectionMenu(anchorEl, mapId, onChange) {
  const existing = document.getElementById("osu-fav-col-menu");
  const reopening = existing && existing._anchor === anchorEl;
  if (existing && existing._cleanup) existing._cleanup();
  if (reopening) return;

  const menu = document.createElement("div");
  menu.id = "osu-fav-col-menu";
  menu._anchor = anchorEl;
  menu.style.cssText =
    "position:fixed;z-index:100002;min-width:180px;max-width:240px;max-height:320px;overflow-y:auto;" +
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

  function renderRows() {
    menu.innerHTML = "";
    const cols = getCollections();
    const entries = Object.entries(cols).sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:11px;color:#666;padding:8px 10px;line-height:1.4";
      empty.textContent = "No collections yet - create one below.";
      menu.appendChild(empty);
    } else {
      entries.forEach(([id, col]) => {
        const inCol = (col.ids || []).includes(mapId);
        const row = document.createElement("button");
        row.type = "button";
        row.style.cssText =
          "display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:6px 10px;" +
          "font-size:11px;color:#ddd;background:transparent;border:none;border-radius:3px;cursor:pointer;" +
          "white-space:nowrap;box-sizing:border-box";
        row.addEventListener("mouseenter", () => (row.style.background = "#242424"));
        row.addEventListener("mouseleave", () => (row.style.background = "transparent"));

        const check = document.createElement("span");
        check.textContent = inCol ? "\u2713" : "";
        check.style.cssText = "width:12px;flex-shrink:0;color:var(--osu-fav-accent);font-weight:700";

        const label = document.createElement("span");
        label.textContent = `${col.name} (${(col.ids || []).length})`;
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1";

        row.append(check, label);
        row.addEventListener("click", () => {
          toggleMapInCollection(id, mapId);
          renderRows();
          if (onChange) onChange();
        });
        menu.appendChild(row);
      });
    }

    const divider = document.createElement("div");
    divider.style.cssText = "height:1px;background:#333;margin:4px 2px";
    menu.appendChild(divider);

    const newRow = document.createElement("div");
    newRow.style.cssText = "display:flex;gap:4px;padding:4px";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "New collection...";
    input.style.cssText =
      "flex:1;min-width:0;background:#111;border:1px solid #333;border-radius:3px;color:#ddd;" +
      "font-size:10px;padding:4px 6px;outline:none;box-sizing:border-box";
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmBtn.click();
    });
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Add";
    confirmBtn.style.cssText =
      "font-size:10px;padding:4px 8px;border:1px solid var(--osu-fav-accent);border-radius:3px;" +
      "background:var(--osu-fav-accent);color:#fff;cursor:pointer;flex-shrink:0";
    confirmBtn.addEventListener("click", () => {
      const name = input.value.trim();
      if (!name) return;
      const id = createCollection(name);
      toggleMapInCollection(id, mapId);
      input.value = "";
      renderRows();
      if (onChange) onChange();
    });
    newRow.append(input, confirmBtn);
    menu.appendChild(newRow);
  }
  renderRows();

  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  if (top + menuRect.height > window.innerHeight) top = Math.max(8, rect.top - menuRect.height - 4);
  let left = rect.right - menuRect.width;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
  menu.style.top = top + "px";
  menu.style.left = left + "px";

  setTimeout(() => document.addEventListener("click", onOutsideClick, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onWindowScroll, true);
}

