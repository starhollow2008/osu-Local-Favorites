import { reportError } from "../core/errors.js";
import { GM_getValue, GM_setValue } from "../core/gm-shim.js";
import { getBeatmapId, resolveBeatmapContext } from "../data/beatmap-extraction.js";
import { isFavButton } from "../data/favorite-detection.js";
import { isFavorited } from "../data/storage.js";
import { toggleFavorite } from "../data/toggle-favorite.js";
import { showFavoritesPanel } from "./main-panel.js";
import { updateHeartVisual } from "./heart-visual.js";
import { heartSVG } from "./theme.js";

// ═══ Floating heart - always visible on all osu! pages ═══
// Visual language matches the rest of LOF's UI (flat dark surface, 1px
// hairline border, small radius, accent used sparingly) instead of the old
// generic glowing-circle look.
const IND_POS_KEY = "osu_fav_ind_pos"; // {right,bottom} px from bottom-right

function indApplyVisual(ind, fav, dragging) {
  // updateFloatingHeart() runs on every debounced DOM-mutation pass and
  // every cross-tab sync; rebuilding the SVG innerHTML each time churned
  // the DOM (parse + node replacement + style invalidation) several times
  // per second even when the heart's state hadn't changed. Skip when the
  // visual state is identical - the very first call still renders.
  if (ind._lastFav === fav && ind._lastDragging === dragging) return;
  ind._lastFav = fav;
  ind._lastDragging = dragging;
  ind.innerHTML = heartSVG(fav);
  ind.style.background = "rgba(17,17,17,0.95)";
  ind.style.border = fav ? "1px solid var(--osu-fav-accent)" : "1px solid #333";
  // No glow in either state. The accent-coloured border is already the
  // favorited signal; the pink drop shadow on top of it was the one piece
  // of the old "glowing circle" look left over, and it read as a halo
  // around the button on beatmap pages. Explicitly set to "none" rather
  // than removed, so a favorited -> unfavorited transition still clears
  // any shadow left on the element.
  ind.style.boxShadow = "none";
  ind.style.opacity = dragging ? "0.85" : "";
}

export function ensureHeartIndicator() {
  if (document.getElementById("osu-local-fav-ind")) return;

  const ind = document.createElement("div");
  ind.id = "osu-local-fav-ind";
  Object.assign(ind.style, {
    position: "fixed",
    bottom: "40px",
    right: "100px",
    zIndex: "99999",
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "border-color 0.15s ease, opacity 0.15s ease",
    userSelect: "none",
    touchAction: "none",
  });

  // Restore last saved position (drag is persisted across pages/sessions)
  try {
    const saved = GM_getValue(IND_POS_KEY, null);
    if (saved && typeof saved.right === "number" && typeof saved.bottom === "number") {
      // Clamp into the viewport in case the window shrank since saving
      const maxR = Math.max(0, window.innerWidth - 46);
      const maxB = Math.max(0, window.innerHeight - 46);
      ind.style.right = Math.min(Math.max(0, saved.right), maxR) + "px";
      ind.style.bottom = Math.min(Math.max(0, saved.bottom), maxB) + "px";
    }
  } catch (e) { }

  const update = () => {
    const bmid = getBeatmapId();
    const fav = bmid ? isFavorited(bmid) : false;
    indApplyVisual(ind, fav, false);
    // Clicking heart always opens favorites panel
    ind.title = "View local favorites (hold + drag to move)";
  };

  // ── Click vs hold-to-drag ──
  // A short press without movement = click (open panel). Holding for
  // HOLD_MS or moving > MOVE_THRESHOLD px starts a drag; the new position
  // is anchored to bottom/right so it survives resizes, and persisted.
  const HOLD_MS = 250;
  const MOVE_THRESHOLD = 6;
  let pressTimer = null;
  let dragging = false;
  let dragMoved = false;
  let startX = 0, startY = 0, startRight = 0, startBottom = 0;
  let suppressClick = false;

  ind.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = false;
    dragMoved = false;
    suppressClick = false;
    startX = e.clientX;
    startY = e.clientY;
    startRight = parseFloat(ind.style.right) || 100;
    startBottom = parseFloat(ind.style.bottom) || 40;
    pressTimer = setTimeout(() => {
      dragging = true;
      suppressClick = true;
      ind.setPointerCapture(e.pointerId);
      indApplyVisual(ind, isFavorited(getBeatmapId()) , true);
    }, HOLD_MS);
    e.preventDefault();
  });

  ind.addEventListener("pointermove", (e) => {
    if (!dragging) {
      // Cancel pending drag if the finger/mouse moved before hold elapsed
      if (pressTimer && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      return;
    }
    dragMoved = true;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const right = Math.min(Math.max(0, startRight - dx), Math.max(0, window.innerWidth - ind.offsetWidth));
    const bottom = Math.min(Math.max(0, startBottom - dy), Math.max(0, window.innerHeight - ind.offsetHeight));
    ind.style.right = right + "px";
    ind.style.bottom = bottom + "px";
  });

  const endPress = (e) => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (dragging) {
      dragging = false;
      indApplyVisual(ind, isFavorited(getBeatmapId()), false);
      if (dragMoved) {
        GM_setValue(IND_POS_KEY, {
          right: parseFloat(ind.style.right) || 0,
          bottom: parseFloat(ind.style.bottom) || 0,
        });
        suppressClick = true;
      }
    }
  };
  ind.addEventListener("pointerup", endPress);
  ind.addEventListener("pointercancel", endPress);

  ind.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (suppressClick) { suppressClick = false; return; }
    showFavoritesPanel();
  });

  document.body.appendChild(ind);
  update();
}

