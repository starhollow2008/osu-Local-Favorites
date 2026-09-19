import { GH_AUTO_BACKUP_KEY, GH_GIST_ID_KEY, GH_GIST_URL_KEY, GH_LAST_SYNC_KEY, GH_PRIVACY_KEY, GH_TOKEN_KEY, OSU_API_CLIENT_ID_KEY, OSU_API_CLIENT_SECRET_KEY, OSU_API_REDIRECT_URI, OSU_API_STATE_KEY, OSU_API_TOKEN_KEY, OSU_API_USERNAME_KEY, ghCreateGist, ghUpdateGist } from "./gist-backup.js";
import { reportError } from "../core/errors.js";
import { GM_getValue, GM_setValue } from "../core/gm-shim.js";
import { showOsuFavToast } from "../core/toast.js";
import { getFavorites } from "../data/storage.js";

// ═══ osu! API v2 - OAuth2 authorization-code flow ═══
// Same mechanism standard osu! extensions use: the user creates an OAuth
// application on their osu! account settings (new OAuth app), enters its
// Client ID + Client Secret in LOF's settings, and registers exactly
// https://osu.ppy.sh/home as the callback URL. The script
// then drives the full flow itself:
//   1. osuApiStartAuth()      → navigates to /oauth/authorize with a random state
//   2. osu! redirects back to /home?code=…&state=…
//   3. osuApiHandleOAuthCallback() (runs at document-start) exchanges the
//      code at /oauth/token, stores access+refresh tokens and wipes the
//      query string so the user never sees osu!'s 404 page.
//   4. osuApiGetToken() transparently refreshes via refresh_token grant.
//
// All token traffic is same-origin (https://osu.ppy.sh → itself), so plain
// fetch() works - no GM_xmlhttpRequest / CORS involved.

export function osuApiIsConfigured() {
  return !!(GM_getValue(OSU_API_CLIENT_ID_KEY, "") && GM_getValue(OSU_API_CLIENT_SECRET_KEY, ""));
}

export function osuApiIsConnected() {
  return !!GM_getValue(OSU_API_TOKEN_KEY, null);
}

export function osuApiStartAuth() {
  if (!osuApiIsConfigured()) {
    showOsuFavToast("Enter your Client ID and Secret first");
    return;
  }
  // Random state guards against CSRF on the callback.
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  GM_setValue(OSU_API_STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: GM_getValue(OSU_API_CLIENT_ID_KEY, ""),
    redirect_uri: OSU_API_REDIRECT_URI,
    response_type: "code",
    scope: "public identify",
    state,
  });
  // osu! answers /oauth/authorize with 401 (rendered as a plain browser
  // error, no osu! page) when the Application Callback URL registered for
  // this Client ID does not exactly match our redirect_uri. Probe the exact
  // authorize URL first and route the user back with an explanation instead
  // of leaving them on an opaque error page.
  const authorizeUrl = "https://osu.ppy.sh/oauth/authorize?" + params.toString();
  fetch(authorizeUrl, { method: "GET", credentials: "include" })
    .then((r) => {
      if (r.ok || r.redirected || r.status === 302) {
        location.href = authorizeUrl;
        return;
      }
      reportError(
        "osu! API connect",
        new Error(
          "Authorization failed (HTTP " + r.status + "). The Application Callback URL on your " +
          "osu! OAuth application must be exactly " + OSU_API_REDIRECT_URI +
          " - check it at https://osu.ppy.sh/home/account/edit#oauth (OAuth applications)",
        ),
        { status: r.status },
      );
    })
    .catch(() => {
      // Pre-flight itself failed (offline etc.) - still attempt the redirect,
      // the browser will surface its own error.
      location.href = authorizeUrl;
    });
}

