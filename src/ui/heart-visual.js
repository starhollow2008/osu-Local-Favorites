// ═══ Visual helpers ═══
export function updateHeartVisual(el, isFav) {
  // Update FontAwesome heart solid/outline.
  const heart = el.querySelector(".fa-heart");
  if (heart) {
    heart.classList.toggle("far", !isFav);
    heart.classList.toggle("fas", isFav);
  }

  // osu! uses SVG heart icons in some layouts. Those buttons are detected by
  // favorite-detection.js, but the old visual update only handled FontAwesome
  // markup, so the click was persisted while the page heart stayed unchanged.
  const svg = el.querySelector("svg");
  if (svg) {
    svg.style.color = isFav ? "var(--osu-fav-heart-color)" : "";
    svg.style.fill = isFav ? "currentColor" : "";
    svg.setAttribute("data-osu-fav-active", isFav ? "1" : "0");
  }
  el.setAttribute("aria-pressed", isFav ? "true" : "false");
  el.setAttribute("data-osu-fav-active", isFav ? "1" : "0");

  // Also update the container span's disabled/active look
  const cls = (el.className || "").toString();
  if (cls.includes("beatmapset-panel__menu-item")) {
    el.classList.toggle("beatmapset-panel__menu-item--disabled", false);
    if (isFav) {
      el.style.color = "var(--osu-fav-heart-color)";
      el.style.cursor = "pointer";
      el.removeAttribute("data-orig-title");
      el.title = "Remove from local favorites";
    } else {
      el.style.color = "";
      el.style.cursor = "pointer";
      el.title = "Add to local favorites";
    }
  }
}

