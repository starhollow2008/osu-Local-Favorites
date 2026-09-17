// ═══ Beatmap data extraction ═══
export function getBeatmapDataFromJSON() {
  try {
    const el = document.getElementById("json-beatmapset");
    if (!el) return null;
    const raw = JSON.parse(el.textContent);
    const bm = raw.beatmapset || raw;
    return {
      id: String(bm.id),
      artist: bm.artist || "",
      artist_unicode: bm.artist_unicode || bm.artist || "",
      title: bm.title || "",
      title_unicode: bm.title_unicode || bm.title || "",
      creator: bm.creator || "",
      user_id: String(bm.user_id || ""),
      covers: bm.covers || {},
      status: bm.status || "",
      favourite_count: bm.favourite_count || 0,
      play_count: bm.play_count || 0,
      bpm: bm.bpm || 0,
      source: bm.source || "",
      tags: bm.tags || "",
      genre: (bm.genre && bm.genre.name) || "",
      language: (bm.language && bm.language.name) || "",
      url: "https://osu.ppy.sh/beatmapsets/" + bm.id,
      favourited_at: new Date().toISOString(),
      is_artist_featured:
        typeof bm.is_artist_featured === "boolean"
          ? bm.is_artist_featured
          : (bm.track_id != null ? !!bm.track_id : false),
      nsfw: bm.nsfw || false,
      preview: "https://b.ppy.sh/preview/" + bm.id + ".mp3",
    };
  } catch (e) {
    return null;
  }
}

export function getBeatmapDataFromCard(card) {
  if (!card) return null;
  // Skip cards inside pinned scores section
  if (
    card.closest(
      '[data-page-id="pinnedScores"], .js-sortable--page .title--page-extra-small',
    )
  )
    return null;
  try {
    const link = card.querySelector('a[href*="/beatmapsets/"]');
    if (!link) return null;
    const m = link.href.match(/\/beatmapsets\/(\d+)/);
    if (!m) return null;
    const id = m[1];

    // ── Title ────────────────────────────────────────────────────
    // .beatmap-playcount__title (Most Played rows) is handled alongside
    // the regular panel selectors - its text also carries a trailing
    // "[Difficulty]" and an inline "by Artist" span, both stripped below,
    // since we're favouriting the *set*, not one specific diff.
    let title = "";
    const titleEl = card.querySelector(
      '.beatmapset-panel__main-link, a[class*="main-link"], ' +
      '.beatmapset-panel__title, [class*="beatmapset-panel__title"], ' +
      ".beatmap-playcount__title",
    );
    if (titleEl) {
      const titleClone = titleEl.cloneNode(true);
      titleClone
        .querySelectorAll('.beatmapset-badge, [class*="badge"], i, svg, [class*="title-artist"]')
        .forEach((n) => n.remove());
      title = titleClone.textContent.trim().replace(/\s*\[[^[\]]+\]\s*$/, "").trim();
    }
    if (!title) {
      const ml = card.querySelector('a[href*="/beatmapsets/"]');
      if (ml) title = ml.textContent.trim();
    }

    // ── Artist ───────────────────────────────────────────────────
    // Use dedicated semantic elements first; fall back to filtered info-row text.
    // Never read raw info-row text without stripping stat nodes - doing so causes
    // play counts / fav counts / dates to bleed into the artist field.
    let artist = "";
    for (const sel of [
      ".beatmapset-panel__artist",
      '[class*="beatmapset-panel__artist"]',
      ".beatmapset-panel__info-row--artist",
      '[class*="info-row--artist"]',
      ".beatmap-playcount__artist", // Most Played rows - text is "by Artist", stripped below
    ]) {
      const el = card.querySelector(sel);
      if (el) {
        artist = el.textContent.replace(/^\s*by\s+/i, "").trim();
        break;
      }
    }
    if (!artist) {
      for (const row of card.querySelectorAll(
        '.beatmapset-panel__info-row, [class*="info-row"]',
      )) {
        const clone = row.cloneNode(true);
        clone
          .querySelectorAll(
            '.beatmapset-badge, [class*="badge"], i, svg, ' +
            '[class*="stat"], [class*="count"], [class*="play"], [class*="fav"]',
          )
          .forEach((n) => n.remove());
        const txt = clone.textContent.trim();
        if (txt.startsWith("by ")) {
          artist = txt
            .replace(/^by\s+/, "")
            .replace(/Featured\s*Artist$/i, "")
            .trim();
          break;
        }
      }
    }

    // ── Creator (mapper) ─────────────────────────────────────────
    let creator = "";
    for (const sel of [
      ".beatmapset-panel__mapper",
      '[class*="beatmapset-panel__mapper"]',
      ".beatmapset-panel__info-row--mapper",
      '[class*="info-row--mapper"]',
      ".beatmap-playcount__mapper-link", // Most Played rows - username only, no "mapped by " text to strip
    ]) {
      const el = card.querySelector(sel);
      if (el) {
        creator = el.textContent.trim();
        break;
      }
    }
    if (!creator) {
      for (const row of card.querySelectorAll(
        '.beatmapset-panel__info-row, [class*="info-row"]',
      )) {
        const clone = row.cloneNode(true);
        clone
          .querySelectorAll(
            '.beatmapset-badge, [class*="badge"], i, svg, ' +
            '[class*="stat"], [class*="count"], [class*="play"], [class*="fav"]',
          )
          .forEach((n) => n.remove());
        const txt = clone.textContent.trim();
        if (txt.startsWith("mapped by ")) {
          creator = txt.replace(/^mapped by\s+/, "").trim();
          break;
        }
      }
    }
    if (!creator) {
      const mapperLink = card.querySelector(
        'a[href*="/users/"], .beatmapset-panel__mapper a, [class*="mapper"] a',
      );
      if (mapperLink) creator = mapperLink.textContent.trim();
    }

    // source is not present in listing card DOM - leave blank rather than
    // accidentally capturing stats / date text from info-row nodes
    const source = "";

    // Extract cover URL - try multiple methods
    let coverUrl = "";

    // Method 1: computed style --bg custom property on cover element
    const coverEl = card.querySelector('[class*="beatmapset-cover"]');
    if (coverEl) {
      const cs = getComputedStyle(coverEl);
      let bg = cs.getPropertyValue("--bg") || "";
      if (!bg) bg = cs.backgroundImage || "";
      const m2 = bg.match(/url\("([^"]+)"\)/) || bg.match(/url\(([^)]+)\)/);
      if (m2) coverUrl = m2[1];
    }

    // Method 2: img inside cover
    if (!coverUrl) {
      const coverImg = card.querySelector(
        'img[src*="cover"], [class*="cover"] img, .beatmapset-cover img',
      );
      if (coverImg)
        coverUrl = coverImg.src || coverImg.getAttribute("data-src") || "";
    }

    // Method 3: any img in card that looks like a cover
    if (!coverUrl) {
      const imgs = card.querySelectorAll("img");
      for (const img of imgs) {
        const src = img.src || "";
        if (src.includes("cover") || src.includes("thumb")) {
          coverUrl = src;
          break;
        }
      }
      if (!coverUrl && imgs.length > 0) {
        // First image that's not an icon
        for (const img of imgs) {
          if (img.width > 40) {
            coverUrl = img.src;
            break;
          }
        }
      }
    }

    // Normalize URL
    if (coverUrl && !coverUrl.startsWith("http")) {
      if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
      else if (coverUrl.startsWith("/"))
        coverUrl = "https://osu.ppy.sh" + coverUrl;
    }

    return {
      id,
      artist,
      artist_unicode: artist,
      title,
      title_unicode: title,
      creator,
      user_id: "",
      covers: { list: coverUrl, card: coverUrl, cover: coverUrl },
      status: "",
      favourite_count: 0,
      play_count: 0,
      bpm: 0,
      source,
      tags: "",
      genre: "",
      language: "",
      url: "https://osu.ppy.sh/beatmapsets/" + id,
      favourited_at: new Date().toISOString(),
      is_artist_featured: !!card.querySelector(".beatmapset-badge--featured_artist"),
      nsfw: !!card.querySelector(".beatmapset-badge--nsfw") || false,
      preview: "https://b.ppy.sh/preview/" + id + ".mp3",
    };
  } catch (e) {
    return null;
  }
}

