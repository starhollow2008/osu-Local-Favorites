import { GM_getValue } from "../core/gm-shim.js";

// ═══ Music Playback settings (loop / auto next / shuffle / volume) ═══
export const MUSIC_LOOP_KEY = "osu_music_loop";
export const MUSIC_AUTONEXT_KEY = "osu_music_autonext";
export const MUSIC_SHUFFLE_KEY = "osu_music_shuffle";
export const MUSIC_VOLUME_KEY = "osu_music_volume"; // 0-100, applied as audio.volume/100
export function musicLoopEnabled() {
  return GM_getValue(MUSIC_LOOP_KEY, false);
}
export function musicAutoNextEnabled() {
  return GM_getValue(MUSIC_AUTONEXT_KEY, false);
}
export function musicShuffleEnabled() {
  return GM_getValue(MUSIC_SHUFFLE_KEY, false);
}
export function musicVolumePct() {
  const v = GM_getValue(MUSIC_VOLUME_KEY, 100);
  return typeof v === "number" && v >= 0 && v <= 100 ? v : 100;
}

