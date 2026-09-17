// ═══ Error reporting ═══
// One place for every failure in this script to end up: a structured
// console.error() (name/message/HTTP status/stack, so pasting that one
// line is enough to file a useful bug report) plus a small on-page toast
// when it's worth telling the user something failed. Call sites that
// already showed a plain toast on failure route through reportError()
// below instead of building their own message, so they pick up the
// console detail for free without changing what appears on screen.
const ERROR_TOAST_MIN_GAP_MS = 4000; // don't flood the screen if something fails repeatedly
let _lastErrorToastAt = 0;

function showOsuFavErrorToast(msg) {
  if (!document.body) return; // page not ready - the console line already has the detail
  const t = document.createElement("div");
  Object.assign(t.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "100002",
    maxWidth: "320px",
    background: "#2a1414",
    border: "1px solid #6b2222",
    borderRadius: "4px",
    padding: "8px 14px",
    fontSize: "12px",
    lineHeight: "1.4",
    color: "#f5b8b8",
    boxShadow: "0 2px 8px rgba(0,0,0,.5)",
    pointerEvents: "none",
    transition: "opacity 0.2s ease",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  t.textContent = "⚠ Error: " + msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 200);
  }, 4000);
}

// context: short human label for where this happened, shown in both the
// toast and the console line (e.g. "Gist backup", "Toggle favorite").
// err: whatever was thrown/rejected - normally an Error, handled
// gracefully either way. extra: optional {status, statusText, ...} for
// callers that know more than what's already on the Error object (most
// network helpers below attach .status/.statusText themselves, so this is
// rarely needed).
export function reportError(context, err, extra) {
  extra = extra || {};
  const name = (err && err.name) || "Error";
  const message = (err && err.message) || String(err);
  const status = extra.status != null ? extra.status : (err && err.status) || null;
  const statusText = extra.statusText != null ? extra.statusText : (err && err.statusText) || null;
  const stack = (err && err.stack) || null;
  const statusPart = status ? ` (status ${status}${statusText ? " " + statusText : ""})` : "";

  console.error(
    `[osu! Local Favorites] ${context} - ${name}: ${message}${statusPart}`,
    Object.assign(
      { context, name, message, status, statusText, stack, time: new Date().toISOString() },
      extra,
    ),
  );

  const now = Date.now();
  if (now - _lastErrorToastAt < ERROR_TOAST_MIN_GAP_MS) return; // already told the user something just failed
  _lastErrorToastAt = now;
  showOsuFavErrorToast(`${context}: ${message}${statusPart} - see console for details`);
}

// Last-resort safety net for bugs that slip past every try/catch above.
// window-level "error"/"unhandledrejection" fire for *every* script on the
// page, not just this one, so each listener below only reports when the
// stack trace contains one of this script's own function names - a
// best-effort filter (Tampermonkey doesn't expose a reliable "this came
// from a userscript" flag), but good enough to avoid popping a Local
// Favorites error toast for osu!'s own unrelated page bugs.
const OWN_STACK_MARKERS = [
  "toggleFavorite", "ghApiRequest", "osuApiGetToken", "osuApiTokenRequest",
  "enrichBeatmapData", "showFavoritesPanel", "refreshButtons", "performGistBackup",
];
function looksLikeOwnError(err) {
  const stack = (err && err.stack) || "";
  return OWN_STACK_MARKERS.some((name) => stack.includes(name));
}
window.addEventListener("error", (e) => {
  if (!looksLikeOwnError(e.error)) return;
  reportError("Uncaught error", e.error || new Error(e.message));
});
window.addEventListener("unhandledrejection", (e) => {
  if (!looksLikeOwnError(e.reason)) return;
  reportError("Unhandled rejection", e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
});

