import { GM_getValue, GM_setValue } from "../core/gm-shim.js";

// ═══ Version check & update helper ═══
export const AUTO_UPDATE_CHECK_KEY = "osu_auto_update_checks";

export function autoUpdateChecksEnabled() {
  return GM_getValue(AUTO_UPDATE_CHECK_KEY, true);
}

// getCurrentVersion() reads directly from Tampermonkey's GM_info API, which always
// mirrors the @version header - no separate constant to keep in sync.
export function getCurrentVersion() {
  // Primary: Tampermonkey/Violentmonkey expose GM_info.script.version from the @version tag
  if (typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version) {
    return GM_info.script.version;
  }
  // Fallback: scan script tags in the document for a @version comment (development use)
  try {
    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const v = (s.textContent || "").match(/@version\s+([0-9.]+)/);
      if (v) return v[1];
    }
  } catch (_) { }
  return "0.0.0";
}

export function isNewerVersion(current, latest) {
  if (!current || !latest) return false;
  const cParts = current.split(".").map((n) => parseInt(n, 10) || 0);
  const lParts = latest.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (c > l) return false;
  }
  return false;
}

export function checkVersionUpdate(force = false) {
  const currentVersion = getCurrentVersion();
  const lastCheck = GM_getValue("osu_last_version_check", 0);
  const checkInterval = 12 * 60 * 60 * 1000; // 12 hours

  if (!force && Date.now() - lastCheck < checkInterval) {
    return Promise.resolve(GM_getValue("osu_latest_version", null));
  }

  return new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest === "undefined") {
      resolve(null);
      return;
    }
    GM_xmlhttpRequest({
      method: "GET",
      // Always fetch the live main branch so version checks pick up real releases
      url: "https://raw.githubusercontent.com/starhollow2008/LOF/refs/heads/main/dist/osu-local-favorites.user.js",
      timeout: 10000,
      onload: function (response) {
        GM_setValue("osu_last_version_check", Date.now());
        const text = response.responseText || "";
        // Only scan the UserScript header block (first 2 KB) for speed
        const header = text.slice(0, 2048);
        const match = header.match(/@version\s+(\d+\.\d+\.\d+)/);
        if (match) {
          const latestVersion = match[1].trim();
          if (isNewerVersion(currentVersion, latestVersion)) {
            GM_setValue("osu_latest_version", latestVersion);
            resolve(latestVersion);
            return;
          }
        }
        GM_setValue("osu_latest_version", null);
        resolve(null);
      },
      onerror: function () {
        resolve(null);
      },
      ontimeout: function () {
        resolve(null);
      },
    });
  });
}

