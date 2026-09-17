"use strict";
/**
 * Build entry point.
 *
 *   node build/build.js            check, then bundle if checks pass
 *   node build/build.js --check    check only, write nothing
 *   node build/build.js --strict   treat free-reference warnings as errors
 *
 * The contract: the bundle is only written if every gate passes. When a gate
 * fails, the build stops and prints WHICH gate failed and WHERE - file and
 * line where that information exists - rather than producing a broken script
 * that only misbehaves once it is loaded in the browser.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { checkImportsResolve, checkRealEsmLoad, checkFreeReferences } = require("./check-wiring");
const { bundle } = require("./bundle");
const { renderCommentsMarkdown } = require("./lib/comments");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "osu-local-favorites.user.js");
// The comments stripped out of the userscript, with links back into it.
const COMMENTS_OUT = path.join(DIST, "comments.md");

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes("--check");
const STRICT = argv.includes("--strict");

const GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m", RESET = "\x1b[0m";
const ok = (m) => console.log(`${GREEN}  PASS${RESET} ${m}`);
const bad = (m) => console.log(`${RED}  FAIL${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}  WARN${RESET} ${m}`);

let failedGate = null;

function gate(n, title) {
  console.log(`\n${DIM}[${n}/5]${RESET} ${title}`);
}

async function main() {
  console.log("osu! Local Favorites - build");

  // ── 1. imports resolve to real exports ────────────────────────────────
  gate(1, "Import targets resolve");
  const e1 = checkImportsResolve(SRC);
  e1.forEach(bad);
  if (e1.length) {
    failedGate = failedGate || { n: 1, name: "Import targets resolve", count: e1.length };
  } else ok("every imported name is exported by the module it comes from");

  // ── 2. the module graph actually links and loads ──────────────────────
  gate(2, "Modules load as a real ES module graph");
  let e2 = [];
  if (e1.length) {
    console.log(`${DIM}  skipped - unresolved imports above would dominate the output${RESET}`);
  } else {
    e2 = await checkRealEsmLoad(SRC);
    e2.forEach(bad);
    if (e2.length) {
      failedGate = failedGate || { n: 2, name: "Modules load as a real ES module graph", count: e2.length };
    } else ok("all modules parse, link and evaluate under a stub DOM");
  }

  // ── 3. no symbol used without being imported ──────────────────────────
  gate(3, "No free (unimported) cross-module references");
  const w3 = checkFreeReferences(SRC);
  w3.forEach(STRICT ? bad : warn);
  if (w3.length) {
    if (STRICT) {
      failedGate = failedGate || { n: 3, name: "No free cross-module references", count: w3.length };
    }
  } else ok("every cross-module symbol is explicitly imported");

  // ── 4. module list and disk agree, and the bundle assembles ───────────
  gate(4, "Module manifest matches disk, bundle assembles");
  let result = { errors: ["skipped"], code: null };
  if (!failedGate) {
    result = bundle();
    result.errors.forEach(bad);
    if (result.errors.length) {
      failedGate = failedGate || { n: 4, name: "Module manifest matches disk", count: result.errors.length };
    } else ok(`bundled ${JSON.parse(fs.readFileSync(path.join(__dirname, "modules.json"), "utf8")).order.length} modules`);
  } else {
    console.log(`${DIM}  skipped - an earlier gate failed${RESET}`);
  }

  // ── 5. the bundled output is itself valid, runnable JS ────────────────
  gate(5, "Bundled output parses and runs");
  if (!failedGate && result.code) {
    fs.mkdirSync(DIST, { recursive: true });
    const tmp = path.join(DIST, ".build-check.js");
    fs.writeFileSync(tmp, result.code);
    try {
      execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
      ok("syntax check (node --check) clean");
      const smoke = smokeTest(result.code);
      if (smoke) {
        bad(`bundle threw while evaluating: ${smoke}`);
        failedGate = { n: 5, name: "Bundled output parses and runs", count: 1 };
      } else ok("evaluates end-to-end under a stub DOM without throwing");
    } catch (err) {
      const msg = (err.stderr || Buffer.from("")).toString().trim().split("\n").slice(0, 4).join("\n    ");
      bad(`bundled output is not valid JS:\n    ${msg}`);
      failedGate = { n: 5, name: "Bundled output parses and runs", count: 1 };
    } finally {
      fs.existsSync(tmp) && fs.unlinkSync(tmp);
    }
  } else {
    console.log(`${DIM}  skipped - an earlier gate failed${RESET}`);
  }

  // ── verdict ───────────────────────────────────────────────────────────
  console.log("");
  if (failedGate) {
    console.log(`${RED}BUILD FAILED${RESET} at gate ${failedGate.n} (${failedGate.name}) - ${failedGate.count} problem(s).`);
    console.log(`${DIM}Nothing was written to dist/. Fix the file:line locations listed above and re-run.${RESET}`);
    process.exit(1);
  }
  if (CHECK_ONLY) {
    const removed = result.comments ? result.comments.total : 0;
    console.log(`${GREEN}ALL CHECKS PASSED${RESET} - wiring is sound, ${removed} comments would be moved to dist/comments.md. (--check: no output written.)`);
    return;
  }
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, result.code);
  const kb = (Buffer.byteLength(result.code) / 1024).toFixed(1);
  const lines = result.code.split("\n").length;
  console.log(`${GREEN}BUILD OK${RESET} -> dist/osu-local-favorites.user.js  (${lines} lines, ${kb} KB)`);

  // Companion document: every comment that was just removed, with a link to
  // the line of the built file it was attached to.
  const doc = renderCommentsMarkdown(result.comments.sections, {
    userscript: path.basename(OUT),
  });
  fs.writeFileSync(COMMENTS_OUT, doc);
  const docKb = (Buffer.byteLength(doc) / 1024).toFixed(1);
  console.log(
    `${GREEN}BUILD OK${RESET} -> dist/comments.md  (${result.comments.total} comments stripped from ${result.comments.sections.length} modules, ${docKb} KB)`,
  );
}

/**
 * Evaluates the finished bundle in the same stub environment the module
 * check uses. Catches the class of bug a syntax check cannot: a `const` read
 * before its declaration because two modules were concatenated in the wrong
 * order (temporal dead zone), which is exactly the failure mode the fixed
 * order in modules.json exists to prevent.
 */
