/**
 * Execute — SolidJS components for ChatExecute rows.
 *
 * Renders ACP `kind: 'execute'` tool calls as a collapsible card:
 *
 *   ┌─────────────────────────────────────┐
 *   │  Execute                     [copy] │  ← header (CollapsibleCard primitive)
 *   ├─────────────────────────────────────┤
 *   │  $ pnpm run build --filter=@emdash/ │  ← body: a terminal panel — mono,
 *   │  chat-ui                            │    bash-highlighted, rows wrapped by
 *   │                                     │    the row itself (execute-lines.ts)
 *   │  ··· 41 more lines — Show all       │  ← collapsed: a real last row, not
 *   └─────────────────────────────────────┘    a fade; expanded: scrolls inside
 *
 * Header + card shell are provided by CollapsibleCard.
 */

import { useCaches } from '@components/contexts/CachesContext';
import { cancelIdle, scheduleIdle } from '@components/engine/dom-utils';
import { applyTokensToElement, type CodeToken } from '@core/highlight/apply-tokens';
import { For, Show, createEffect, createMemo, onCleanup } from 'solid-js';
import type { ChatExecute } from '@/model';
import type { ExecuteDisplayLine, ExecuteRow } from './execute-lines';
import {
  executeBody,
  executeLine,
  executeMoreAction,
  executeMoreLine,
  executeOutputLine,
  executeSpacerLine,
  executeTruncatedLine,
} from './execute.css';

// ── Token slicing ─────────────────────────────────────────────────────────────

/** The tokens covering `[start, end)` of a highlighted line, cut at the edges. */
export function sliceTokens(tokens: CodeToken[], start: number, end: number): CodeToken[] {
  const out: CodeToken[] = [];
  let at = 0;
  for (const tok of tokens) {
    const tokEnd = at + tok.content.length;
    if (tokEnd > start && at < end) {
      const content = tok.content.slice(
        Math.max(0, start - at),
        Math.min(tok.content.length, end - at)
      );
      if (content) out.push(tok.htmlStyle ? { content, htmlStyle: tok.htmlStyle } : { content });
    }
    at = tokEnd;
    if (at >= end) break;
  }
  return out;
}

// ── ExecuteBody ───────────────────────────────────────────────────────────────

export type ExecuteBodyProps = {
  item: ChatExecute;
  /** Every physical row of the panel (command, spacer, output …). */
  rows: ExecuteRow[];
  /** Rows shown; when fewer than `rows`, the last visible slot is the "more" row. */
  visibleRows: number;
  /** Panel height (px) including its vertical padding. */
  bodyH: number;
  /** Height (px) of all rows plus padding — larger than bodyH only when the expanded panel scrolls. */
  contentH: number;
  codeLineH: number;
  linePadX: number;
  padY: number;
  scrollbarSize: number;
  expanded: boolean;
};

export function ExecuteBody(props: ExecuteBodyProps) {
  const caches = useCaches();
  const rowEls = new Map<ExecuteRow, HTMLElement>();

  // Bash highlighting runs over the logical command lines once; each physical
  // row then paints the slice of its line's tokens that it carries.
  createEffect(() => {
    const commandLines: ExecuteDisplayLine[] = [];
    for (const row of props.rows) {
      if (row.kind !== 'command') break;
      if (commandLines[commandLines.length - 1] !== row.line) commandLines.push(row.line);
    }
    const command = commandLines.map((line) => line.text).join('\n');
    if (!command || !rowEls.size) return;

    function paint(tokenLines: CodeToken[][]): void {
      for (const [row, el] of rowEls) {
        if (row.kind !== 'command') continue;
        const tokens = tokenLines[commandLines.indexOf(row.line)];
        if (tokens)
          applyTokensToElement(el, sliceTokens(tokens, row.start, row.start + row.text.length));
      }
    }

    const cached = caches.peekHighlight(command, 'bash');
    if (cached) {
      paint(cached.lines);
      return;
    }

    let cancelled = false;
    const handle = scheduleIdle(() => {
      if (cancelled) return;
      const result = caches.highlight(command, 'bash');
      if (cancelled || !result) return;
      paint(result.lines);
    });

    onCleanup(() => {
      cancelled = true;
      cancelIdle(handle);
    });
  });

  const truncated = () => props.visibleRows < props.rows.length;
  const shown = createMemo(() =>
    truncated() ? props.rows.slice(0, Math.max(0, props.visibleRows - 1)) : props.rows
  );
  // Counted in lines as the person sees them, not the physical rows a long
  // line was cut into.
  const hiddenLines = createMemo(() => {
    const lines = new Set<ExecuteDisplayLine>();
    for (const row of props.rows.slice(shown().length)) lines.add(row.line);
    return lines.size;
  });

  const rowStyle = () => ({
    height: `${props.codeLineH}px`,
    'line-height': `${props.codeLineH}px`,
    'padding-left': `${props.linePadX}px`,
    'padding-right': `${props.linePadX}px`,
  });

  return (
    <div
      class={executeBody}
      style={{
        height: `${props.bodyH}px`,
        'padding-top': `${props.padY}px`,
        'padding-bottom': `${props.padY}px`,
        '--execute-scrollbar-size': `${props.scrollbarSize}px`,
        'overflow-y': props.expanded && props.contentH > props.bodyH ? 'auto' : 'hidden',
      }}
    >
      <For each={shown()}>
        {(row) => (
          <div
            ref={(el) => {
              rowEls.set(row, el);
              onCleanup(() => rowEls.delete(row));
            }}
            class={executeLine}
            classList={{
              [executeOutputLine]: row.kind === 'output',
              [executeSpacerLine]: row.kind === 'spacer',
              [executeTruncatedLine]: row.kind === 'truncated',
            }}
            style={rowStyle()}
          >
            {row.text}
          </div>
        )}
      </For>
      <Show when={truncated()}>
        <div
          class={`${executeLine} ${executeMoreLine}`}
          style={rowStyle()}
          role="button"
          tabIndex={0}
          data-collapse-id={props.item.id}
          // A key press becomes the click ChatRoot's collapse delegation
          // listens for.
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              (e.currentTarget as HTMLElement).click();
            }
          }}
        >
          {`··· ${hiddenLines()} more ${hiddenLines() === 1 ? 'line' : 'lines'} — `}
          <span class={executeMoreAction}>Show all</span>
        </div>
      </Show>
    </div>
  );
}
