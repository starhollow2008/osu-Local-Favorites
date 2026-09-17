import { scheduleAutoBackup } from "./osu-api.js";
import { GM_getValue } from "../core/gm-shim.js";
import { getFavorites, setFavorites } from "../data/storage.js";

// ═══ Full-length previews (Hinamizawa music mirror) ═══
// osu!'s own preview clip is a fixed ~10s cut. mirror.hinamizawa.ai runs a
// separate music-streaming API (distinct from its beatmap-download mirror)
// that serves the full track from its own disk when it has one cached, and
// otherwise transparently falls back to proxying the same ~30s official
// clip while it extracts the full song in the background - so pointing
// the preview player at it is a strict upgrade, never a worse experience
// than what we already show. No auth, open CORS, HTTP Range for seeking.
export const PREVIEW_FULLSONG_KEY = "osu_preview_fullsong";
const HINAI_MUSIC_API_BASE = "https://mirror.hinamizawa.ai/v3/osu/music";
// The mirror asks integrations to identify themselves so traffic can be
// attributed and supported. Keep this separate from navigator.userAgent:
// browser media requests control their own forbidden User-Agent header,
// while the metadata request below is made through GM_xmlhttpRequest.
const HINAI_MUSIC_USER_AGENT =
  "osu-Local-Favorites https://github.com/starhollow2008/osu-Local-Favorites";
const _hinaiSongRequests = new Map(); // beatmapset id -> Promise<Song|null>

// Firefox for Android on some devices (including Redmi models) is much
// less forgiving of a cold cross-origin stream. Keep the mirror as the
// primary source when full-song previews are enabled, but do not make the
// first tap compete with a second GM_xmlhttpRequest cache download. If the
// mirror is unavailable, undecodable, or only has the short clip, the
// player falls back to osu!'s direct preview below.
export function isFirefoxAndroid() {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) && /Firefox\//i.test(ua);
}

export function fullSongPreviewsEnabled() {
  return GM_getValue(PREVIEW_FULLSONG_KEY, true);
}
export function previewSourceUrl(id, fallbackUrl) {
  if (!fullSongPreviewsEnabled()) return fallbackUrl;
  return `${HINAI_MUSIC_API_BASE}/audio/${id}`;
}

// Fetch only when a user starts a track, never once per visible card. The
// Song response's duration_sec lets us distinguish a genuinely short song
// from the mirror's transitional ~30s osu! preview without delaying the
// click that starts playback.
export function fetchHinaiSong(id) {
  const key = String(id);
  if (_hinaiSongRequests.has(key)) return _hinaiSongRequests.get(key);
  const request = new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest !== "function") { resolve(null); return; }
    try {
      GM_xmlhttpRequest({
        method: "GET",
        url: `${HINAI_MUSIC_API_BASE}/song/${encodeURIComponent(key)}`,
        headers: {
          Accept: "application/json",
          "User-Agent": HINAI_MUSIC_USER_AGENT,
        },
        timeout: 10000,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) { resolve(null); return; }
          try {
            const song = JSON.parse(response.responseText);
            resolve(song && String(song.beatmapset_id) === key ? song : null);
          } catch (_) {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    } catch (_) {
      resolve(null);
    }
  });
  _hinaiSongRequests.set(key, request);
  return request;
}

export function hinaiDurationSec(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

// Preserve the useful metadata across panel re-renders and future plays.
// These fields intentionally match the Music API response names.
export function storeHinaiSongMetadata(id, song) {
  const favs = getFavorites();
  const fav = favs[String(id)];
  if (!fav || !song) return;
  const duration = hinaiDurationSec(song.duration_sec);
  const changed = fav.duration_sec !== duration || fav.audio_cached !== song.audio_cached;
  if (!changed) return;
  favs[String(id)] = { ...fav, duration_sec: duration, audio_cached: song.audio_cached };
  setFavorites(favs);
  scheduleAutoBackup();
}

