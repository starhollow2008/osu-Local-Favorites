import { scheduleAutoBackup } from "../api/osu-api.js";
import { getBeatmapDataFromCard } from "../data/beatmap-extraction.js";
import { addManyToEnrichQueue, enrichBeatmapsSequential } from "../data/enrichment.js";
import { getFavorites, setFavorites } from "../data/storage.js";
import { updateFloatingHeart } from "./floating-heart.js";

// ═══ Copy-all button ("Favourite Beatmaps" + "Most Played Beatmaps") ═══
// Both live on a profile's Beatmaps tab and share the same "click show
// more until it's gone" pagination pattern, but render completely
// differently under the hood:
//   • Favourite (data-page-id="beatmaps") - one .beatmapset-panel card
//     per beatmapset, "show more" carries both the "profile-page" and
//     "profile-page-beatmapsets" modifier classes.
//   • Most Played (data-page-id="historical") - one .beatmap-playcount
//     row per DIFFICULTY the user has played, so the same beatmapset can
//     show up dozens of times; its "show more" only carries the plain
//     "profile-page" modifier. getBeatmapDataFromCard() already knows how
//     to read both row types, and the dedup below (favs[id] already set,
//     whether from a prior favourite or an earlier row in *this* run)
//     means a 20-diff mapset only ever gets added once.
export function addFavoriteAllButtons() {
  // The .js-sortable--page sections these buttons attach to only exist on
  // profile pages. Everything below is four querySelector calls per call -
  // and this runs on every debounced mutation pass and the 1.5s interval -
  // so bail before any DOM work on pages that can't possibly match.
  if (!/\/users\//.test(location.pathname)) return;
  addFavoriteAllButton({
    pageId: "beatmaps",
    headingMatch: (t) => t.includes("Favourite") || t.includes("Favorite"),
    gridSelector: ".page-extra__beatmapsets.js-audio--group",
    rowSelector: ".beatmapset-panel, .beatmapsets__item",
  });
  addFavoriteAllButton({
    pageId: "historical",
    headingMatch: (t) => t.includes("Most Played"),
    gridSelector: null, // rows sit directly in the page container, no dedicated grid wrapper
    rowSelector: ".beatmap-playcount",
  });
}

function addFavoriteAllButton({ pageId, headingMatch, gridSelector, rowSelector }) {
  const container = document.querySelector(`.js-sortable--page[data-page-id="${pageId}"]`);
  if (!container) return;
  const heading = Array.from(
    container.querySelectorAll("h3.title--page-extra-small"),
  ).find((h) => headingMatch(h.textContent || ""));
  if (!heading) return;
  // Guard: don't add the button twice
  if (heading.querySelector(".osu-fav-all-btn")) return;

  const scope = (gridSelector && container.querySelector(gridSelector)) || container;

  const btn = document.createElement("button");
  btn.className = "osu-fav-all-btn";
  btn.textContent = "Favorite all";
  Object.assign(btn.style, {
    marginLeft: "10px",
    padding: "2px 10px",
    fontSize: "11px",
    background: "var(--osu-fav-accent)",
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontWeight: "600",
    transform: "scale(1)",
    transition: "transform 0.1s",
  });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.textContent = "Loading all...";
    btn.disabled = true;

    // Click "show more" once and wait for new rows to appear
    function clickShowMoreOnce() {
      return new Promise((resolve) => {
        const showMore = scope.querySelector(".show-more-link--profile-page");
        if (
          !showMore ||
          showMore.offsetParent === null ||
          showMore.disabled
        ) {
          resolve();
          return;
        }
        const before = scope.querySelectorAll(rowSelector).length;
        showMore.click();

        let attempts = 0;
        function check() {
          attempts++;
          const after = scope.querySelectorAll(rowSelector).length;
          const sm = scope.querySelector(".show-more-link--profile-page");
          if (
            after > before ||
            !sm ||
            sm.offsetParent === null ||
            attempts > 30
          ) {
            resolve();
          } else {
            setTimeout(check, 400);
          }
        }
        setTimeout(check, 500);
      });
    }

    // Recursively click "show more" until everything is loaded
    function loadAllRows() {
      return clickShowMoreOnce().then(() => {
        const sm = scope.querySelector(".show-more-link--profile-page");
        if (sm && sm.offsetParent !== null && !sm.disabled) {
          return loadAllRows();
        }
      });
    }

    loadAllRows()
      .then(() => {
        const favs = getFavorites();
        const rows = scope.querySelectorAll(rowSelector);
        // Use a decreasing base timestamp so top-to-bottom DOM order is preserved
        // (panel sorts by favourited_at descending)
        const baseTime = Date.now();
        let count = 0;
        let alreadyHad = 0;
        const newIds = [];
        rows.forEach((row, i) => {
          const data = getBeatmapDataFromCard(row);
          if (!data) return;
          if (favs[data.id]) {
            // Already favourited before, OR another diff of a set we
            // already added earlier in *this* run - either way, skip it.
            alreadyHad++;
          } else {
            // Subtract i seconds so first row (top) gets newest timestamp
            data.favourited_at = new Date(baseTime - i * 1000).toISOString();
            favs[data.id] = data;
            newIds.push(data.id);
            count++;
          }
        });

        setFavorites(favs);
        updateFloatingHeart();
        scheduleAutoBackup();
        // setFavorites() notifies the shared panel refresh subscriber.
        // Show matching/skipped count when some were already favorited
        const skippedLabel = alreadyHad > 0
          ? " *[matching " + alreadyHad + "| " + alreadyHad + " not added]"
          : "";
        btn.textContent = "Added " + count + skippedLabel + ", enriching...";
        // Persist the queue first - for a big batch, this run alone can
        // take minutes at the required throttle, and closing the tab
        // partway through used to lose genre/language/tags permanently
        // for whatever hadn't been reached yet. Now the background
        // drainer just resumes where this left off on a later page load.
        addManyToEnrichQueue(newIds);
        // Enrich each new beatmapset sequentially - respects ENRICH_RATE_LIMIT_MS
        // (1 request/sec), the same throttle every other bulk/re-enrich path uses.
        enrichBeatmapsSequential(newIds);
        setTimeout(() => {
          btn.textContent = "Favorite all";
          btn.disabled = false;
        }, 3500);
      })
      .catch(() => {
        btn.textContent = "Error";
        setTimeout(() => {
          btn.textContent = "Favorite all";
          btn.disabled = false;
        }, 2000);
      });
  });

  // Append button inside the heading element
  heading.appendChild(btn);
}