function updateGuestButtonVisual() {
  const btn = document.getElementById("osu-local-guest-fav-btn");
  if (!btn) return;
  const bmid = getBeatmapId();
  if (!bmid) return;
  const fav = isFavorited(bmid);
  const heart = btn.querySelector(".fa-heart");
  if (heart) {
    heart.classList.toggle("far", !fav);
    heart.classList.toggle("fas", fav);
    // Inline style wins over osu!'s own stylesheet rules, so our button
    // reads as clearly "ours" rather than an indistinguishable copy of
    // osu!'s native heart.
    heart.style.color = "var(--osu-fav-heart-color)";
  }
  btn.setAttribute(
    "data-orig-title",
    fav ? "remove from local favorites" : "save to local favorites"
  );
}

export function updateFloatingHeart() {
  const ind = document.getElementById("osu-local-fav-ind");
  if (!ind) return;
  const bmid = getBeatmapId();
  const fav = bmid ? isFavorited(bmid) : false;
  indApplyVisual(ind, fav, false);
  updateGuestButtonVisual();
}

// ═══ Click interception ═══
document.addEventListener(
  "click",
  function (e) {
    // Never treat clicks inside our own UI (the favorites panel or the
    // download-mirror popover) as a native-page favourite-button click.
    // isFavButton()'s matching is heuristic (title/class/icon-based) and
    // meant for osu!'s own page elements - it previously misfired on our
    // own "Download ▾" menu, e.g. the "Official Download (requires
    // sign-in)" row, which doesn't carry a "download" title/class, only
    // the word in its visible text. The panel and menu already handle
    // all of their own actions directly (toggleFavorite, removeBtn,
    // showDownloadMenu's row links), so excluding them here entirely is
    // both the fix and the more robust long-term guard.
    if (e.target.closest("#osu-local-fav-panel, #osu-fav-dl-menu")) return;

    // Also intercept clicks on the guest-disabled <span> (not just button/a)
    const button = e.target.closest("button, a, span.beatmapset-panel__menu-item");
    if (!button || !isFavButton(button)) return;

    // As soon as we've identified this as a favorite button, we commit to
    // handling the click ourselves - block osu!'s own click handler
    // unconditionally, even if something below fails. Previously this only
    // happened after beatmap-id resolution succeeded, so a resolution
    // failure would silently fall through to osu!'s real click handler -
    // which our own XHR/fetch interceptor then turns into a broken fake
    // response, since it blindly fakes *any* request to a "/favourites"
    // URL regardless of whether we handled the click. Blocking here always
    // avoids that half-broken passthrough state.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    try {
      const ctx = resolveBeatmapContext(button);
      if (!ctx.beatmapId) {
        // Not an error: isFavButton()'s matching is heuristic, so an
        // occasional false positive can slip past it. Just ignore the click
        // quietly instead of spamming the console and toasting the user.
        console.debug(
          "[osu-local-favorites] ignoring heart-like button without resolvable beatmap id",
          button,
        );
        return;
      }

      const nowFav = toggleFavorite(ctx.beatmapId, ctx.card);
      updateHeartVisual(button, nowFav);

      button.style.transform = "scale(1.2)";
      button.style.transition = "transform 0.1s ease";
      setTimeout(() => {
        button.style.transform = "scale(1)";
      }, 120);
    } catch (err) {
      reportError("Toggle favorite", err);
    }
  },
  true,
);

