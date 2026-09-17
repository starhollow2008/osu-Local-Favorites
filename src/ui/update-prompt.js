import { GM_getValue, GM_setValue } from "../core/gm-shim.js";

// ═══ Update prompt UI ═══
// Shown on page load when a new version is detected and the panel isn't open.
// Reuses the same palette as the panel so it looks consistent.
export function showUpdatePrompt(latestVersion) {
  const dismissed = GM_getValue("osu_dismissed_version", "");
  if (dismissed === latestVersion) return;
  if (document.getElementById("osu-local-update-prompt")) return;

  // Inject slide-in keyframe if not already present
  if (!document.getElementById("osu-fav-panel-style")) {
    const s = document.createElement("style");
    s.id = "osu-fav-panel-style";
    s.textContent =
      "#osu-fav-list::-webkit-scrollbar{width:4px}" +
      "#osu-fav-list::-webkit-scrollbar-thumb{background:#333;border-radius:2px}" +
      "#osu-fav-list::-webkit-scrollbar-thumb:hover{background:var(--osu-fav-accent)}" +
      "@keyframes osuFavSlideDown{from{max-height:0;opacity:0;overflow:hidden}to{max-height:50px;opacity:1}}" +
      "@keyframes osuFavSlideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}";
    document.head.appendChild(s);
  }

  const modal = document.createElement("div");
  modal.id = "osu-local-update-prompt";
  // Matches panel: dark #111 bg, #333 border, same font stack, same shadow
  Object.assign(modal.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "100002",
    width: "300px",
    background: "#111",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#ddd",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "13px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    overflow: "hidden",
    animation: "osuFavSlideUp 0.25s ease-out",
  });

  // Gradient accent bar - same as displayUpdateBanner inside the panel
  const accentBar = document.createElement("div");
  accentBar.style.cssText =
    "background: var(--osu-fav-accent);padding:8px 14px;" +
    "display:flex;align-items:center;justify-content:space-between;" +
    "font-weight:600;font-size:12px;color:#fff;gap:8px;border-bottom:1px solid rgba(0,0,0,0.15)";

  const accentLabel = document.createElement("span");
  accentLabel.innerHTML = `New version <b>v${latestVersion}</b> available!`;

  const accentClose = document.createElement("button");
  accentClose.textContent = "✕";
  accentClose.title = "Dismiss";
  accentClose.style.cssText =
    "background:none;border:none;color:#fff;cursor:pointer;font-size:12px;" +
    "opacity:0.8;font-weight:bold;padding:0 2px;flex-shrink:0";
  accentClose.addEventListener("mouseenter", () => (accentClose.style.opacity = "1"));
  accentClose.addEventListener("mouseleave", () => (accentClose.style.opacity = "0.8"));
  accentClose.addEventListener("click", () => {
    modal.remove();
    GM_setValue("osu_dismissed_version", latestVersion);
  });

  accentBar.append(accentLabel, accentClose);

  // Body - same text color and line-height as panel text
  const body = document.createElement("div");
  body.style.cssText = "padding:12px 14px;line-height:1.5;font-size:12px;color:#bbb";
  body.innerHTML =
    `<b style="color:#ddd">osu! Local Favorites</b> has an update ready.<br>` +
    `Install it now to get the latest fixes and features.`;

  // Footer buttons - mirror the toolbar makeBtn style from the panel
  const footer = document.createElement("div");
  footer.style.cssText =
    "display:flex;justify-content:flex-end;gap:6px;padding:8px 14px;" +
    "border-top:1px solid #222;background:#1a1a1a";

  const laterBtn = document.createElement("button");
  laterBtn.textContent = "Later";
  laterBtn.style.cssText =
    "font-size:10px;padding:4px 10px;border:1px solid #333;border-radius:3px;" +
    "background:transparent;color:#888;cursor:pointer;font-weight:500";
  laterBtn.addEventListener("mouseenter", () => {
    laterBtn.style.borderColor = "var(--osu-fav-accent)";
    laterBtn.style.color = "var(--osu-fav-accent)";
  });
  laterBtn.addEventListener("mouseleave", () => {
    laterBtn.style.borderColor = "#333";
    laterBtn.style.color = "#888";
  });
  laterBtn.addEventListener("click", () => {
    modal.remove();
    GM_setValue("osu_dismissed_version", latestVersion);
  });

  // "Update" button - same style as the in-panel banner's Update button
  const updateBtn = document.createElement("button");
  updateBtn.textContent = "Update Now";
  updateBtn.style.cssText =
    "font-size:10px;padding:4px 10px;border:none;border-radius:3px;" +
    "background:var(--osu-fav-accent);color:#fff;cursor:pointer;font-weight:600;transition:background 0.2s";
  updateBtn.addEventListener("mouseenter", () => (updateBtn.style.background = "var(--osu-fav-accent-dark)"));
  updateBtn.addEventListener("mouseleave", () => (updateBtn.style.background = "var(--osu-fav-accent)"));
  updateBtn.addEventListener("click", () => {
    window.open(
      "https://github.com/starhollow2008/LOF/raw/main/osu-local-favorites.user.js",
      "_blank",
    );
    modal.remove();
  });

  footer.append(laterBtn, updateBtn);
  modal.append(accentBar, body, footer);
  document.body.appendChild(modal);
}

