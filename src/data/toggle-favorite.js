import { scheduleAutoBackup } from "../api/osu-api.js";
import { getBeatmapDataFromCard, getBeatmapDataFromJSON } from "./beatmap-extraction.js";
import { addToEnrichQueue, enrichBeatmapData, ensureEnrichDrainerRunning, removeFromEnrichQueue } from "./enrichment.js";
import { getFavorites, setFavorites } from "./storage.js";
import { updateFloatingHeart } from "../ui/floating-heart.js";

// ═══ Toggle favorite ═══
export function toggleFavorite(beatmapId, card) {
  if (!beatmapId) return null;
  const favs = getFavorites();
  const wasFav = !!favs[beatmapId];
  let needsEnrich = false;

  if (wasFav) {
    delete favs[beatmapId];
    removeFromEnrichQueue(beatmapId); // no longer favorited - stop trying to enrich it
  } else {
    const jsonData = getBeatmapDataFromJSON();
    if (jsonData) {
      favs[beatmapId] = jsonData;
    } else {
      needsEnrich = true;
      const data = (card ? getBeatmapDataFromCard(card) : null) || {
        id: beatmapId,
        url: "https://osu.ppy.sh/beatmapsets/" + beatmapId,
        favourited_at: new Date().toISOString(),
      };
      favs[beatmapId] = data;
    }
  }

  // setFavorites() announces the membership change; the subscriber wired up
  // in core/init.js repaints every heart on the page and re-renders the
  // panel list in place.
  //
  // This used to remove the panel and call showFavoritesPanel() to rebuild
  // it from scratch, which reset the search box, sort order, genre filter,
  // active collection and scroll position, and tore down the Now Playing
  // bar mid-preview - every time any heart was clicked.
  setFavorites(favs);
  updateFloatingHeart();
  scheduleAutoBackup();
  if (needsEnrich) {
    // Persisted first so this survives even if the immediate attempt
    // below doesn't finish before the tab closes/navigates away - the
    // background drainer picks it back up later regardless.
    addToEnrichQueue(beatmapId);
    enrichBeatmapData(beatmapId);
    ensureEnrichDrainerRunning();
  }
  return !wasFav;
}

