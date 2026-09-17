import { getBeatmapId } from "../data/beatmap-extraction.js";
import { isFavorited } from "../data/storage.js";
import { toggleFavorite } from "../data/toggle-favorite.js";

// ═══ Guest-mode fallback button ═══
// On beatmapset detail pages (/beatmapsets/12345), no heart button exists when
// not signed in. We inject a standalone button into the page header area.
export function addGuestFavoriteButton() {
  const path = location.pathname;
  // Only on beatmapset detail pages (not the listing /beatmapsets)
  if (!path.match(/^\/beatmapsets\/\d+/)) return;
  // Don't inject if already present
  if (document.getElementById("osu-local-guest-fav-btn")) return;

  const bmid = getBeatmapId();
  if (!bmid) return;

  // If the native osu! favourite button already exists on the page (user is logged in),
  // we don't need to inject our guest fallback - our click interceptor handles the native
  // button. Osu!'s own class/title FLIPS once a beatmapset is already favourited
  // (…-square-favourite/"favourite this beatmap" → …-square-unfavourite/"unfavourite
  // this beatmap"), so both states must be checked or an already-favourited map's native
  // button goes undetected and we'd inject a visually-identical duplicate heart next to it.
  if (
    document.querySelector('[class*="-square-favourite"]') ||
    document.querySelector('[class*="-square-unfavourite"]') ||
    document.querySelector("button[data-orig-title='favourite this beatmap']") ||
    document.querySelector("button[data-orig-title='unfavourite this beatmap']") ||
    document.querySelector("button[title='favourite this beatmap']") ||
    document.querySelector("button[title='unfavourite this beatmap']")
  ) return;

  // Try multiple anchor points in order of preference.
  // Prefer the header buttons row (.beatmapset-header__buttons) so our button sits alongside
  // the native download buttons. Fall back progressively for older/different page layouts.
  const anchor =
    document.querySelector(".beatmapset-header__buttons") ||
    document.querySelector(".beatmapset-header__actions") ||
    document.querySelector("[class*='beatmapset-header__actions']") ||
    document.querySelector(".beatmapset__header .beatmapset-header__details") ||
    document.querySelector(".beatmapset__header") ||
    document.querySelector(".beatmapset-info") ||
    null;

  if (!anchor) return;

  const fav = isFavorited(bmid);

  // Build the button using the exact same class and inner-HTML structure as osu!'s
  // native favourite button - so it sits flush with the download buttons and uses
  // the page's own CSS for sizing, colours, and hover effects.
  const btn = document.createElement("button");
  btn.id = "osu-local-guest-fav-btn";
  btn.type = "button";
  btn.className =
    "btn-osu-big btn-osu-big--beatmapset-header-square " +
    "btn-osu-big--beatmapset-header-square-favourite";
  btn.setAttribute(
    "data-orig-title",
    fav ? "remove from local favorites" : "save to local favorites"
  );
  // Inner HTML mirrors the native button exactly:
  // <span.btn-osu-big__content> > <span.btn-osu-big__icon> > <span.fa.fa-fw> > <span.{far|fas}.fa-heart>
  btn.innerHTML =
    '<span class="btn-osu-big__content btn-osu-big__content--center">' +
    '<span class="btn-osu-big__icon">' +
    '<span class="fa fa-fw">' +
    '<span class="' + (fav ? "fas" : "far") + ' fa-heart" style="color:var(--osu-fav-heart-color)"></span>' +
    '</span>' +
    '</span>' +
    '</span>';

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nowFav = toggleFavorite(bmid, null);
    // Mirror the native button's animation
    btn.style.transform = "scale(1.15)";
    btn.style.transition = "transform 0.1s";
    setTimeout(() => { btn.style.transform = "scale(1)"; }, 120);
    // Toggle the heart icon class
    const heart = btn.querySelector(".fa-heart");
    if (heart) {
      heart.classList.toggle("far", !nowFav);
      heart.classList.toggle("fas", nowFav);
      heart.style.color = "var(--osu-fav-heart-color)";
    }
    btn.setAttribute(
      "data-orig-title",
      nowFav ? "remove from local favorites" : "save to local favorites"
    );
  });

  // Prepend so it appears before the download buttons, matching logged-in position
  anchor.insertBefore(btn, anchor.firstChild);
}