function smokeTest(code) {
  const sandbox = {};
  const el = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {}, remove() {},
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, querySelector: () => null,
    querySelectorAll: () => [], insertBefore() {}, focus() {}, click() {},
    textContent: "", innerHTML: "", value: "",
  });
  const doc = {
    readyState: "loading", // keeps init() parked on DOMContentLoaded
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, createElement: el, createElementNS: el,
    head: el(), documentElement: el(), body: el(), cookie: "",
  };
  const win = {
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
    location: { href: "https://osu.ppy.sh/", pathname: "/", search: "" },
  };
  const realWarn = console.warn, realLog = console.log;
  console.warn = () => {};
  try {
    const fn = new Function(
      "window", "document", "localStorage", "navigator", "indexedDB", "Audio",
      "GM_getValue", "GM_setValue", "GM_registerMenuCommand", "GM_xmlhttpRequest",
      "GM_addValueChangeListener", "unsafeWindow",
      code,
    );
    fn(
      win, doc,
      { getItem: () => null, setItem() {}, removeItem() {} },
      { userAgent: "node-build-smoke-test" },
      { open: () => ({}) },
      function Audio() { return el(); },
      undefined, undefined, undefined, undefined, undefined, win,
    );
    return null;
  } catch (e) {
    return e.message;
  } finally {
    console.warn = realWarn;
    console.log = realLog;
  }
}

main();
