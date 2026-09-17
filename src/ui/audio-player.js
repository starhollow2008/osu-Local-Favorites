import { hinaiDurationSec, isFirefoxAndroid } from "../api/previews.js";
import { _blobUrlCache, forgetCachedMedia, getKnownCachedBlob, prewarmCachedPreview } from "../data/media-cache-db.js";
import { musicAutoNextEnabled, musicLoopEnabled, musicVolumePct } from "../data/playback-settings.js";
import {
  bindMediaSessionActions,
  clearMediaSession,
  refreshMediaSessionQueueActions,
  setMediaSessionMetadata,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition,
} from "./media-session.js";
import { pauseSVG, playSVG } from "./theme.js";

const SHORT_CLIP_MAX_SECONDS = 35;

// Singleton <audio> element, shared across every card's preview button
// and the Now Playing bar. Created once per page load and reused for the
// lifetime of the tab, so its listeners key off dynamic `_np*`/`_queue*`
// properties (reassigned by whichever panel is currently open) rather
// than closing over any one panel's local variables, which would go
// stale the moment that panel is closed and reopened.
export function ensureAudio() {
  if (window._osuFavAudio) return window._osuFavAudio;
  const audio = document.createElement("audio");
  // Keep a real media element alive for the lifetime of the page. Using a
  // normal network URL for playback (rather than swapping in blob: URLs
  // after an async cache lookup) keeps Firefox Android's media session tied
  // to a conventional media resource and, importantly, preserves the
  // original click's user activation for audio.play().
  // Firefox Android on Redmi devices starts media more reliably when the
  // element is not asked to fetch metadata before the tap. Calling play()
  // below still starts the request immediately from the user gesture.
  audio.preload = isFirefoxAndroid() ? "none" : "metadata";
  audio.setAttribute("playsinline", "");
  audio.setAttribute("aria-hidden", "true");
  audio.tabIndex = -1;
  audio.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none";
  audio.volume = musicVolumePct() / 100;
  (document.body || document.documentElement).appendChild(audio);
  window._osuFavAudio = audio;
  audio._activeBtn = null;
  audio._activeBar = null;
  audio._activeDim = null;
  audio._npBar = null;
  audio._npTitle = null;
  audio._npArtist = null;
  audio._npPlayBtn = null;
  audio._npProgressBar = null;
  audio._npThumb = null;
  audio._npBg = null;
  audio._npCurrentId = null;
  audio._npCurrentTitle = "";
  audio._npCurrentArtist = "";
  audio._queueNavigated = false;
  audio._queueDirection = 1;
  audio._queueSkipAttempt = 0;
  audio._queueAdvance = null;
  audio._fallbackPreviewUrl = null;
  audio._usingFullSongSource = false;
  audio._sourceFallbackAttempted = false;
  audio._hinaiDurationSec = null;
  // Source URL this track's bytes are cached under (the network URL, not
  // the blob: URL the element may end up playing), plus whether the current
  // source is that local copy. Owned by ui/main-panel.js
  // startPlayback(); initialized here so the page-lifetime element always
  // has the properties before any track is chosen.
  audio._activeCacheKey = null;
  audio._usingBlobCache = false;
  // Cache-first source selection bookkeeping, owned by
  // ui/main-panel.js startPlayback(): a monotonic id for the current
  // play request (so a source decided after the user moved on is dropped)
  // and the track whose source decision is still in flight (so its card's
  // button does not act on the previous track's still-assigned src).
  audio._playRequestSeq = 0;
  audio._pendingSourceId = null;

  audio.addEventListener("timeupdate", () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    if (audio._activeBar) audio._activeBar.style.width = pct + "%";
    if (audio._npProgressBar) audio._npProgressBar.style.width = pct + "%";
  });

  audio._mediaSessionSignature = null;

  // Kept as a property so the panel (which owns the Now Playing bar) can
  // force a position refresh right after it swaps the source, without
  // importing the media-session module itself.
  audio._updateMediaSessionPositionState = () => updateMediaSessionPosition(audio);
  bindMediaSessionActions(audio);

  audio.addEventListener("play", () => {
    if (audio._npPlayBtn) audio._npPlayBtn.innerHTML = pauseSVG();
    setMediaSessionMetadata(audio);
    // Queue availability can change between tracks (a preview started from
    // a card has no queue; one started from the panel list does), so the
    // skip handlers are re-evaluated on each play rather than once at
    // element creation.
    refreshMediaSessionQueueActions(audio);
    setMediaSessionPlaybackState("playing");
    updateMediaSessionPosition(audio);
  });
  audio.addEventListener("pause", () => {
    if (audio._npPlayBtn) audio._npPlayBtn.innerHTML = playSVG();
    if (!audio.ended) setMediaSessionPlaybackState("paused");
    // Freeze the OS widget at the exact paused position rather than
    // whatever it last extrapolated to.
    updateMediaSessionPosition(audio);
  });
  // Deliberately NOT bound to "timeupdate": that event fires every ~250ms
  // while foregrounded but gets throttled to roughly once/sec by the
  // browser when the tab is backgrounded - which is exactly when someone
  // is actually looking at this position (lock screen / OS media widget,
  // not our own in-page mini-player). Each throttled call reports a
  // position that's already ~1s stale by the time it reaches the native
  // widget, so the widget snaps back to it before resuming forward - a
  // visible "rewinds 1s every second" stutter. setPositionState() exists
  // precisely so the OS can extrapolate the position itself between
  // updates; we only need to call it on real discontinuities.
  const syncPosition = () => updateMediaSessionPosition(audio);
  audio.addEventListener("seeked", syncPosition);
  audio.addEventListener("durationchange", syncPosition);
  audio.addEventListener("ratechange", syncPosition);

  function fallbackToOfficialPreview(sourceAtEvent) {
    const mirrorUrl = audio._activePreviewUrl;
    const currentSource = audio.currentSrc || audio.src;
    const fallbackUrl = audio._fallbackPreviewUrl;
    if (
      !audio._usingFullSongSource ||
      audio._sourceFallbackAttempted ||
      !fallbackUrl ||
      !mirrorUrl ||
      (sourceAtEvent && currentSource !== sourceAtEvent)
    ) return false;

    audio._sourceFallbackAttempted = true;
    audio._usingFullSongSource = false;
    audio._hinaiDurationSec = null;
    // The source has moved off the mirror URL; stop treating a local copy of
    // those bytes as the current source, and let object-URL cleanup follow
    // the fallback URL from here on.
    audio._usingBlobCache = false;
    audio._activeCacheKey = fallbackUrl;

    // Cache-first for the official preview too: when a fresh local copy
    // exists the element is handed that blob: URL and the remote preview URL
    // is never assigned, so no request is made for it. This runs from an
    // asynchronous media error, so it reads the synchronous in-memory copy
    // rather than awaiting a lookup; a cold/missing entry prewarms for next
    // time and uses the network URL exactly as before. A cached copy that
    // itself fails is caught by the error handler below, which drops it and
    // retries from the network once.
    let fallbackSource = fallbackUrl;
    const cachedFallback = getKnownCachedBlob(fallbackUrl);
    if (cachedFallback) {
      let objUrl = _blobUrlCache.get(fallbackUrl);
      if (!objUrl) {
        objUrl = URL.createObjectURL(cachedFallback);
        _blobUrlCache.set(fallbackUrl, objUrl);
      }
      fallbackSource = objUrl;
      audio._usingBlobCache = true;
    } else {
      prewarmCachedPreview(fallbackUrl);
    }
    audio._activePreviewUrl = fallbackSource;
    audio.src = fallbackSource;
    audio.load();

    // Source replacement can make Firefox briefly report the failed mirror
    // as paused before the new preview begins. Keep the panel's mini-player
    // attached through that hand-off; the guards ensure an error or a newly
    // selected track can still remove it normally.
    const fallbackTrackId = audio._npCurrentId;
    const keepFallbackMiniPlayerVisible = () => {
      if (
        audio._npCurrentId !== fallbackTrackId ||
        audio._activePreviewUrl !== fallbackSource ||
        audio.ended ||
        !audio._npBar
      ) return;
      const bottomBar = audio._npBar.closest("#osu-fav-bottom-bar");
      if (!bottomBar || bottomBar.dataset.view !== "settings") {
        audio._npBar.style.display = "flex";
      }
    };
    keepFallbackMiniPlayerVisible();
    setTimeout(keepFallbackMiniPlayerVisible, 0);
    setTimeout(keepFallbackMiniPlayerVisible, 300);

    const retry = audio.play();
    if (retry && typeof retry.catch === "function") {
      // The fallback can be selected from an asynchronous media error,
      // outside the original tap's user-activation task. A rejected play()
      // here does not mean the official preview failed; keep Now Playing
      // visible so the user can resume it with the play control. A genuine
      // media error on this fallback still reaches the error handler below.
      // This used to read a variable that belongs to showFavoritesPanel()
      // in ui/main-panel.js and was never in scope in this function,
      // so the line threw a ReferenceError inside a promise catch. It
      // surfaced only as an unhandled rejection, and the mini-player it was
      // meant to keep on screen stayed hidden. The helper below already
      // makes the same decision, from state that is actually reachable.
      retry.catch(() => {
        keepFallbackMiniPlayerVisible();
      });
    }
    return true;
  }

  function hinaiReturnedPreview(audioEl) {
    if (!Number.isFinite(audioEl.duration)) return false;
    const expectedDuration = hinaiDurationSec(audioEl._hinaiDurationSec);
    if (expectedDuration !== null) {
      // Container/MP3 duration rounding is normally sub-second. Permit a
      // small margin, but a 30s fallback for a multi-minute song is never
      // mistaken for a full track.
      const margin = Math.max(2, expectedDuration * 0.01);
      return audioEl.duration + margin < expectedDuration;
    }
    return audioEl.duration <= SHORT_CLIP_MAX_SECONDS;
  }

  // Returns true when it has swapped the source, so callers know the
  // metadata they are looking at belongs to a clip being discarded.
  audio._maybeFallbackToOfficial = () => {
    if (audio._usingFullSongSource && hinaiReturnedPreview(audio)) {
      return fallbackToOfficialPreview(audio.currentSrc || audio.src);
    }
    return false;
  };

  // One handler for everything that has to happen when metadata arrives.
  // There used to be three separate "loadedmetadata" listeners whose
  // relative order was load-order-dependent; the fallback decision in
  // particular has to run before the position is published, or the OS
  // widget briefly advertises the duration of a clip we are about to
  // throw away.
  audio.addEventListener("loadedmetadata", () => {
    // The mirror endpoint uses a short osu! clip when it has no full
    // track. duration_sec, when available, avoids treating a genuinely
    // short full song as that fallback.
    if (audio._maybeFallbackToOfficial()) return;
    setMediaSessionMetadata(audio);
    updateMediaSessionPosition(audio);
  });

  // A mirror can be cold, unavailable, or return a response Firefox cannot
  // decode. Retry the official osu! clip once, but only for the source that
  // is currently active so a late error from an old track cannot interrupt a
  // newly selected one.
  audio.addEventListener("error", () => {
    const currentSource = audio.currentSrc || audio.src;

    // A local copy that will not decode (an interrupted write, storage
    // corruption, a codec the browser cannot pull out of a Blob) is dropped
    // from the cache and retried from the network once instead of looking
    // like a dead track. The retry uses whichever URL those bytes were
    // cached from, so an unreachable mirror still falls through to the
    // official preview by the branch below.
    if (audio._usingBlobCache && audio._activeCacheKey) {
      const failedKey = audio._activeCacheKey;
      const resumeAt = audio.currentTime;
      forgetCachedMedia(failedKey);
      audio._usingBlobCache = false;
      audio._activePreviewUrl = failedKey;
      audio.src = failedKey;
      audio.load();
      try {
        audio.currentTime = resumeAt;
      } catch (e) {
        // Not seekable until metadata for the retry is in - fine, it starts
        // from the top.
      }
      const retry = audio.play();
      if (retry && typeof retry.catch === "function") {
        retry.catch(() => resetPlaybackAfterError(audio));
      }
      return;
    }

    if (audio._usingFullSongSource) {
      fallbackToOfficialPreview(currentSource);
    } else if (
      audio._sourceFallbackAttempted &&
      !!audio._fallbackPreviewUrl &&
      // The fallback is normally the raw official URL, but it is a blob: URL
      // when that preview was served from the cache - compare against
      // whichever source it actually selected.
      (audio._activePreviewUrl || audio._fallbackPreviewUrl) === currentSource
    ) {
      resetPlaybackAfterError(audio);
    }
  });

  audio.addEventListener("ended", () => {
    // Do NOT clearMediaSession() before a loop/auto-next: nulling the
    // metadata (even for one synchronous tick before startPlayback()
    // re-populates it) can make Android treat the session as ended and
    // tear down the notification's foreground service. On a locked
    // screen there is nothing left keeping the page alive after that, so
    // playback dies a few seconds into the *next* track even though the
    // handoff itself looked instantaneous in the console. Only clear the
    // session on the branch below where playback is actually stopping.
    if (musicLoopEnabled()) {
      audio.currentTime = 0;
      // A rejected play() here (autoplay policy after a long lock-screen
      // idle) previously surfaced as an unhandled rejection, and left the
      // OS widget advertising "playing" for audio that had stopped.
      const looped = audio.play();
      if (looped && typeof looped.catch === "function") {
        looped.catch(() => {
          setMediaSessionPlaybackState("paused");
          if (audio._npPlayBtn) audio._npPlayBtn.innerHTML = playSVG();
        });
      }
      return;
    }
    if (musicAutoNextEnabled() && audio._queueAdvance) {
      audio._queueAdvance(1, {});
      return;
    }
    stopPlayback(audio);
  });

  return audio;
}

