import { hinaiDurationSec } from "../api/previews.js";
import { getFavorites } from "../data/storage.js";

// ═══ Media Session ═══
// Everything that talks to navigator.mediaSession - the OS-level media
// widget (Android notification / lock screen, macOS Now Playing, Windows
// SMTC). Split out of ui/audio-player.js, which is now only responsible
// for the <audio> element and the in-page mini-player.
//
// Every entry point is defensive on purpose. Media Session is unevenly
// implemented: Firefox Android has it but not setPositionState on older
// builds, some Chromium builds throw on a setActionHandler for an action
// they don't support, and Safari implements a subset. A throw from any of
// these would otherwise propagate into an <audio> event handler and break
// playback control that has nothing to do with the OS widget.

function mediaSession() {
  if (typeof navigator === "undefined") return null;
  return "mediaSession" in navigator && navigator.mediaSession ? navigator.mediaSession : null;
}

export function mediaSessionAvailable() {
  return mediaSession() !== null;
}

// osu!'s canonical cover renditions and their real pixel dimensions.
// Supplying `sizes` lets the OS pick the right rendition instead of
// downloading whichever one happens to be listed first - Android's
// notification wants something small, the lock screen wants the large one.
// Only applied to URLs that match osu!'s own cover path, so a custom or
// cached URL is still offered, just without a size hint.
const OSU_COVER_SIZES = [
  ["list@2x", "300x210"],
  ["card", "400x140"],
  ["card@2x", "800x280"],
  ["cover", "900x250"],
  ["cover@2x", "1800x500"],
];

function artworkEntry(src) {
  if (!src) return null;
  const entry = { src, type: "image/jpeg" };
  const match = /\/covers\/([a-z@0-9]+)\.jpg/i.exec(src);
  if (match) {
    const known = OSU_COVER_SIZES.find(([name]) => name === match[1].toLowerCase());
    if (known) entry.sizes = known[1];
  }
  return entry;
}

// Returns several renditions rather than one. The previous single-entry
// version handed Android a 900x250 banner for a 64px notification icon,
// which some devices simply refused to decode and rendered as a blank tile.
function buildArtwork(favorite, id) {
  const covers = (favorite && favorite.covers) || {};
  const candidates = [
    covers.list,
    covers["list@2x"],
    covers.card,
    covers["card@2x"],
    covers.cover,
    id ? `https://assets.ppy.sh/beatmaps/${id}/covers/list@2x.jpg` : null,
    id ? `https://assets.ppy.sh/beatmaps/${id}/covers/card.jpg` : null,
  ];
  const seen = new Set();
  const artwork = [];
  for (const src of candidates) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const entry = artworkEntry(src);
    if (entry) artwork.push(entry);
  }
  return artwork;
}

// Set metadata only when the track actually changed. The old code rebuilt
// a MediaMetadata on every "play" event, including a resume from pause -
// on Android that re-posts the notification, which visibly flickers the
// artwork and, on some builds, resets the OS widget's seek bar.
export function setMediaSessionMetadata(audio, { force = false } = {}) {
  const session = mediaSession();
  if (!session || typeof MediaMetadata !== "function") return;
  if (!audio || !audio._npCurrentId) return;

  const signature = [audio._npCurrentId, audio._npCurrentTitle, audio._npCurrentArtist].join("\u0000");
  if (!force && audio._mediaSessionSignature === signature && session.metadata) return;

  const fav = getFavorites()[audio._npCurrentId] || {};
  try {
    session.metadata = new MediaMetadata({
      title: audio._npCurrentTitle || "Unknown",
      artist: audio._npCurrentArtist || "",
      album: "osu! Local Favorites",
      artwork: buildArtwork(fav, audio._npCurrentId),
    });
    audio._mediaSessionSignature = signature;
  } catch (_) {
    // A rejected MediaMetadata (bad artwork URL, unsupported field) must
    // not leave a stale signature behind, or the next attempt is skipped.
    audio._mediaSessionSignature = null;
  }
}

export function setMediaSessionPlaybackState(state) {
  const session = mediaSession();
  if (!session) return;
  try {
    session.playbackState = state;
  } catch (_) {}
}

