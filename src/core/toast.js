// ═══ Toast helper ═══
export function showOsuFavToast(msg, rightOffset = "20px") {
  const t = document.createElement("div");
  Object.assign(t.style, {
    position: "fixed",
    bottom: "20px",
    right: rightOffset,
    zIndex: "100001",
    background: "#222",
    border: "1px solid #444",
    borderRadius: "4px",
    padding: "7px 14px",
    fontSize: "12px",
    color: "#ddd",
    boxShadow: "0 2px 8px rgba(0,0,0,.5)",
    pointerEvents: "none",
    transition: "opacity 0.2s ease",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 200);
  }, 2500);
}