// Single teardown for "playback has stopped for good" - end of queue, or
// both the mirror source and its one official fallback failing.
//
// This was previously two near-identical copies (the "ended" handler and
// resetPlaybackAfterError) which had already drifted apart: only one of
// them reset the card button's _playing flag, so a preview that failed
// outright left its button stuck showing pause until the panel was
// reopened. One copy also dereferenced _activeBar.parentElement with no
// guard, which throws if the row was re-rendered while the clip loaded.
function stopPlayback(audio) {
  if (audio._activeBtn) {
    audio._activeBtn.innerHTML = playSVG();
    audio._activeBtn._playing = false;
    audio._activeBtn.style.opacity = "var(--osu-fav-idle-opacity, 0.15)";
    audio._activeBtn.style.borderColor = "#333";
    audio._activeBtn.style.color = "#999";
  }
  if (audio._activeBar) {
    if (audio._activeBar.parentElement) audio._activeBar.parentElement.style.display = "none";
    audio._activeBar.style.width = "0%";
  }
  if (audio._activeDim) audio._activeDim.style.background = "rgba(51,51,51,var(--osu-fav-idle-dim, 0))";
  audio._activeBtn = null;
  audio._activeBar = null;
  audio._activeDim = null;
  if (audio._npBar) audio._npBar.style.display = "none";
  if (audio._npProgressBar) audio._npProgressBar.style.width = "0%";
  audio._npCurrentId = null;
  audio._npCurrentTitle = "";
  audio._npCurrentArtist = "";
  audio._pendingSourceId = null;
  audio._queueAdvance = null;
  // Drop the now-dead skip handlers too, so the OS widget stops offering
  // next/previous for a queue that no longer exists.
  refreshMediaSessionQueueActions(audio);
  clearMediaSession(audio);
}

// Called by the panel when a source fails before any card binding exists.
function resetPlaybackAfterError(audio) {
  stopPlayback(audio);
}

// Builds the ordered list of download options for a beatmapset. Official
// download offers both a with-video and no-video (confirmed real
// ?noVideo=1 param) variant - previously this was hardcoded to
// video-only. Guests always see mirrors first, since Official won't work
// for them no matter what; logged-in users get their configured order.