// Firefox for Android can expose a live/cross-origin stream to the media
// notification before it has derived a finite HTMLMediaElement duration.
// The Hinamizawa Song response already carries that duration, so it stands
// in rather than publishing the 00:00-00:00 range shown by some devices.
function resolveDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const hinted = hinaiDurationSec(audio._hinaiDurationSec);
  return hinted !== null && hinted > 0 ? hinted : null;
}

export function updateMediaSessionPosition(audio) {
  const session = mediaSession();
  if (!session || typeof session.setPositionState !== "function") return;
  const duration = resolveDuration(audio);
  if (duration === null) return;

  // playbackRate must be > 0: the spec rejects 0, which is exactly what a
  // media element reports in some paused/stalled states, and the resulting
  // throw used to be swallowed - leaving the OS widget frozen on the
  // previous track's position for the rest of the session.
  const rate = Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1;
  const position = Math.min(Math.max(0, audio.currentTime || 0), duration);
  try {
    session.setPositionState({ duration, playbackRate: rate, position });
  } catch (_) {
    // Some builds reject position updates while media is transitioning
    // between sources; playback itself is unaffected.
  }
}

function clearPositionState() {
  const session = mediaSession();
  if (!session || typeof session.setPositionState !== "function") return;
  try {
    // Called with no argument, this resets the state. The old code never
    // did this, so after playback stopped the OS widget kept showing the
    // last track's elapsed time against its full duration.
    session.setPositionState();
  } catch (_) {}
}

function setHandler(session, action, handler) {
  try {
    session.setActionHandler(action, handler);
    return true;
  } catch (_) {
    // Unsupported action - the browser tells us by throwing.
    return false;
  }
}

// Previous/next are registered separately from the transport controls
// because they must reflect whether a queue exists. Registering them
// unconditionally (as before) makes Android draw enabled skip buttons that
// silently do nothing whenever playback was started outside the panel.
export function refreshMediaSessionQueueActions(audio) {
  const session = mediaSession();
  if (!session || typeof session.setActionHandler !== "function") return;
  const hasQueue = typeof audio._queueAdvance === "function";
  setHandler(session, "previoustrack", hasQueue ? () => audio._queueAdvance(-1, {}) : null);
  setHandler(session, "nexttrack", hasQueue ? () => audio._queueAdvance(1, {}) : null);
}

export function bindMediaSessionActions(audio) {
  const session = mediaSession();
  if (!session || typeof session.setActionHandler !== "function") return;

  const seekOffsetOf = (details, fallback = 10) =>
    Number.isFinite(details && details.seekOffset) ? details.seekOffset : fallback;
  const endOf = () => (Number.isFinite(audio.duration) ? audio.duration : Infinity);

  setHandler(session, "play", () => {
    const started = audio.play();
    if (started && typeof started.catch === "function") started.catch(() => {});
  });
  setHandler(session, "pause", () => audio.pause());
  setHandler(session, "stop", () => {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (_) {}
    clearMediaSession();
  });
  setHandler(session, "seekbackward", (details) => {
    audio.currentTime = Math.max(0, audio.currentTime - seekOffsetOf(details));
    updateMediaSessionPosition(audio);
  });
  setHandler(session, "seekforward", (details) => {
    audio.currentTime = Math.min(endOf(), audio.currentTime + seekOffsetOf(details));
    updateMediaSessionPosition(audio);
  });
  setHandler(session, "seekto", (details) => {
    if (!details || !Number.isFinite(details.seekTime)) return;
    // fastSeek is what the spec asks us to honour for scrub gestures; it
    // is not implemented everywhere, so fall back to a normal seek.
    const target = Math.max(0, Math.min(endOf(), details.seekTime));
    if (details.fastSeek && typeof audio.fastSeek === "function") {
      try {
        audio.fastSeek(target);
      } catch (_) {
        audio.currentTime = target;
      }
    } else {
      audio.currentTime = target;
    }
    updateMediaSessionPosition(audio);
  });

  refreshMediaSessionQueueActions(audio);
}

export function clearMediaSession(audio) {
  const session = mediaSession();
  if (!session) return;
  try {
    session.metadata = null;
  } catch (_) {}
  if (audio) audio._mediaSessionSignature = null;
  clearPositionState();
  setMediaSessionPlaybackState("none");
}
