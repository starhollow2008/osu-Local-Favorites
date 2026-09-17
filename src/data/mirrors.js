import { GM_getValue } from "../core/gm-shim.js";

// ═══ Download Mirrors ═══
// Third-party beatmap mirrors, used as a fallback wherever osu!'s own
// download doesn't work - guests (osu!'s own download button/route is
// gated behind a real logged-in session), beatmaps with downloads disabled,
// or just as an alternative when the official servers are slow. Modeled
// after the mirror list in limjeck/osuplus.
export const MIRRORS = [
  {
    key: "beatconnect",
    settingKey: "osu_mirror_beatconnect",
    label: "Beatconnect",
    defaultOn: true,
    variants: (id) => [
      { label: "Beatconnect", top: "Beatconnect", bottom: null, url: `https://beatconnect.io/b/${id}` },
    ],
  },
  {
    key: "nerinyan",
    settingKey: "osu_mirror_nerinyan",
    label: "NeriNyan",
    defaultOn: true,
    variants: (id) => [
      { label: "NeriNyan", top: "NeriNyan", bottom: null, url: `https://api.nerinyan.moe/d/${id}` },
      { label: "NeriNyan (no video)", top: "NeriNyan", bottom: "no video", url: `https://api.nerinyan.moe/d/${id}?nv=1` },
    ],
  },
  {
    key: "sayobot",
    settingKey: "osu_mirror_sayobot",
    label: "Sayobot",
    defaultOn: false,
    variants: (id) => [
      { label: "Sayobot", top: "Sayobot", bottom: null, url: `https://dl.sayobot.cn/beatmaps/download/full/${id}` },
      { label: "Sayobot (no video)", top: "Sayobot", bottom: "no video", url: `https://dl.sayobot.cn/beatmaps/download/novideo/${id}` },
    ],
  },
  {
    key: "mino",
    settingKey: "osu_mirror_mino",
    label: "Mino",
    defaultOn: false,
    variants: (id) => [{ label: "Mino", top: "Mino", bottom: null, url: `https://catboy.best/d/${id}` }],
  },
];

export function isMirrorEnabled(mirror) {
  return GM_getValue(mirror.settingKey, mirror.defaultOn);
}

// Detects a real logged-in osu! session via the page's own current-user
// JSON blob (empty object "{}" for guests, populated for a real session).
// Used to decide whether "Official Download" is worth offering at all -
// osu!'s download route requires server-side auth and simply doesn't work
// for guests regardless of what our script does.
//
// Memoized on the blob's exact text: buildCard() reaches this via both
// resolveDefaultMirror() and buildDownloadOptions() once per card, so a
// single 500-card panel render used to re-parse the same JSON blob ~1000
// times. Keying the cache on the raw text (not just a one-shot boolean)
// keeps it correct if Turbolinks swaps in a different user blob.
let _loggedInCache = null;
let _loggedInCacheKey = null;
export function isLoggedIn() {
  const el = document.getElementById("json-current-user");
  if (!el) return false;
  const raw = el.textContent;
  if (_loggedInCache !== null && _loggedInCacheKey === raw) return _loggedInCache;
  let result = false;
  try {
    const data = JSON.parse(raw);
    result = !!(data && data.id);
  } catch (e) {
    result = false;
  }
  _loggedInCache = result;
  _loggedInCacheKey = raw;
  return result;
}

// Exported invalidator (see invalidateFavoritesCache() in data/storage.js
// for why this is a function rather than exporting the raw bindings) -
// called from core/init.js's cross-tab sync handler when another tab's
// login state may have changed.
export function invalidateLoginCache() {
  _loggedInCache = null;
  _loggedInCacheKey = null;
}

// Which video variant to prefer, and whether Official or Mirrors should be
// listed first - both user-configurable in Settings → Download Mirrors.
// Nothing is ever hidden by these; they only decide ordering, so the full
// set of options is always one click away in the dropdown.
export const DL_VIDEO_PREF_KEY = "osu_dl_video_pref"; // "video" | "novideo"
export const DL_SOURCE_PREF_KEY = "osu_dl_source_pref"; // "official" | "mirrors"
export const DL_DEFAULT_MIRROR_KEY = "osu_dl_default_mirror"; // "" | "official" | "official_novideo" | "<mirror.key>" | "<mirror.key>_novideo"

// Flat, order-independent registry of every possible download destination
// (both Official variants + every mirror's variants), keyed stably so a
// stored "default mirror" choice keeps meaning the same thing no matter
// how the user's video/source-order preferences later reorder the
// dropdown itself. Used to populate the Settings picker and to resolve a
// stored default back into a real URL.
export function getAllDownloadDestinations() {
  const list = [
    { key: "official", label: "Official Download" },
    { key: "official_novideo", label: "Official Download (no video)" },
  ];
  MIRRORS.forEach((m) => {
    m.variants("0").forEach((v, i) => {
      list.push({
        key: i === 0 ? m.key : `${m.key}_novideo`,
        label: v.bottom ? `${v.top} (${v.bottom})` : v.top,
      });
    });
  });
  return list;
}

// Resolves the stored default-mirror key into an actual {label, url} for
// this beatmap, or null if it can't currently be used - either because
// the setting is unset, the chosen mirror has since been disabled, or
// it's Official but the user isn't signed in. Returning null is the
// signal to fall back to showing the normal dropdown, so this never
// hands back a link that would just fail.
export function resolveDefaultMirror(id) {
  const key = GM_getValue(DL_DEFAULT_MIRROR_KEY, "");
  if (!key) return null;

  if (key === "official" || key === "official_novideo") {
    if (!isLoggedIn()) return null;
    return {
      label: key === "official_novideo" ? "Official Download (no video)" : "Official Download",
      url: `https://osu.ppy.sh/beatmapsets/${id}/download${key === "official_novideo" ? "?noVideo=1" : ""}`,
    };
  }

  const novideo = key.endsWith("_novideo");
  const mirrorKey = novideo ? key.slice(0, -"_novideo".length) : key;
  const mirror = MIRRORS.find((m) => m.key === mirrorKey);
  if (!mirror || !isMirrorEnabled(mirror)) return null;

  const variants = mirror.variants(id);
  const variant = novideo ? variants[1] : variants[0];
  if (!variant) return null;
  return { label: variant.bottom ? `${variant.top} (${variant.bottom})` : variant.top, url: variant.url };
}

