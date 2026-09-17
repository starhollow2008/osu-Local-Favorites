"use strict";
/**
 * Wiring checker for the osu! Local Favorites module tree.
 *
 * Three independent checks, run in order, each one stricter than the last.
 * Any failure in check 1 or 2 is fatal (build stops). Check 3 is a
 * best-effort static heuristic; its findings are reported but do not by
 * themselves fail the build unless --strict is passed, because it can
 * have rare false positives around unusual JS (see findFreeReferences below).
 *
 *   1. import target resolution  - every `import {...} from '<path>'`
 *      points at a file that exists AND actually exports every name
 *      requested.
 *   2. real ES module load       - every module is loaded through Node's
 *      native ESM loader (with a minimal DOM/GM_* stub environment), which
 *      independently re-validates #1 via the engine's own linker and also
 *      catches plain syntax errors per file.
 *   3. free-reference scan       - for every module, every whole-word
 *      occurrence of another module's exported symbol name that ISN'T
 *      imported (and isn't shadowed by a same-named local declaration) is
 *      flagged as a likely missing import.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { listJsFiles, parseExports, parseImports, findWholeWordLines, stripNonCode } = require("./lib/wiring");

function relPath(root, p) {
  return path.relative(root, p).split(path.sep).join("/");
}

function checkImportsResolve(root) {
  const files = listJsFiles(root);
  const errors = [];
  const exportsByFile = new Map();
  for (const f of files) exportsByFile.set(relPath(root, f), parseExports(fs.readFileSync(f, "utf8")));

  for (const f of files) {
    const relF = relPath(root, f);
    const src = fs.readFileSync(f, "utf8");
    const imports = parseImports(src);
    for (const imp of imports) {
      const targetAbs = path.normalize(path.join(path.dirname(f), imp.specifier));
      const relTarget = relPath(root, targetAbs);
      if (!fs.existsSync(targetAbs)) {
        errors.push(`${relF}:${imp.line}  import from "${imp.specifier}" - file does not exist (resolved to ${relTarget})`);
        continue;
      }
      const exported = exportsByFile.get(relTarget) || new Set();
      for (const { imported } of imp.names) {
        if (!exported.has(imported)) {
          errors.push(`${relF}:${imp.line}  imports \`${imported}\` from "${imp.specifier}", but ${relTarget} does not export it`);
        }
      }
    }
  }
  return errors;
}

async function checkRealEsmLoad(root) {
  const files = listJsFiles(root);
  const errors = [];
  // Minimal browser/Tampermonkey surface so top-level side-effect code
  // (window.addEventListener, the GM storage probe IIFE, etc.) doesn't
  // throw purely for lack of a DOM. This is NOT a behavioral emulation -
  // it only has to be complete enough for module *loading* to succeed.
  const stubScript = `
    const el = () => ({
      style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {},
      remove() {}, setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
      querySelector: () => null, querySelectorAll: () => [], insertBefore() {},
      focus() {}, click() {}, textContent: "", innerHTML: "", value: "",
    });
    globalThis.window = globalThis.window || globalThis;
    globalThis.document = globalThis.document || {
      // "loading" (not "complete") on purpose: core/init.js ends with a
      // top-level readyState check that calls init() immediately when the
      // document is already parsed. Loading a module must not execute the
      // whole extension - we only want to know that it *links*, so we park
      // init() on a DOMContentLoaded listener that never fires.
      readyState: "loading",
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
      createElement: el, createElementNS: el,
      head: el(), documentElement: el(), body: el(),
      cookie: "",
    };
    globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
    globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});
    globalThis.window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
    globalThis.navigator = globalThis.navigator || { userAgent: "node-wiring-check" };
    globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
    globalThis.indexedDB = globalThis.indexedDB || { open: () => ({}) };
    globalThis.Audio = globalThis.Audio || function Audio() { return el(); };
    // Left undefined on purpose: exercises gm-shim.js's localStorage
    // fallback path, which is the branch most likely to break on refactor.
    globalThis.GM_getValue = undefined;
    globalThis.GM_setValue = undefined;
    globalThis.GM_registerMenuCommand = undefined;
    globalThis.GM_xmlhttpRequest = undefined;
    globalThis.GM_addValueChangeListener = undefined;
  `;
  const installStubs = new Function(stubScript);
  installStubs();

  // Silence the extension's own expected startup warnings so checker output
  // stays readable; real load failures still surface as thrown errors.
  const realWarn = console.warn;
  console.warn = () => {};

  for (const f of files) {
    const relF = relPath(root, f);
    try {
      // No cache-buster: the whole graph should load exactly once, so
      // top-level side effects (listener registration, the GM probe) run
      // once rather than once per file.
      await import(pathToFileURL(f).href);
    } catch (e) {
      errors.push(`${relF}  failed to load as an ES module - ${e.message}`);
    }
  }
  console.warn = realWarn;
  return errors;
}

function checkFreeReferences(root) {
  const files = listJsFiles(root);
  const warnings = [];
  const exportsByFile = new Map();
  for (const f of files) exportsByFile.set(relPath(root, f), parseExports(fs.readFileSync(f, "utf8")));

  // symbol -> [definingFile, ...] (usually one, but track collisions)
  const symbolOwners = new Map();
  for (const [file, names] of exportsByFile) {
    for (const n of names) {
      if (!symbolOwners.has(n)) symbolOwners.set(n, []);
      symbolOwners.get(n).push(file);
    }
  }

  const localDeclRe = /\b(?:function|const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

  for (const f of files) {
    const relF = relPath(root, f);
    const src = fs.readFileSync(f, "utf8");
    const stripped = stripNonCode(src);
    const imports = parseImports(src);
    const importedNames = new Set(imports.flatMap((i) => i.names.map((n) => n.local)));
    const localNames = new Set();
    let m;
    while ((m = localDeclRe.exec(stripped))) localNames.add(m[1]);

    for (const [sym, owners] of symbolOwners) {
      if (owners.includes(relF)) continue; // defined here
      if (importedNames.has(sym) || localNames.has(sym)) continue; // already in scope
      const hits = findWholeWordLines(stripped, sym);
      if (hits.length) {
        warnings.push(`${relF}:${hits[0]}  uses \`${sym}\` (exported by ${owners.join(", ")}) without importing it`);
      }
    }
  }
  return warnings;
}

module.exports = { checkImportsResolve, checkRealEsmLoad, checkFreeReferences };
