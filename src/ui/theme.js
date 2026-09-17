import { GM_getValue } from "../core/gm-shim.js";

// ═══ Theme ═══
// Accent color and the idle/hover/active opacity levels used by the cover
// preview button are all exposed as CSS custom properties on <html>, rather
// than hardcoded throughout the UI. Settings → Appearance just updates these
// variables (and persists them) - every element that references
// var(--osu-fav-accent) etc. picks up the change immediately, with no need
// to touch each individual style string.
export const THEME_ACCENT_KEY = "osu_theme_accent";
export const THEME_HEART_KEY = "osu_theme_heart_color";
export const THEME_IDLE_OPACITY_KEY = "osu_theme_idle_opacity";
export const THEME_IDLE_DIM_KEY = "osu_theme_idle_dim";
export const THEME_HOVER_DIM_KEY = "osu_theme_hover_dim";
export const THEME_ACTIVE_OPACITY_KEY = "osu_theme_active_opacity";

export const THEME_DEFAULTS = {
  accent: "#ff66aa",
  heartColor: "#ff66aa",
  idleOpacity: 0.15,
  idleDim: 0,
  hoverDim: 0.65,
  activeOpacity: 0.8,
};

// Simple hex darken for the accent's hover/pressed shade - mirrors the
// original #ff66aa → #ff3377 relationship (roughly -25% lightness)
function darkenHex(hex, amount = 0.25) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const [r, g, b] = [1, 2, 3].map((i) => clamp(parseInt(m[i], 16) * (1 - amount)));
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function getThemeSettings() {
  return {
    accent: GM_getValue(THEME_ACCENT_KEY, THEME_DEFAULTS.accent),
    heartColor: GM_getValue(THEME_HEART_KEY, THEME_DEFAULTS.heartColor),
    idleOpacity: GM_getValue(THEME_IDLE_OPACITY_KEY, THEME_DEFAULTS.idleOpacity),
    idleDim: GM_getValue(THEME_IDLE_DIM_KEY, THEME_DEFAULTS.idleDim),
    hoverDim: GM_getValue(THEME_HOVER_DIM_KEY, THEME_DEFAULTS.hoverDim),
    activeOpacity: GM_getValue(THEME_ACTIVE_OPACITY_KEY, THEME_DEFAULTS.activeOpacity),
  };
}

// Applies the current theme settings to :root as CSS custom properties.
// Safe to call repeatedly (e.g. right after a Settings change) - it just
// overwrites the same handful of variables.
export function applyTheme() {
  const t = getThemeSettings();
  const root = document.documentElement.style;
  root.setProperty("--osu-fav-accent", t.accent);
  root.setProperty("--osu-fav-accent-dark", darkenHex(t.accent));
  root.setProperty("--osu-fav-heart-color", t.heartColor);
  root.setProperty("--osu-fav-idle-opacity", t.idleOpacity);
  root.setProperty("--osu-fav-idle-dim", t.idleDim);
  root.setProperty("--osu-fav-hover-dim", t.hoverDim);
  root.setProperty("--osu-fav-active-opacity", t.activeOpacity);
}

// Minimal heart glyph as real SVG (not emoji) - emoji hearts render from the
// system emoji font with a fixed, non-CSS-colorable presentation, which is
// exactly why they can't be recolored. This one uses fill/stroke, so
// --osu-fav-heart-color actually takes effect.
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
export function heartSVG(filled, size = 26) {
  return filled
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="var(--osu-fav-heart-color)"/></svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="none" stroke="var(--osu-fav-heart-color)" stroke-width="1.6"/></svg>`;
}

// Play/pause icons as inline SVGs - the old U+25B6/U+23F8 text glyphs get
// emoji presentation on mobile (▶️ / colored ⏸), which broke sizing and
// theming. SVGs render identically everywhere and inherit currentColor.
export function playSVG(size = 11) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="play"><path d="M8 5v14l11-7z"/></svg>`;
}

export function pauseSVG(size = 11) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="pause"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
}

// Player-bar icons - previous/next/shuffle/loop, same inline-SVG approach
// as playSVG/pauseSVG above and for the same reason.
export function prevSVG(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="previous"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`;
}
export function nextSVG(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="next"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
}
export function shuffleSVG(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="shuffle"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`;
}
export function loopSVG(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-label="loop"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>`;
}

