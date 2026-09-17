import { showOsuFavToast } from "../core/toast.js";
import { checkVersionUpdate, getCurrentVersion, isNewerVersion } from "../data/version-check.js";
import { showFavoritesPanel } from "./main-panel.js";

// ═══ Menu commands ═══
// These run at top-level, before init() - an unguarded throw here (rather
// than the graceful no-op-stub behavior GM_getValue/GM_setValue fall back
// to in some environments) would silently prevent everything below,
// including init() itself, from ever running.
try {
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("View Local Favorites", showFavoritesPanel);
    GM_registerMenuCommand("Check for Updates", () => {
      showOsuFavToast("Checking for updates...");
      checkVersionUpdate(true).then((latestVersion) => {
        const currentVersion = getCurrentVersion();
        if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
          const panel = document.getElementById("osu-local-fav-panel");
          if (!panel) {
            showFavoritesPanel();
          } else {
            panel.remove();
            showFavoritesPanel();
          }
          showOsuFavToast(`New version v${latestVersion} is available!`);
          window.open(
            "https://github.com/starhollow2008/LOF/raw/main/osu-local-favorites.user.js",
            "_blank",
          );
        } else {
          showOsuFavToast(`You are up to date! (v${currentVersion})`);
        }
      });
    });
  } else {
    console.warn(
      "[osu-local-favorites] GM_registerMenuCommand not supported by this userscript manager - menu commands disabled",
    );
  }
} catch (e) {
  console.warn("[osu-local-favorites] menu command registration failed:", e);
}

