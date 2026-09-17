"use strict";
const fs = require("fs");
const path = require("path");
const { stripNonCode, stripComments } = require("./strip");

/** Recursively list .js files under a directory. */
function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/**
 * Parses `export function/const/let/class NAME` and
 * `export { a, b as c }` declarations out of a module's source.
 * Returns a Set of exported names.
 */
function parseExports(src) {
  const stripped = stripNonCode(src);
  const names = new Set();
  const declRe = /export\s+(?:async\s+function|function|const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m;
  while ((m = declRe.exec(stripped))) names.add(m[1]);
  const listRe = /export\s*\{([^}]*)\}/g;
  while ((m = listRe.exec(stripped))) {
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (!p) continue;
      const asMatch = p.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      names.add(asMatch ? asMatch[2] : p);
    }
  }
  return names;
}

/**
 * Parses `import { a, b as c } from '...'` statements.
 * Returns [{ specifier, names: [{imported, local}], line }]
 */
function parseImports(src) {
  const stripped = stripComments(src);
  const lines = stripped.split("\n");
  const out = [];
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(stripped))) {
    const lineNo = stripped.slice(0, m.index).split("\n").length;
    const names = m[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const asMatch = p.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
        return asMatch ? { imported: asMatch[1], local: asMatch[2] } : { imported: p, local: p };
      });
    out.push({ specifier: m[2], names, line: lineNo });
  }
  return out;
}

/** Whole-word search, returns matching line numbers (1-based). */
function findWholeWordLines(strippedSrc, word) {
  const re = new RegExp(`\\b${word.replace(/[$]/g, "\\$")}\\b`, "g");
  const lines = strippedSrc.split("\n");
  const hits = [];
  lines.forEach((line, idx) => {
    if (re.test(line)) hits.push(idx + 1);
    re.lastIndex = 0;
  });
  return hits;
}

module.exports = { listJsFiles, parseExports, parseImports, findWholeWordLines, stripNonCode, stripComments };
