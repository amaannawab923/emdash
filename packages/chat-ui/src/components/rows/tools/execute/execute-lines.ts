/**
 * execute-lines — incremental display-line and row bookkeeping for the
 * execute row.
 *
 * Live terminal output arrives as an identity-stable lines array (the client
 * log store mutates it in place and bumps a version per flush). Both helpers
 * here key WeakMap caches on array identity so per-update work is
 * proportional to *new* lines only:
 *
 *   executeLines      — rebuilds the display array per flush but reuses the
 *                       previous row objects for unchanged lines, so the
 *                       renderer's keyed <For> does not recreate DOM rows.
 *   wrapExecuteLines  — breaks display lines into physical rows of at most
 *                       `maxChars` characters. The row does its own wrapping
 *                       (like a terminal) instead of letting the browser wrap,
 *                       so the unit's measured height is rows × line height
 *                       with no layout involved — the measure === DOM-height
 *                       invariant every chat-ui row must keep.
 */

import type { ChatExecute } from '@/model';

export type ExecuteDisplayLine = {
  kind: 'command' | 'spacer' | 'truncated' | 'output';
  text: string;
};

export const TRUNCATED_LINE_TEXT = '… earlier output truncated';

/** Tabs render at tab stops under `white-space: pre`, which the wrapper cannot count; expand them. */
const TAB = '    ';

// ── Display lines ─────────────────────────────────────────────────────────────

type DisplayMemo = {
  command: string;
  version: number | undefined;
  truncated: boolean;
  lineCount: number;
  display: ExecuteDisplayLine[];
};

const displayMemo = new WeakMap<readonly string[], DisplayMemo>();

export function executeLines(item: ChatExecute): ExecuteDisplayLine[] {
  const output = item.outputLines;
  if (!output) return buildDisplay(item, [], undefined);

  const memo = displayMemo.get(output);
  if (
    memo &&
    memo.command === item.command &&
    memo.version === item.outputVersion &&
    memo.truncated === (item.outputTruncated ?? false) &&
    memo.lineCount === output.length
  ) {
    return memo.display;
  }

  const display = buildDisplay(item, output, memo?.display);
  displayMemo.set(output, {
    command: item.command,
    version: item.outputVersion,
    truncated: item.outputTruncated ?? false,
    lineCount: output.length,
    display,
  });
  return display;
}

function buildDisplay(
  item: ChatExecute,
  output: readonly string[],
  previous: ExecuteDisplayLine[] | undefined
): ExecuteDisplayLine[] {
  const next: ExecuteDisplayLine[] = [];
  const push = (kind: ExecuteDisplayLine['kind'], raw: string): void => {
    const text = raw.includes('\t') ? raw.replaceAll('\t', TAB) : raw;
    const old = previous?.[next.length];
    next.push(old && old.kind === kind && old.text === text ? old : { kind, text });
  };

  const commandLines = (item.command || '…').split('\n');
  for (let i = 0; i < commandLines.length; i += 1) {
    push('command', `${i === 0 ? '$' : ' '} ${commandLines[i]}`);
  }

  // A lone empty line is the store's "no output yet" shape — render nothing.
  const hasOutput = output.length > 0 && !(output.length === 1 && output[0] === '');
  if (hasOutput || item.outputTruncated) {
    push('spacer', '');
    if (item.outputTruncated) push('truncated', TRUNCATED_LINE_TEXT);
    for (const line of output) push('output', line);
  }
  return next;
}

// ── Physical rows ─────────────────────────────────────────────────────────────

export type ExecuteRow = {
  kind: ExecuteDisplayLine['kind'];
  text: string;
  /** The display line this row was cut from. */
  line: ExecuteDisplayLine;
  /** Offset (UTF-16 code units) of `text` within that display line. */
  start: number;
};

/** True when `text` fits on one row of the panel; only consulted for non-ASCII text. */
export type RowFits = (text: string) => boolean;

type LineRows = { maxChars: number; rows: ExecuteRow[] };

/** Per display line: its rows at a given width. Lines are identity-stable across flushes. */
const lineRows = new WeakMap<ExecuteDisplayLine, LineRows>();
/** Per display array: the assembled rows, so an unchanged transcript costs nothing. */
const arrayRows = new WeakMap<ExecuteDisplayLine[], LineRows>();

/** Anything outside printable ASCII may not be one advance wide in the code font. */
const NON_ASCII = /[^ -~]/;

/**
 * Break display lines into rows of at most `maxChars` characters, the way a
 * terminal of that width would. `maxChars` comes from the panel's inner width
 * over the code font's advance, so for ASCII (the overwhelming case for shell
 * text) the cut is exact without measuring anything. A row with non-ASCII
 * text may hold wider glyphs, so it is checked with `fits` and shortened
 * until it does — never the other way round, so a row never overflows its
 * panel and is never cut shorter than the browser would have fit.
 *
 * Memoized per display line: a live output flush only wraps the new tail,
 * and unchanged lines keep their row objects for the renderer's keyed <For>.
 */
export function wrapExecuteLines(
  lines: ExecuteDisplayLine[],
  maxChars: number,
  fits: RowFits
): ExecuteRow[] {
  const cap = Math.max(1, Math.floor(maxChars));
  const whole = arrayRows.get(lines);
  if (whole && whole.maxChars === cap) return whole.rows;

  const rows: ExecuteRow[] = [];
  for (const line of lines) {
    let cached = lineRows.get(line);
    if (!cached || cached.maxChars !== cap) {
      cached = { maxChars: cap, rows: wrapLine(line, cap, fits) };
      lineRows.set(line, cached);
    }
    for (const row of cached.rows) rows.push(row);
  }
  arrayRows.set(lines, { maxChars: cap, rows });
  return rows;
}

function wrapLine(line: ExecuteDisplayLine, cap: number, fits: RowFits): ExecuteRow[] {
  const text = line.text;
  if (text.length <= cap && (!NON_ASCII.test(text) || fits(text))) {
    return [{ kind: line.kind, text, line, start: 0 }];
  }
  const out: ExecuteRow[] = [];
  const points = Array.from(text);
  let i = 0;
  let start = 0;
  while (i < points.length) {
    let n = Math.min(cap, points.length - i);
    let chunk = points.slice(i, i + n).join('');
    if (NON_ASCII.test(chunk)) {
      // Binary-search the longest prefix that fits; wide glyphs (CJK, emoji)
      // take more than one advance each.
      let lo = 1;
      let hi = n;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(points.slice(i, i + mid).join(''))) lo = mid;
        else hi = mid - 1;
      }
      n = lo;
      chunk = points.slice(i, i + n).join('');
    }
    out.push({ kind: line.kind, text: chunk, line, start });
    start += chunk.length;
    i += n;
  }
  return out;
}
