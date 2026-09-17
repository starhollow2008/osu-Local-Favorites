// ═══ GitHub Gist Backup ═══
const GIST_FILENAME = "osu-local-favorites-backup.json";
export const GH_TOKEN_KEY = "osu_github_token";
// ── osu! API v2 (OAuth2 authorization-code) storage keys ──
export const OSU_API_CLIENT_ID_KEY = "osu_api_client_id";
export const OSU_API_CLIENT_SECRET_KEY = "osu_api_client_secret";
export const OSU_API_TOKEN_KEY = "osu_api_token"; // {access,refresh,expires_at}
export const OSU_API_STATE_KEY = "osu_api_oauth_state";
export const OSU_API_USERNAME_KEY = "osu_api_username";
// The redirect URI users must register on their osu! OAuth application.
// Must match EXACTLY (scheme/host/path, no trailing slash).
export const OSU_API_REDIRECT_URI = "https://osu.ppy.sh/osu-local-favorites";
export const GH_USERNAME_KEY = "osu_github_username";
export const GH_GIST_ID_KEY = "osu_github_gist_id";
export const GH_GIST_URL_KEY = "osu_github_gist_url";
export const GH_AUTO_BACKUP_KEY = "osu_gist_auto_backup";
export const GH_PRIVACY_KEY = "osu_gist_privacy"; // "private" | "public"
export const GH_LAST_SYNC_KEY = "osu_gist_last_sync";

function ghApiRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === "undefined") {
      reject(new Error("GM_xmlhttpRequest is unavailable"));
      return;
    }
    GM_xmlhttpRequest({
      method,
      url: "https://api.github.com" + path,
      headers: {
        ...(token ? { Authorization: "token " + token } : {}),
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      data: body ? JSON.stringify(body) : undefined,
      timeout: 15000,
      onload: (response) => {
        let json = null;
        try {
          json = JSON.parse(response.responseText);
        } catch (e) { }
        if (response.status >= 200 && response.status < 300) {
          resolve(json);
        } else {
          reject(Object.assign(
            new Error((json && json.message) || ("GitHub error " + response.status)),
            { status: response.status, statusText: response.statusText },
          ));
        }
      },
      onerror: () => reject(Object.assign(new Error("Network error contacting GitHub"), { status: 0 })),
      ontimeout: () => reject(Object.assign(new Error("GitHub request timed out"), { status: 0 })),
    });
  });
}

export function ghGetUser(token) {
  return ghApiRequest("GET", "/user", token);
}

// Looks for a gist already containing our backup filename - lets a
// reconnect (new browser/device) pick up an existing backup instead of
// silently creating a duplicate.
export function ghFindExistingGist(token) {
  return ghApiRequest("GET", "/gists?per_page=100", token).then((gists) => {
    if (!Array.isArray(gists)) return null;
    return gists.find((g) => g.files && g.files[GIST_FILENAME]) || null;
  });
}

export function ghCreateGist(token, favs, isPublic) {
  return ghApiRequest("POST", "/gists", token, {
    description: "osu! Local Favorites backup",
    public: isPublic,
    files: { [GIST_FILENAME]: { content: JSON.stringify(favs, null, 2) } },
  });
}

export function ghUpdateGist(token, gistId, favs) {
  return ghApiRequest("PATCH", "/gists/" + gistId, token, {
    files: { [GIST_FILENAME]: { content: JSON.stringify(favs, null, 2) } },
  });
}

// Fetches and parses the backup file from a gist. Falls back to raw_url
// when GitHub truncates large file content in the API response.
export function ghGetGistContent(token, gistId) {
  return ghApiRequest("GET", "/gists/" + gistId, token).then((gist) => {
    const file = gist && gist.files && gist.files[GIST_FILENAME];
    if (!file) throw new Error("Backup file not found in gist");
    if (!file.truncated) return JSON.parse(file.content);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: file.raw_url,
        timeout: 15000,
        onload: (r) => {
          try {
            resolve(JSON.parse(r.responseText));
          } catch (e) {
            reject(new Error("Failed to parse backup data"));
          }
        },
        onerror: () => reject(new Error("Network error fetching backup")),
        ontimeout: () => reject(new Error("Timed out fetching backup")),
      });
    });
  });
}

// Pulls a gist id out of either a raw id or a pasted gist URL
// (https://gist.github.com/user/<id> or the api.github.com form).
export function parseGistId(input) {
  const trimmed = (input || "").trim();
  const hexMatch = trimmed.match(/[0-9a-f]{16,}/i);
  if (hexMatch) return hexMatch[0];
  const parts = trimmed.split(/[/?#]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : trimmed;
}

