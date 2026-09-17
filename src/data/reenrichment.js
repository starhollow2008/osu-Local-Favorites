import { scheduleAutoBackup } from "../api/osu-api.js";
import { showOsuFavToast } from "../core/toast.js";
import { ENRICH_RATE_LIMIT_MS, enrichBeatmapData } from "./enrichment.js";
import { getFavorites } from "./storage.js";

// ═══ Global re-enrichment (Settings → Library Maintenance) ═══
// Re-fetches every favorited map's full data, one request at a time and
// rate-limited via ENRICH_RATE_LIMIT_MS. Exposed through a couple of
// module-level state vars + ID-lookups (rather than closures) so progress
// keeps rendering correctly even if the settings view is torn down and
// rebuilt (e.g. re.render on unrelated state changes) while a run is live.
let _reenrichRunning = false;
let _reenrichCancelFlag = false;
let _reenrichDone = 0;
let _reenrichTotal = 0;

// Read-only accessor for other modules (data/enrichment.js,
// ui/settings.js) that need to know whether a global re-enrichment
// pass is currently in flight, without holding a live, writable binding
// into this module's private state.
export function isReenrichRunning() {
  return _reenrichRunning;
}

// Pushes current progress into the Settings panel's progress bar, if it's
// currently mounted. Safe to call even when the panel/settings view isn't
// open - the elements simply won't be found and this becomes a no-op.
export function updateReenrichmentUI(finished, cancelled) {
  const btn = document.getElementById("osu-fav-reenrich-btn");
  const progressWrap = document.getElementById("osu-fav-reenrich-progress");
  const bar = document.getElementById("osu-fav-reenrich-bar");
  const text = document.getElementById("osu-fav-reenrich-text");
  const pct = _reenrichTotal ? Math.round((_reenrichDone / _reenrichTotal) * 100) : 0;

  if (progressWrap) progressWrap.style.display = _reenrichRunning || finished || cancelled ? "block" : "none";
  if (bar) bar.style.width = pct + "%";
  if (text) {
    if (cancelled) text.textContent = `Cancelled at ${pct}% (${_reenrichDone}/${_reenrichTotal})`;
    else if (finished) text.textContent = `Done - refreshed ${_reenrichDone}/${_reenrichTotal} maps`;
    else text.textContent = `${pct}% (${_reenrichDone}/${_reenrichTotal})`;
  }
  if (btn) {
    btn.disabled = false;
    btn.textContent = _reenrichRunning
      ? "Cancel re-enrichment"
      : `Re-enrich all maps (${Object.keys(getFavorites()).length})`;
  }
}

export function runGlobalReenrichment() {
  if (_reenrichRunning) return;
  const ids = Object.keys(getFavorites());
  if (ids.length === 0) {
    showOsuFavToast("No favorites to re-enrich");
    return;
  }
  _reenrichRunning = true;
  _reenrichCancelFlag = false;
  _reenrichDone = 0;
  _reenrichTotal = ids.length;
  updateReenrichmentUI(false, false);

  function next(i) {
    if (_reenrichCancelFlag) {
      _reenrichRunning = false;
      updateReenrichmentUI(false, true);
      scheduleAutoBackup();
      return;
    }
    if (i >= ids.length) {
      _reenrichRunning = false;
      updateReenrichmentUI(true, false);
      showOsuFavToast("Re-enrichment complete!");
      scheduleAutoBackup();
      return;
    }
    enrichBeatmapData(ids[i]).then(() => {
      _reenrichDone++;
      updateReenrichmentUI(false, false);
      setTimeout(() => next(i + 1), ENRICH_RATE_LIMIT_MS);
    });
  }
  next(0);
}

export function cancelGlobalReenrichment() {
  if (_reenrichRunning) _reenrichCancelFlag = true;
}