// ═══ Refresh visible buttons ═══
export function refreshButtons() {
  // Cheap short-circuit: isFavButton() only ever returns true for an
  // element on an actual beatmapset detail page or one sitting inside a
  // ".beatmapset-panel" (listing/profile cards) - every other branch in it
  // requires one of those two. On any other page (dashboard, forum, wiki,
  // chat, settings, etc.) that's guaranteed false for literally every
  // element, so skip straight past the expensive "every <button> on the
  // whole page" scan below rather than running it - and the several
  // querySelector/closest calls inside isFavButton() for each one - on
  // totally unrelated pages, every 1.5s and on every DOM mutation, for as
  // long as the tab stays open. This is a pure short-circuit: it changes
  // nothing about which buttons get matched, only skips the work when the
  // page couldn't possibly contain any.
  if (!getBeatmapId() && !document.querySelector(".beatmapset-panel, .beatmapset-panel__menu-item")) {
    return;
  }

  // Also scan disabled <span> elements used when the user is not signed in
  const candidates = document.querySelectorAll(
    "button, span.beatmapset-panel__menu-item",
  );
  candidates.forEach((btn) => {
    // Cheapest checks first. The dataset flag must gate BEFORE isFavButton()
    // - the old order ran the full heuristic (several querySelector calls
    // per candidate) on every already-processed button on every pass. And
    // everything inside our own UI is skipped outright: an open favorites
    // panel alone can hold thousands of <button>s (rows × Open/Download/
    // Remove/preview), each of which would otherwise run isFavButton() -
    // and always fail - on every debounced mutation pass and 1.5s interval
    // tick for as long as the panel stays open.
    if (btn.dataset.osuFavChecked) return;
    if (btn.closest("#osu-local-fav-panel, #osu-fav-dl-menu, #osu-local-fav-ind")) return;
    if (!isFavButton(btn)) return;
    const ctx = resolveBeatmapContext(btn);
    // Context couldn't be resolved yet - this is common when a card is
    // still mid-render (fast scroll / infinite-load on search & profile
    // pages). Do NOT mark it checked here, or it'll be skipped forever and
    // silently show the wrong (unfavorited) heart state even though it's
    // actually in local favorites - clicking it would then remove it
    // instead of doing nothing. Leave it unmarked so the next pass (mutation
    // observer or periodic fallback) retries once the card has settled.
    if (!ctx.beatmapId) return;
    btn.dataset.osuFavChecked = "1";
    // Record the resolved id on the element. resolveBeatmapContext() is the
    // expensive part of this scan (several closest()/querySelector calls),
    // and resyncFavoriteButtons() below needs to re-derive the favorited
    // state for exactly these buttons on every change - reading it back
    // from the dataset turns that into a plain attribute lookup.
    btn.dataset.osuFavId = String(ctx.beatmapId);
    updateHeartVisual(btn, isFavorited(ctx.beatmapId));
    // Make the disabled span look clickable
    if (btn.tagName === "SPAN") {
      btn.style.cursor = "pointer";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });
}

// The audio element is deliberately page-lifetime. Closing the favorites panel
// must only detach the panel UI - never pause/reset the actual preview. This lets
// previews keep playing while the user closes the panel, switches tabs, or opens
// another app on mobile. A newly opened panel re-binds its Now Playing controls.
export function clearFavoritesPanelAudio() {
  const audio = window._osuFavAudio;
  if (!audio) return;
  audio._activeBtn = null;
  audio._activeBar = null;
  audio._activeDim = null;
  audio._npBar = null;
  audio._npTitle = null;
  audio._npArtist = null;
  audio._npPlayBtn = null;
  audio._npProgressBar = null;
  // The queue callback closes over this panel's DOM/list, so do not keep it after
  // the panel is gone. Playback itself remains untouched.
  audio._queueAdvance = null;
}

// Re-derives the favorited state of every heart already drawn on the page,
// plus the floating indicator and the guest button.
//
// This is the single subscriber to storage's change notification, so any
// mutation from anywhere - the panel, a card click, Copy All, a Gist
// restore, another tab - lands on every visible surface at once. It is
// deliberately cheap: no DOM scan for new buttons (refreshButtons() owns
// that) and no context re-resolution, just an attribute read per button
// that was already processed.
export function resyncFavoriteButtons() {
  document.querySelectorAll("[data-osu-fav-id]").forEach((btn) => {
    const id = btn.dataset.osuFavId;
    if (!id) return;
    updateHeartVisual(btn, isFavorited(id));
  });
  updateFloatingHeart();
  updateGuestButtonVisual();
}

// Clears the "already processed" markers so the next refreshButtons() pass
// re-examines every candidate from scratch. Needed after a navigation that
// swapped the page content without going through hardResync() - the markers
// survive on a restored Turbolinks snapshot and would otherwise make every
// heart on it permanently unreachable.
export function invalidateButtonMarkers() {
  document.querySelectorAll("[data-osu-fav-checked]").forEach((btn) => {
    btn.removeAttribute("data-osu-fav-checked");
    btn.removeAttribute("data-osu-fav-id");
  });
}
