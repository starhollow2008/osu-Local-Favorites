import { getBeatmapId } from "./beatmap-extraction.js";

// ═══ Favorite button detection ═══
// Accepts BUTTON, A, and SPAN elements (the guest-disabled span on listing pages).
export function isFavButton(el) {
  if (el.id === "osu-local-guest-fav-btn") return false;
  const tag = el.tagName;
  const isInteractive = tag === "BUTTON" || tag === "A" || tag === "SPAN";
  if (!isInteractive) return false;

  const cls = (el.className || "").toString();
  const title = (
    el.getAttribute("title") ||
    el.getAttribute("data-orig-title") ||
    el.getAttribute("aria-label") ||
    ""
  ).toLowerCase();
  const text = (el.textContent || "").toLowerCase().trim();

  // Reject download buttons immediately - never treat them as fav buttons
  if (
    cls.includes("download") ||
    title.includes("download") ||
    text.includes("download") ||
    el.querySelector(".fa-file-download, .fa-download, .fas.fa-file-download, .fas.fa-download")
  ) return false;

  // ── Fast path: the guest-disabled span osu! renders when not signed in ──
  // <span class="beatmapset-panel__menu-item beatmapset-panel__menu-item--disabled"
  //       data-orig-title="sign in to favourite this beatmap">
  //   <span class="far fa-heart"></span>
  // </span>
  if (
    cls.includes("beatmapset-panel__menu-item") &&
    (cls.includes("disabled") || cls.includes("avourite") || cls.includes("avorite"))
  ) return true;
  if (cls.includes("beatmapset-panel__menu-item") && el.querySelector(".fa-heart"))
    return true;

  // For SPANs that aren't the specific menu-item, require them to look like a fav button
  if (tag === "SPAN") {
    if (title.includes("avourite") || title.includes("avorite")) return true;
    // Only match spans that contain a heart icon and are inside a beatmap panel
    if (
      el.querySelector(".fa-heart, .fas.fa-heart, .far.fa-heart") &&
      el.closest(".beatmapset-panel")

    ) return true;
    return false;
  }

  // BUTTON / A checks below
  // Guard: only treat a heart-icon button as a fav button when it actually
  // sits in a beatmap context (a beatmapset detail page, or inside a listing
  // card). Hearts also appear on profiles, forums, modding posts, etc., and
  // previously those matched here, then failed id resolution and produced
  // spurious "couldn't resolve a beatmap id" errors.
  const hasBeatmapContext =
    !!getBeatmapId() || !!el.closest(".beatmapset-panel");
  if (!hasBeatmapContext) return false;

  if (
    el.querySelector(
      ".fa-heart, .fas.fa-heart, .far.fa-heart, .fal.fa-heart, .fa-solid.fa-heart, .fa-regular.fa-heart",
    )
  )
    return true;

  const svg = el.querySelector("svg");
  if (svg) {
    const path = svg.querySelector("path");
    if (path) {
      const d = path.getAttribute("d") || "";
      const svgClass = (svg.getAttribute("class") || "").toLowerCase();
      if (
        d.startsWith("M") &&
        d.includes("C") &&
        d.length > 20 &&
        svgClass.includes("heart")
      )
        return true;
    }
  }

  // title and text are already declared at top of function - reuse them
  if (title.includes("avourite") || title.includes("avorite")) return true;

  if (text.includes("avourite") || text.includes("avorite")) return true;

  if (
    typeof cls === "string" &&
    (cls.includes("avourite") || cls.includes("avorite"))
  )
    return true;

  if (el.closest(".beatmapset-panel__menu-container")) {
    const iconEl = el.querySelector(
      'i, span[class*="icon"], span[class*="heart"]',
    );
    if (iconEl) {
      const ic = (iconEl.className || "").toLowerCase();
      if (ic.includes("heart") || ic.includes("fa-")) return true;
    }
    if (
      el.getAttribute("data-action") === "favourite" ||
      el.getAttribute("data-method") === "favourite"
    )
      return true;
    if (
      /[\u{2764}\u{1F493}-\u{1F49C}\u{1F5A4}\u{1F90D}\u{1F90E}\u{2661}\u{2665}]/u.test(
        el.textContent || "",
      )
    )
      return true;
  }
  return false;
}

