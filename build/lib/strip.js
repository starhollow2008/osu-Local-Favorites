"use strict";
/**
 * Strips comments and the contents of string/template literals from a JS
 * source string, replacing removed characters with spaces (never newlines)
 * so that line numbers of whatever remains stay accurate. This is NOT a
 * full JS parser - it's a pragmatic state machine good enough to keep
 * identifier-search checks (see wiring.js) from tripping over words that
 * only appear inside comments or string literals (e.g. a function name
 * quoted in an error message).
 *
 * Template-literal `${...}` interpolations are left as real code (their
 * contents can legitimately reference other modules' exports), everything
 * else inside a template literal is blanked like a normal string.
 */
function stripNonCode(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  const blank = (ch) => (ch === "\n" ? "\n" : " ");

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // Line comment
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") { out += blank(src[i]); i++; }
      continue;
    }
    // Block comment
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += blank(src[i]); i++; }
      if (i < n) { out += "  "; i += 2; }
      continue;
    }
    // String literals (single/double quote)
    if (c === "'" || c === '"') {
      const quote = c;
      out += " ";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { out += blank(src[i]); i++; if (i < n) { out += blank(src[i]); i++; } continue; }
        out += blank(src[i]);
        i++;
      }
      if (i < n) { out += " "; i++; }
      continue;
    }
    // Template literal, with ${...} left intact as code (recursively handled
    // by the main loop since we just stop blanking while inside it).
    if (c === "`") {
      out += " ";
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") { out += blank(src[i]); i++; if (i < n) { out += blank(src[i]); i++; } continue; }
        if (src[i] === "$" && src[i + 1] === "{") {
          out += "  ";
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            // Recurse minimally: handle nested strings inside the
            // interpolation so a `}` inside a string doesn't end it early.
            if (src[i] === "'" || src[i] === '"') {
              const q = src[i];
              out += src[i]; i++;
              while (i < n && src[i] !== q) {
                if (src[i] === "\\") { out += src[i]; i++; if (i < n) { out += src[i]; i++; } continue; }
                out += src[i]; i++;
              }
              if (i < n) { out += src[i]; i++; }
              continue;
            }
            if (src[i] === "{") depth++;
            if (src[i] === "}") { depth--; if (depth === 0) break; }
            out += src[i];
            i++;
          }
          if (i < n) { out += " "; i++; } // consume closing }
          continue;
        }
        out += blank(src[i]);
        i++;
      }
      if (i < n) { out += " "; i++; }
      continue;
    }
    // Regex literal detection is intentionally skipped (best-effort tool -
    // see module docstring); the previous significant non-space char tells
    // us if `/` is likely a division operator instead, which is the only
    // case that matters for our purposes (avoiding mis-parsing `//` inside
    // a regex as a line comment start).
    if (c === "/") {
      // crude lookback: division follows an identifier/number/)/]/ char
      let j = out.length - 1;
      while (j >= 0 && /\s/.test(out[j])) j--;
      const prevCh = j >= 0 ? out[j] : "";
      const isDivision = /[A-Za-z0-9_$)\]]/.test(prevCh);
      if (!isDivision) {
        // best-effort regex skip: consume until unescaped closing slash on
        // the same logical literal, bailing out safely at a newline.
        let k = i + 1;
        let inClass = false;
        while (k < n && src[k] !== "\n") {
          if (src[k] === "\\") { k += 2; continue; }
          if (src[k] === "[") inClass = true;
          else if (src[k] === "]") inClass = false;
          else if (src[k] === "/" && !inClass) { k++; break; }
          k++;
        }
        // flags after the regex
        while (k < n && /[a-z]/i.test(src[k])) k++;
        for (let p = i; p < k; p++) out += blank(src[p]);
        i = k;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Blanks ONLY comments, leaving string and template literals intact.
 * Used where the code being searched for is a string - notably import
 * specifiers ("./foo.js"), which stripNonCode would erase along with every
 * other string literal.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  const blank = (ch) => (ch === "\n" ? "\n" : " ");

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") { out += blank(src[i]); i++; }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += blank(src[i]); i++; }
      if (i < n) { out += "  "; i += 2; }
      continue;
    }
    // Copy string/template literals through verbatim so their contents
    // survive, but consume them wholesale so a "//" inside one is never
    // mistaken for a comment.
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { out += src[i]; i++; if (i < n) { out += src[i]; i++; } continue; }
        out += src[i];
        i++;
      }
      if (i < n) { out += src[i]; i++; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

module.exports = { stripNonCode, stripComments };
