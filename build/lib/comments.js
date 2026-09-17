"use strict";
/**
 * Comment extraction for the bundler.
 *
 * The shipped userscript is plain code: `build.js` removes every module
 * comment from dist/osu-local-favorites.user.js and collects them in
 * dist/comments.md instead - one entry per comment, each linked to the line of
 * the built file it was removed from.
 *
 * Three things are deliberately NOT extracted, because they belong to the
 * bundle rather than to any module:
 *
 *   - the ==UserScript== metadata block (meta/userscript-header.txt): the
 *     script cannot install without it,
 *   - the generated context table (the module list near the top of the file),
 *   - the per-module section banner the bundler writes
 *     (`// ━━━━━━━━━━ src/ui/main-panel.js ━━━━━━━━━━`), which is what
 *     keeps the stripped file navigable.
 *
 * The scanner is a state machine rather than a parser, but it errs in the safe
 * direction: string/template literals are copied through untouched so a `//`
 * inside one is never mistaken for a comment, and a `/` is only treated as a
 * regex literal when a closing slash actually exists on the same line - so a
 * heuristic miss degrades to "left as code", never "code swallowed". The
 * bundle is additionally checked afterwards (see verifyStrip) to prove that
 * only comments were removed and none were left behind.
 */

// A `/` after one of these starts a regex literal rather than a division.
const REGEX_AFTER_WORD = new Set([
  "return", "typeof", "instanceof", "in", "of", "case", "do", "else",
  "void", "delete", "new", "throw", "yield", "await",
]);
// A `/` after one of these characters is division, not a regex.
const DIVISION_AFTER_CHAR = /[A-Za-z0-9_$)\]]/;

function lineStartsOf(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}

/** 0-based index of the line containing character offset `pos`. */
function lineIndexAt(starts, pos) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Index just past the string literal starting at `i`, or the line end. */
function skipString(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== "\n") {
    if (src[j] === "\\") {
      j += 2;
      continue;
    }
    if (src[j] === quote) return j + 1;
    j++;
  }
  return Math.min(j, src.length);
}

/**
 * Index just past a regex literal starting at `i`, or -1 when there is no
 * closing slash on this line (in which case the caller treats the `/` as
 * ordinary code rather than risking a skip over real code).
 */
