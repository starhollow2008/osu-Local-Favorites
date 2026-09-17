// ═══ Page-world XHR/fetch interceptor ═══
// Also blocks login redirects triggered by unauthenticated favourite actions.
export function injectInterceptor() {
  const script = document.createElement("script");
  script.textContent = `(${function () {
    // ── XHR intercept: block /favourites requests ──
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === "string" && url.includes("/favourites")) {
        this.__blocked = true;
      }
      return origOpen.apply(this, arguments);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      if (this.__blocked) {
        try {
          Object.defineProperty(this, "readyState", {
            value: 4,
            writable: true,
            configurable: true,
          });
          Object.defineProperty(this, "status", {
            value: 200,
            writable: true,
            configurable: true,
          });
          Object.defineProperty(this, "responseText", {
            value: "{}",
            writable: true,
            configurable: true,
          });
        } catch (e) { }
        setTimeout(() => {
          if (this.onload) this.onload();
          if (this.onreadystatechange) this.onreadystatechange();
        }, 0);
        return;
      }
      return origSend.apply(this, arguments);
    };

    // ── Fetch intercept: block /favourites and auth-error responses ──
    const origFetch = window.fetch;
    window.fetch = function (url, options) {
      const urlStr = typeof url === "string" ? url : (url && url.url) || "";
      if (urlStr.includes("/favourites")) {
        return Promise.resolve(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return origFetch.apply(this, arguments);
    };

    // ── Navigation intercept: block login redirects from favourite clicks ──
    // osu! SPA navigates via history.pushState when not logged in for some actions.
    // We trap pushState/replaceState and location.href assignments that redirect to /login.
    // Only redirects that originate within 500ms of a favourite-click are blocked.
    let _favClickPending = false;
    document.addEventListener("click", function (e) {
      const btn = e.target && e.target.closest && e.target.closest("button, a");
      if (!btn) return;
      // Check if this looks like a favourite button
      const title = (btn.getAttribute("title") || btn.getAttribute("aria-label") || "").toLowerCase();
      const cls = (btn.className || "").toLowerCase();
      const text = (btn.textContent || "").toLowerCase();
      const href = (btn.getAttribute("href") || "");
      const isFavLike =
        title.includes("avourite") || title.includes("avorite") ||
        cls.includes("avourite") || cls.includes("avorite") ||
        text.includes("avourite") || text.includes("avorite") ||
        btn.querySelector(".fa-heart, .fas.fa-heart, .far.fa-heart") ||
        href.includes("/favourites");
      if (isFavLike) {
        _favClickPending = true;
        setTimeout(() => { _favClickPending = false; }, 800);
      }
    }, true);

    const _origPushState = history.pushState.bind(history);
    history.pushState = function (state, title, url) {
      if (_favClickPending && typeof url === "string" && url.includes("/login")) {
        return; // block login redirect
      }
      return _origPushState(state, title, url);
    };

    const _origReplaceState = history.replaceState.bind(history);
    history.replaceState = function (state, title, url) {
      if (_favClickPending && typeof url === "string" && url.includes("/login")) {
        return; // block login redirect
      }
      return _origReplaceState(state, title, url);
    };

    // Intercept anchor navigation to /login triggered by favourite actions
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest && e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.includes("/login") && _favClickPending) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }})();`;
  (document.head || document.documentElement).appendChild(script);
}