function osuApiTokenRequest(body) {
  // osu! documents this endpoint as application/x-www-form-urlencoded. A
  // JSON body can make the authorization-code exchange fail even after the
  // user successfully approves the app.
  const form = new URLSearchParams();
  const credentials = Object.assign(
    {
      client_id: Number(GM_getValue(OSU_API_CLIENT_ID_KEY, "")) || GM_getValue(OSU_API_CLIENT_ID_KEY, ""),
      client_secret: GM_getValue(OSU_API_CLIENT_SECRET_KEY, ""),
    },
    body,
  );
  Object.entries(credentials).forEach(([key, value]) => form.set(key, String(value)));
  return fetch("https://osu.ppy.sh/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      throw Object.assign(
        new Error(data.error_description || data.error || "token request failed (HTTP " + r.status + ")"),
        { status: r.status, statusText: r.statusText },
      );
    }
    return data;
  });
}

function osuApiSaveToken(data) {
  GM_setValue(OSU_API_TOKEN_KEY, {
    access: data.access_token,
    refresh: data.refresh_token || "",
    expires_at: Date.now() + (data.expires_in || 86400) * 1000 - 60000, // refresh 1 min early
  });
}

// Returns a Promise<string> with a valid access token. Refreshes (and
// retries once after a refresh) automatically. Rejects when not configured
// or when both access and refresh tokens are dead.
let _osuApiRefreshInFlight = null;
function osuApiGetToken() {
  if (!osuApiIsConfigured()) return Promise.reject(new Error("osu! API not configured"));
  const tok = GM_getValue(OSU_API_TOKEN_KEY, null);
  if (!tok) return Promise.reject(new Error("osu! API not connected"));
  if (tok.access && Date.now() < tok.expires_at) return Promise.resolve(tok.access);
  if (!tok.refresh) return Promise.reject(new Error("osu! API session expired - reconnect in settings"));
  // Deduplicate concurrent refreshes
  if (!_osuApiRefreshInFlight) {
    // Per osu! docs: the refresh grant is also form-urlencoded and re-states
    // the original scope; omitting scope would also be accepted (existing
    // scopes are reused), but being explicit avoids any manager-side
    // normalization surprises.
    _osuApiRefreshInFlight = osuApiTokenRequest({
      grant_type: "refresh_token",
      refresh_token: tok.refresh,
      scope: "public identify",
    })
      .then((data) => {
        osuApiSaveToken(data);
        return data.access_token;
      })
      .catch((err) => {
        // Refresh dead → force a clean reconnect
        GM_setValue(OSU_API_TOKEN_KEY, null);
        throw err;
      })
      .finally(() => { _osuApiRefreshInFlight = null; });
  }
  return _osuApiRefreshInFlight;
}

// ── Rate limiting / queuing (per https://osu.ppy.sh/docs/index.html) ──
// osu! asks clients to stay under ~60 requests/minute (≈1/sec), honor
// Retry-After on HTTP 429, use exponential backoff, and cache responses.
// All of that is enforced centrally here so every osuApiGet() caller is
// compliant regardless of where the call originates.
const OSU_API_MIN_GAP_MS = 1050;        // ≥1s between requests
let _osuApiQueueTail = Promise.resolve(); // serializes request pacing
let _osuApiRetryAfterUntil = 0;         // absolute ts while server says wait
let _osuApiBackoffMs = 0;               // grows exponentially on repeat 429s
const _osuApiCache = new Map();         // path → response JSON (session cache)
const OSU_API_CACHE_MAX = 500;

function _osuApiDelay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Serializes every API call through one queue with ≥OSU_API_MIN_GAP_MS
// spacing, plus any server-mandated or backoff wait before dispatching.
function _osuApiGate(fn) {
  const run = () => {
    const now = Date.now();
    const wait = Math.max(
      _osuApiRetryAfterUntil - now,
      _osuApiBackoffMs ? (_osuApiRetryAfterUntil || now) + _osuApiBackoffMs - now : 0,
    );
    return (wait > 0 ? _osuApiDelay(wait) : Promise.resolve()).then(fn);
  };
  const result = _osuApiQueueTail.then(run, run);
  _osuApiQueueTail = result.catch(() => { }).then(() => _osuApiDelay(OSU_API_MIN_GAP_MS));
  return result;
}