function regexEnd(src, i) {
  let j = i + 1;
  let inClass = false;
  while (j < src.length && src[j] !== "\n") {
    const ch = src[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) {
      j++;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

/**
 * Every comment in `src`, in source order, as { start, end, line, text }.
 * `line` is 1-based within the string that was scanned.
 */
function findComments(src) {
  const comments = [];
  const starts = lineStartsOf(src);
  const n = src.length;
  let i = 0;
  let prevChar = ""; // last significant character of code
  let prevWord = ""; // last identifier-ish word of code (survives whitespace)
  const frames = []; // template literals: { kind: "text" } | { kind: "interp", braces }
  const inTemplateText = () => frames.length > 0 && frames[frames.length - 1].kind === "text";

  const record = (start, end) => {
    const line = lineIndexAt(starts, start) + 1;
    comments.push({
      start,
      end,
      line,
      // Column the comment starts at, so the markdown can re-align the
      // continuation lines of a block comment with its first line.
      column: start - starts[line - 1],
      text: src.slice(start, end),
    });
  };

  while (i < n) {
    const c = src[i];

    // ── inside template text: verbatim, except `${` which returns to code ──
    if (inTemplateText()) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        frames.pop();
        prevChar = "`";
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        // The text frame stays on the stack: the interpolation is nested
        // inside it, and the closing backtick still has to be seen as
        // template text when the interpolation ends. Replacing the frame
        // instead (the earlier bug) made everything after a `${...}` look
        // like code, so the template's closing backtick opened a new frame
        // and the rest of the file was swallowed.
        frames.push({ kind: "interp", braces: 1 });
        prevChar = "{";
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    const c2 = src[i + 1];

    // ── comments ──
    if (c === "/" && c2 === "/") {
      const start = i;
      while (i < n && src[i] !== "\n") i++;
      record(start, i);
      continue;
    }
    if (c === "/" && c2 === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i = Math.min(n, i + 2);
      record(start, i);
      continue;
    }

    // ── literals ──
    if (c === "'" || c === '"') {
      i = skipString(src, i);
      prevChar = c;
      prevWord = "";
      continue;
    }
    if (c === "`") {
      frames.push({ kind: "text" });
      prevChar = "`";
      prevWord = "";
      i++;
      continue;
    }

    // ── template interpolation bookkeeping ──
    if (c === "{") {
      const top = frames[frames.length - 1];
      if (top && top.kind === "interp") top.braces++;
      prevChar = c;
      prevWord = "";
      i++;
      continue;
    }
    if (c === "}") {
      const top = frames[frames.length - 1];
      if (top && top.kind === "interp") {
        top.braces--;
        if (top.braces === 0) frames.pop();
      }
      prevChar = c;
      prevWord = "";
      i++;
      continue;
    }

    // ── regex literal vs division ──
    if (c === "/") {
      const regexExpected = REGEX_AFTER_WORD.has(prevWord) || !DIVISION_AFTER_CHAR.test(prevChar);
      if (regexExpected) {
        const end = regexEnd(src, i);
        if (end > 0) {
          i = end;
          prevChar = "/";
          prevWord = "";
          continue;
        }
      }
      prevChar = c;
      prevWord = "";
      i++;
      continue;
    }

    // ── identifiers (tracked for the regex heuristic) ──
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      prevWord = src.slice(i, j);
      prevChar = src[j - 1];
      i = j;
      continue;
    }

    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = "";
    }
    i++;
  }

  return mergeLineCommentRuns(src, comments, starts);
}

/**
 * A paragraph of `//` lines is one comment to a reader, not one per line, so
 * consecutive standalone ones are joined into a single span. Only runs where
 * every line is *just* a comment are joined - a trailing comment after code
 * stays on its own, and a blank line between two `//` blocks keeps them
 * separate (they are different paragraphs).
 */
function mergeLineCommentRuns(src, comments, starts) {
  const isLineComment = (c) => src.slice(c.start, c.start + 2) === "//";
  const standalone = (c) => src.slice(starts[c.line - 1], c.start).trim() === "";

  const merged = [];
  for (const comment of comments) {
    const previous = merged[merged.length - 1];
    const joins =
      previous &&
      isLineComment(previous) &&
      isLineComment(comment) &&
      standalone(previous) &&
      standalone(comment) &&
      // The comment's line is the one right after the previous block's last.
      comment.line === lineIndexAt(starts, previous.end) + 2;
    if (joins) {
      previous.end = comment.end;
      previous.text = src.slice(previous.start, previous.end);
      continue;
    }
    merged.push({ ...comment });
  }
  return merged;
}

/**
 * Removes every comment from `body`, keeping string and template literals
 * intact, and reports where each one was.
 *
 * Returns { lines, anchors }: `lines` is the comment-free body (blank source
 * lines are kept, collapsed to at most one in a row; comment-only lines are
 * dropped), and `anchors[i]` is the 1-based line of `lines` that comment `i`
 * was attached to - the code line it documented, or the next code line after
 * it. Anchors therefore stay valid in the stripped file, which is what the
 * generated comments.md links point at.
 */
function removeComments(body) {
  const comments = findComments(body);
  const starts = lineStartsOf(body);
  const srcLines = body.split("\n");
  const cuts = srcLines.map(() => []);

  comments.forEach((comment, index) => {
    const first = lineIndexAt(starts, comment.start);
    const last = lineIndexAt(starts, Math.max(comment.start, comment.end - 1));
    for (let li = first; li <= last && li < srcLines.length; li++) {
      const lineStart = starts[li];
      const lineEnd = lineStart + srcLines[li].length;
      const from = Math.max(comment.start, lineStart);
      const to = Math.min(comment.end, lineEnd);
      if (to > from) cuts[li].push([from - lineStart, to - lineStart, index]);
    }
  });

  const out = [];
  const anchors = new Array(comments.length).fill(-1);
  let pending = new Set();

  for (let li = 0; li < srcLines.length; li++) {
    let code = srcLines[li];
    if (cuts[li].length) {
      // Right to left, so the earlier offsets stay valid.
      for (let k = cuts[li].length - 1; k >= 0; k--) {
        const [from, to, index] = cuts[li][k];
        code = code.slice(0, from) + code.slice(to);
        pending.add(index);
      }
      code = code.replace(/\s+$/, "");
    }

    if (code.trim() === "") {
      // A comment-only line leaves nothing behind. Genuine blank lines are
      // kept (one at a time) so the stripped file keeps the author's spacing.
      if (srcLines[li].trim() === "" && out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }

    out.push(code);
    const anchor = out.length; // 1-based line number of the line just emitted
    for (const index of pending) anchors[index] = anchor;
    pending = new Set();
  }

  // Comments with no code after them (end of the module body) point at the
  // last line that does exist.
  const tail = out.length || 1;
  for (let i = 0; i < anchors.length; i++) if (anchors[i] < 0) anchors[i] = tail;

  return { lines: out, anchors, comments };
}

/** Lines of the built file that are allowed to keep their comments. */
function exemptLines(lines) {
  const allowed = new Set();
  let inMetadata = false;
  let inContextTable = false;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/^\s*\/\/ ==UserScript==/.test(line)) inMetadata = true;
    if (inMetadata) allowed.add(n);
    if (/^\s*\/\/ ==\/UserScript==/.test(line)) inMetadata = false;

    if (/^\s*\/\* === osu! Local Favorites ===/.test(line)) inContextTable = true;
    if (inContextTable) allowed.add(n);
    if (inContextTable && /^\s*\*\/$/.test(line)) inContextTable = false;

    if (/^\s*\/\/ ━+ /.test(line)) allowed.add(n);
  });
  return allowed;
}

