import { getBeatmapId, resolveBeatmapContext } from "../data/beatmap-extraction.js";
import { MIRRORS, isMirrorEnabled } from "../data/mirrors.js";

// ═══ Enable download buttons for guest/logged-out users ═══
// Based on exact DOM structure observed via Kimi WebBridge in logged-in Helium session:
//
// Logged-in listing/user panel download item:
//   <a class="beatmapset-panel__menu-item" href="…/download"
//      data-orig-title="download with video"><span class="fas fa-file-download"></span></a>
//   (user pages use title= instead of data-orig-title=, but same shape)
//
// Logged-in detail page:
//   <a class="btn-osu-big btn-osu-big--beatmapset-header" href="…/download">…Download with Video…</a>
//   <a class="btn-osu-big btn-osu-big--beatmapset-header" href="…/download?noVideo=1">…without Video…</a>
export function enableGuestDownloads() {
  // ── 1. Beatmap panel cards (listing + user pages) ────────────────────────
  // Replace disabled <span class="beatmapset-panel__menu-item"> download spans
  // with real <a> links that match the logged-in element exactly.
  document.querySelectorAll("span.beatmapset-panel__menu-item").forEach((span) => {
    // Already converted - skip
    if (span.dataset.osuDlFixed) return;

    const hasDownloadIcon = span.querySelector(".fa-file-download, .fa-download");
    const titleAttr = (
      span.getAttribute("data-orig-title") ||
      span.getAttribute("title") ||
      ""
    ).toLowerCase();

    const isDisabledDownload =
      hasDownloadIcon ||
      titleAttr.includes("download") ||
      titleAttr.includes("sign in before downloading");

    if (!isDisabledDownload) return;

    const ctx = resolveBeatmapContext(span);
    if (!ctx.beatmapId) {
      // Context not resolvable yet (card still mid-render) - leave unmarked
      // so the next pass retries instead of skipping this element forever.
      return;
    }

    const a = document.createElement("a");
    a.className = "beatmapset-panel__menu-item";
    a.href = `https://osu.ppy.sh/beatmapsets/${ctx.beatmapId}/download`;
    // Match logged-in: listing pages use data-orig-title, user pages use title
    a.setAttribute("data-orig-title", "download with video");
    a.title = "download with video";

    // Preserve qtip attributes so tooltips work
    if (span.getAttribute("data-hasqtip"))
      a.setAttribute("data-hasqtip", span.getAttribute("data-hasqtip"));
    if (span.getAttribute("aria-describedby"))
      a.setAttribute("aria-describedby", span.getAttribute("aria-describedby"));

    // Inner content: keep the original icon span (fas fa-file-download)
    a.innerHTML = span.innerHTML;
    span.replaceWith(a);
  });

  // ── 2. Beatmapset detail pages (/beatmapsets/ID) ─────────────────────────
  // When logged out, osu! renders a "Sign In to access more features" button
  // instead of the download links. Replace it with the exact logged-in pair.
  const bmid = getBeatmapId();
  if (!bmid) return;

  // Guard: if real download links already exist (script ran before, or user logged in),
  // or if we already injected them, don't duplicate.
  const downloadLinksExist = !!document.querySelector(
    `.beatmapset-header__buttons a[href*="/download"]`
  );
  if (downloadLinksExist) return;

  const signInBtn = Array.from(document.querySelectorAll("button.btn-osu-big")).find((btn) => {
    const text = (btn.textContent || "").toLowerCase();
    return text.includes("sign in") && text.includes("access more features");
  });

  if (!signInBtn) return;

  // Build "Download with Video" - matches logged-in <a class="btn-osu-big btn-osu-big--beatmapset-header">
  const aWithVideo = document.createElement("a");
  aWithVideo.className = "btn-osu-big btn-osu-big--beatmapset-header ";
  aWithVideo.href = `https://osu.ppy.sh/beatmapsets/${bmid}/download`;
  aWithVideo.innerHTML =
    '<span class="btn-osu-big__content">' +
    '<span class="btn-osu-big__left">' +
    '<span class="btn-osu-big__text-top">Download</span>' +
    '<span class="btn-osu-big__text-bottom">with Video</span>' +
    '</span>' +
    '<span class="btn-osu-big__icon">' +
    '<span class="fa fa-fw">' +
    '<span class="fas fa-download"></span>' +
    '</span>' +
    '</span>' +
    '</span>';

  // Build "Download without Video"
  const aNoVideo = document.createElement("a");
  aNoVideo.className = "btn-osu-big btn-osu-big--beatmapset-header ";
  aNoVideo.href = `https://osu.ppy.sh/beatmapsets/${bmid}/download?noVideo=1`;
  aNoVideo.innerHTML =
    '<span class="btn-osu-big__content">' +
    '<span class="btn-osu-big__left">' +
    '<span class="btn-osu-big__text-top">Download</span>' +
    '<span class="btn-osu-big__text-bottom">without Video</span>' +
    '</span>' +
    '<span class="btn-osu-big__icon">' +
    '<span class="fa fa-fw">' +
    '<span class="fas fa-download"></span>' +
    '</span>' +
    '</span>' +
    '</span>';

  signInBtn.replaceWith(aWithVideo, aNoVideo);
}