export function getBeatmapId() {
  const m = location.pathname.match(/\/beatmapsets\/(\d+)/);
  return m ? m[1] : null;
}

export function resolveBeatmapContext(button) {
  const urlId = getBeatmapId();
  if (urlId) return { beatmapId: urlId, card: null, pageType: "detail" };

  // Walk up from the button and find the smallest ancestor that contains
  // links to exactly one distinct beatmapset id. This works no matter how
  // deeply the beatmapset link is nested inside the card's markup (some
  // layouts - e.g. the Featured Artist track grid - wrap it several levels
  // deep rather than as a direct child), and no matter which wrapper class
  // a given card layout uses, since we no longer depend on ".beatmapset-panel"
  // or a direct-child relationship at all. As soon as an ancestor's links
  // span more than one distinct beatmapset, we've walked past the card
  // boundary into a container shared by multiple cards, so we stop there
  // rather than risk grabbing a neighboring card's id.
  let el = button.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const cls = (el.className || "").toString();
    if (cls.includes("beatmapset-panel__menu")) {
      el = el.parentElement;
      continue;
    }
    const ids = new Set();
    el.querySelectorAll('a[href*="/beatmapsets/"]').forEach((a) => {
      const m = a.href.match(/\/beatmapsets\/(\d+)/);
      if (m) ids.add(m[1]);
    });
    if (ids.size === 1) {
      return { beatmapId: [...ids][0], card: el, pageType: "listing" };
    }
    if (ids.size > 1) break;
    el = el.parentElement;
  }

  return { beatmapId: null, card: null, pageType: "unknown" };
}