function osuApiGet(path) {
  const cleanPath = path.replace(/^\//, "");
  // Docs good-practice #4: cache retrieved data and reuse it.
  if (_osuApiCache.has(cleanPath)) return Promise.resolve(_osuApiCache.get(cleanPath));

  const attempt = (isRetry) =>
    osuApiGetToken().then((token) =>
      fetch("https://osu.ppy.sh/api/v2/" + cleanPath, {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      }).then(async (r) => {
        if (r.status === 429) {
          // Honor the server's Retry-After, then apply exponential backoff
          // for any further 429s (docs good-practice #3).
          const raHeader = parseFloat(r.headers.get("Retry-After") || "0");
          if (!isRetry && _osuApiBackoffMs === 0) _osuApiBackoffMs = 2000;
          else _osuApiBackoffMs = Math.min(_osuApiBackoffMs * 2 || 2000, 60000);
          _osuApiRetryAfterUntil = Date.now() + (Number.isFinite(raHeader) && raHeader > 0 ? raHeader * 1000 : _osuApiBackoffMs);
          throw Object.assign(new Error("rate limited by osu! API"), { rateLimited: true });
        }
        _osuApiBackoffMs = 0; // successful window - reset backoff
        if (r.status === 401 && !isRetry) {
          // Access token died early (revoked/password change): drop cached
          // token so the next osuApiGetToken() refreshes, then retry once.
          GM_setValue(OSU_API_TOKEN_KEY, null);
          return attempt(true);
        }
        if (!r.ok) throw Object.assign(
          new Error("osu! API HTTP " + r.status + " for " + cleanPath),
          { status: r.status, statusText: r.statusText },
        );
        return r.json();
      }),
    );

  return _osuApiGate(() => attempt(false)).catch((err) => {
    // One transparent retry after a rate-limit wait has elapsed.
    if (err && err.rateLimited) {
      return _osuApiGate(() => attempt(true)).then((data) => {
        _osuApiCacheSet(cleanPath, data);
        return data;
      });
    }
    throw err;
  }).then((data) => {
    _osuApiCacheSet(cleanPath, data);
    return data;
  });
}

function _osuApiCacheSet(path, data) {
  if (!data || typeof data !== "object") return;
  if (_osuApiCache.size >= OSU_API_CACHE_MAX) {
    // Evict oldest inserted entry
    _osuApiCache.delete(_osuApiCache.keys().next().value);
  }
  _osuApiCache.set(path, data);
}

function osuApiGetUsername() {
  const cached = GM_getValue(OSU_API_USERNAME_KEY, "");
  if (cached) return Promise.resolve(cached);
  return osuApiGet("/me").then((me) => {
    const name = (me && me.username) || "";
    if (name) GM_setValue(OSU_API_USERNAME_KEY, name);
    return name;
  });
}

export function osuApiDisconnect() {
  GM_setValue(OSU_API_TOKEN_KEY, null);
  GM_setValue(OSU_API_USERNAME_KEY, "");
  GM_setValue(OSU_API_STATE_KEY, "");
}

// Runs once at document-start. If we're back on osu.ppy.sh with ?code= &
// ?state= from our own authorize redirect, exchange the code before osu!
// renders its 404 page, then rewrite the URL clean.
export function osuApiHandleOAuthCallback() {
  try {
    const q = new URLSearchParams(location.search);
    const code = q.get("code");
    const state = q.get("state");
    const expected = GM_getValue(OSU_API_STATE_KEY, "");
    if (!code || !state || !expected || state !== expected) return;
    GM_setValue(OSU_API_STATE_KEY, "");
    history.replaceState(null, "", location.pathname); // hide ?code=… immediately
    osuApiTokenRequest({ grant_type: "authorization_code", code, redirect_uri: OSU_API_REDIRECT_URI })
      .then((data) => {
        osuApiSaveToken(data);
        GM_setValue(OSU_API_USERNAME_KEY, "");
        const notify = () => showOsuFavToast("osu! API connected");
        if (document.body) notify(); else document.addEventListener("DOMContentLoaded", notify);
      })
      .catch((err) => {
        const notify = () => reportError("osu! API connect", err);
        if (document.body) notify(); else document.addEventListener("DOMContentLoaded", notify);
      });
  } catch (e) { /* never break page load over this */ }
}

// Fetches a beatmapset through the API v2 and normalizes it into LOF's
// stored-favorite shape (identical fields to getBeatmapDataFromJSON - the
// website's embedded JSON is basically the same object as the API payload).
export function osuApiFetchBeatmapset(beatmapId) {
  return osuApiGet("/beatmapsets/" + beatmapId).then((bm) => {
    if (!bm || !bm.id) throw new Error("beatmapset not found");
    const sid = String(bm.id);
    return {
      id: sid,
      artist: bm.artist || "",
      artist_unicode: bm.artist_unicode || bm.artist || "",
      title: bm.title || "",
      title_unicode: bm.title_unicode || bm.title || "",
      creator: bm.creator || "",
      user_id: String(bm.user_id || ""),
      covers: bm.covers || {},
      status: bm.status || "",
      favourite_count: bm.favourite_count || 0,
      play_count: bm.play_count || 0,
      bpm: bm.bpm || 0,
      source: bm.source || "",
      tags: bm.tags || "",
      genre: typeof bm.genre === "string" ? bm.genre : ((bm.genre && bm.genre.name) || ""),
      language: typeof bm.language === "string" ? bm.language : ((bm.language && bm.language.name) || ""),
      url: "https://osu.ppy.sh/beatmapsets/" + sid,
      favourited_at: new Date().toISOString(),
      // The API does not always include the featured-artist marker. `null`
      // means "not supplied" so enrichment can preserve a known value from
      // the existing favorite instead of turning it off during re-enrichment.
      is_artist_featured:
        typeof bm.is_artist_featured === "boolean"
          ? bm.is_artist_featured
          : (bm.track_id != null ? !!bm.track_id : null),
      nsfw: !!bm.nsfw,
      preview: "https://b.ppy.sh/preview/" + sid + ".mp3",
    };
  });
}

// Creates the backup gist on first run, otherwise updates the linked one.
// Note: GitHub does not allow flipping a gist's public/private flag after
// creation, so a privacy change clears GH_GIST_ID_KEY and this naturally
// creates a fresh gist with the new visibility on the next call.
export function performGistBackup() {
  const token = GM_getValue(GH_TOKEN_KEY, "");
  if (!token) return Promise.reject(new Error("Not connected to GitHub"));
  const favs = getFavorites();
  const gistId = GM_getValue(GH_GIST_ID_KEY, "");
  const isPublic = GM_getValue(GH_PRIVACY_KEY, "private") === "public";

  const createAndLink = () => ghCreateGist(token, favs, isPublic).then((gist) => {
      GM_setValue(GH_GIST_ID_KEY, gist.id);
      GM_setValue(GH_GIST_URL_KEY, gist.html_url || "");
      return gist;
    });

  const p = gistId
    ? ghUpdateGist(token, gistId, favs).catch((err) => {
      // A user can delete the linked gist directly on GitHub. Treat its 404
      // as a stale local link, create a replacement, and relink it so both
      // manual and automatic backups recover on the same attempt.
      if (!err || err.status !== 404) throw err;
      GM_setValue(GH_GIST_ID_KEY, "");
      GM_setValue(GH_GIST_URL_KEY, "");
      return createAndLink();
    })
    : createAndLink();

  return p.then((gist) => {
    GM_setValue(GH_LAST_SYNC_KEY, Date.now());
    return gist;
  });
}

// Debounced auto-backup - call this after every favorites mutation.
// No-ops unless the user has connected GitHub and switched auto-update on.
// Debouncing avoids hammering the API when several maps are favorited in
// a row (e.g. the "Favorite all" bulk button).
let _autoBackupTimer = null;
export function scheduleAutoBackup() {
  const token = GM_getValue(GH_TOKEN_KEY, "");
  const auto = GM_getValue(GH_AUTO_BACKUP_KEY, false);
  if (!token || !auto) return;
  if (_autoBackupTimer) clearTimeout(_autoBackupTimer);
  _autoBackupTimer = setTimeout(() => {
    _autoBackupTimer = null;
    performGistBackup()
      .then(() => {
        showOsuFavToast("Gist backup updated");
        const statusEl = document.getElementById("osu-fav-footer-status");
        if (statusEl && typeof statusEl._refresh === "function") statusEl._refresh();
      })
      .catch((err) => reportError("Gist auto-backup", err));
  }, 4000);
}