/** Every character of `code` that is not whitespace, in order. */
function significantChars(code) {
  return code.replace(/\s+/g, "");
}

/**
 * Independent checks on a finished strip. These are deliberately not a second
 * comment parser (two parsers that share the same blind spot prove nothing),
 * and they are not a token comparison either: both string-strippers in
 * lib/strip.js lose their place on this codebase's nested template literals,
 * so their output is not a usable reference. Instead:
 *
 *   1. every removed span really does start with a comment marker - the one
 *      failure mode that would silently delete code (a misdetected regex or
 *      string) shows up here immediately;
 *   2. the stripped file's non-whitespace characters appear in order in the
 *      unstripped one, so nothing was duplicated or reordered;
 *   3. the finished file has no comments left outside the exempt regions
 *      (metadata block, context table, section banners);
 *   4. the amount of text removed equals the text inside the identified
 *      comment spans, so the assembler removed exactly those spans and not a
 *      line more.
 *
 * Together with `node --check` and the stub-DOM evaluation in gate 5, that
 * covers both "stripped too much" and "did not strip enough".
 */
function verifyStrip(fullCode, strippedCode, comments) {
  const problems = [];

  const removed = comments || [];
  for (const c of removed) {
    const text = String(c.text || "").trim();
    if (!text.startsWith("//") && !text.startsWith("/*")) {
      problems.push(
        `line ${c.line}: removed text is not a comment (starts with ${JSON.stringify(text.slice(0, 40))}) - ` +
          `the scanner misread code as a comment`,
      );
      if (problems.length >= 10) return problems;
    }
  }

  const before = significantChars(fullCode);
  const after = significantChars(strippedCode);
  let from = 0;
  for (let i = 0; i < after.length; i++) {
    const at = before.indexOf(after[i], from);
    if (at < 0) {
      const around = after.slice(Math.max(0, i - 40), i + 40);
      problems.push(`stripped code diverges from the unstripped bundle near: ...${around}...`);
      break;
    }
    from = at + 1;
  }

  const removedChars = (fullCode.match(/\S/g) || []).length - (strippedCode.match(/\S/g) || []).length;
  const expectedChars = removed.reduce((total, c) => total + (String(c.text || "").match(/\S/g) || []).length, 0);
  if (removedChars !== expectedChars) {
    problems.push(
      `stripped ${removedChars} non-whitespace characters, but the identified comments only account for ` +
        `${expectedChars} - code was removed outside a comment span`,
    );
  }

  const lines = strippedCode.split("\n");
  const allowed = exemptLines(lines);
  for (const c of findComments(strippedCode)) {
    const startLine = c.line;
    const endLine = startLine + String(c.text || "").split("\n").length - 1;
    for (let n = startLine; n <= endLine; n++) {
      if (!allowed.has(n)) {
        problems.push(`line ${n}: comment left in the built file: ${lines[n - 1].trim().slice(0, 60)}`);
        if (problems.length >= 10) return problems;
      }
    }
  }

  return problems;
}