// Detects osu!plus (limjeck/osuplus) already having injected its own mirror
// buttons on this page - it tags them with this exact class in its
// makeMirror() function. If present, we skip adding our own to avoid a
// cluttered duplicate row of near-identical buttons.
function isOsuPlusMirrorsPresent() {
  return !!document.querySelector(".js-beatmapset-download-link");
}

// Builds a button matching osu!'s own native download-button markup
// exactly (same classes osu!'s big buttons and osu!plus's mirror buttons
// use) - so ours inherit the page's real CSS instead of looking like a
// custom pill glued on top of it.
function makeNativeStyleLink(url, topName, bottomName) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("data-turbolinks", "false");
  a.className = "btn-osu-big btn-osu-big--beatmapset-header osu-fav-mirror-link";
  a.innerHTML =
    '<span class="btn-osu-big__content">' +
    '<span class="btn-osu-big__left">' +
    `<span class="btn-osu-big__text-top">${topName}</span>` +
    (bottomName ? `<span class="btn-osu-big__text-bottom">${bottomName}</span>` : "") +
    "</span>" +
    '<span class="btn-osu-big__icon"><span class="fa-fw"><i class="fas fa-download"></i></span></span>' +
    "</span>";
  return a;
}

// Injects native-styled mirror-download buttons onto the beatmapset detail
// page, right after the official download buttons. These work regardless
// of login state or a beatmapset's download_disabled flag - a solid
// fallback for anything the official button can't do. Cheap to call
// repeatedly; only rebuilds when the current beatmapset id actually
// changes, and stands down entirely if osu!plus already covers this.
export function injectMirrorButtons() {
  const bmid = getBeatmapId();
  if (!bmid) return;

  const existing = document.getElementById("osu-fav-mirror-row");

  if (isOsuPlusMirrorsPresent()) {
    if (existing) existing.remove();
    return;
  }

  const enabledMirrors = MIRRORS.filter(isMirrorEnabled);
  if (enabledMirrors.length === 0) {
    if (existing) existing.remove();
    return;
  }
  if (existing && existing.dataset.beatmapsetId === String(bmid)) return; // already current
  if (existing) existing.remove();

  const moreContainer = document.querySelector(".beatmapset-header__more");
  const buttonsContainer = document.querySelector(".beatmapset-header__buttons");
  if (!moreContainer && !buttonsContainer) return;

  const row = document.createElement("div");
  row.id = "osu-fav-mirror-row";
  row.dataset.beatmapsetId = String(bmid);
  row.style.cssText = "display:contents";

  enabledMirrors.forEach((mirror) => {
    mirror.variants(bmid).forEach((variant) => {
      row.appendChild(makeNativeStyleLink(variant.url, variant.top, variant.bottom));
    });
  });

  // Match osu!plus's own insertion point exactly: before "…more" if it
  // exists, otherwise appended into the main buttons row.
  if (moreContainer) {
    moreContainer.before(row);
  } else {
    buttonsContainer.appendChild(row);
  }
}