/**
 * Re-aligns the continuation lines of a comment with its first line: the
 * comment is stored from its own first character, so every following line
 * still carries the source indentation (and a JSDoc `*` keeps its customary
 * one-space offset).
 */
function dedent(text, column) {
  const lines = text.split("\n");
  if (lines.length < 2 || column <= 0) return text;
  const pad = " ".repeat(column);
  return lines
    .map((line, i) => (i > 0 && line.startsWith(pad) ? line.slice(pad.length) : line))
    .join("\n");
}

/** Renders the collected comments as the companion markdown document. */
function renderCommentsMarkdown(sections, opts = {}) {
  const userscript = opts.userscript || "osu-local-favorites.user.js";
  const total = sections.reduce((n, s) => n + s.comments.length, 0);
  const out = [];

  out.push("# Stripped comments");
  out.push("");
  out.push(
    `${total} comments were removed from [\`${userscript}\`](./${userscript}) by \`npm run build\` - ` +
      `the built script ships without them.`,
  );
  out.push("");
  out.push("Each entry links to the **line of the built userscript** the comment was attached to: the");
  out.push("line it documented, or the first code line after it when the comment sat on its own. The");
  out.push("`src L…` number on the right is the comment's line in the module it came from.");
  out.push("");
  out.push("Not listed here, because they stay in the built file:");
  out.push("");
  out.push("- the `==UserScript==` metadata block (`meta/userscript-header.txt`)");
  out.push("- the generated context table at the top of the file");
  out.push("- the per-module section banners (`// ━━━━━━━━━━ src/… ━━━━━━━━━━`)");
  out.push("");
  out.push("## Contents");
  out.push("");
  sections.forEach((s, i) => {
    const anchor = s.file.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
    out.push(`${i + 1}. [\`src/${s.file}\`](#${anchor}) - ${s.comments.length} comments, [first](./${userscript}#L${s.comments.length ? s.comments[0].line : s.bodyStart})`);
  });
  out.push("");
  out.push("---");

  for (const s of sections) {
    out.push("");
    out.push(`## \`src/${s.file}\``);
    out.push("");
    if (!s.comments.length) {
      out.push("*No comments.*");
      continue;
    }
    out.push(
      `${s.comments.length} comments · userscript [L${s.comments[0].line}](./${userscript}#L${s.comments[0].line})` +
        ` - [L${s.comments[s.comments.length - 1].line}](./${userscript}#L${s.comments[s.comments.length - 1].line})`,
    );
    out.push("");
    for (const c of s.comments) {
      const text = dedent(c.text.replace(/\s+$/, ""), c.column || 0);
      out.push(`**[L${c.line}](./${userscript}#L${c.line})** · src L${c.sourceLine}`);
      out.push("");
      out.push("```js");
      out.push(text);
      out.push("```");
      out.push("");
    }
  }

  out.push("");
  return out.join("\n");
}

module.exports = {
  findComments,
  removeComments,
  exemptLines,
  verifyStrip,
  renderCommentsMarkdown,
};
