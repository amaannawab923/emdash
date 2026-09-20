import { ROW_H } from '@components/engine/row-metrics';
import { CollapsibleCard } from '@components/primitives/CollapsibleCard';
import { CopyButton } from '@components/primitives/CopyButton';
import { IconTerminal } from '@components/primitives/icons';
import { measureProseNaturalWidth } from '@components/rows/markdown/prose/layout';
import type { MeasureCtx, RenderCtx } from '@core/define';
import type { ProseBlock } from '@core/markdown/document';
import { defineUnit } from '@core/units';
import { Show, createMemo } from 'solid-js';
import type { ChatExecute } from '@/model';
import { ExecuteBody } from './Execute';
import { executeLines, wrapExecuteLines, type ExecuteRow } from './execute-lines';
import { executeCopy } from './execute.css';

export { executeFromItem } from './execute.presenter';

export type ExecuteVars = {
  /** Fixed height (px) of the header row. */
  rowH: number;
  /** Border width (px) on each side of the card. */
  border: number;
  /** Horizontal padding on each row. */
  linePadX: number;
  /** Vertical padding above the first and below the last row of the panel. */
  padY: number;
  /** Width of the thin native scrollbar in the expanded, scrolling panel. */
  scrollbarSize: number;
  /** Max rows shown in the collapsed (preview) state, the "more" row included. */
  collapsedMaxLines: number;
  /** Max rows shown at once in the expanded state; beyond that the panel scrolls. */
  expandedMaxLines: number;
};

const EXECUTE_VARS: ExecuteVars = {
  rowH: ROW_H,
  border: 1,
  linePadX: 12,
  padY: 6,
  scrollbarSize: 8,
  collapsedMaxLines: 12,
  expandedMaxLines: 40,
};

/** 3 borders: top card edge + header-separator + bottom card edge. */
function chromeY(vars: ExecuteVars): number {
  return 3 * vars.border;
}

type BodyGeometry = { bodyH: number; contentH: number; visibleRows: number };

function executeBodyH(
  rowCount: number,
  codeLineH: number,
  isExpanded: boolean,
  vars: ExecuteVars
): BodyGeometry {
  if (rowCount === 0) return { bodyH: 0, contentH: 0, visibleRows: 0 };
  const padY = 2 * vars.padY;
  const contentH = rowCount * codeLineH + padY;
  if (isExpanded) {
    const visible = Math.min(rowCount, vars.expandedMaxLines);
    return { bodyH: visible * codeLineH + padY, contentH, visibleRows: rowCount };
  }
  const visible = Math.min(rowCount, vars.collapsedMaxLines);
  return {
    bodyH: visible * codeLineH + padY,
    contentH: visible * codeLineH + padY,
    visibleRows: visible,
  };
}

function measureTextWidth(text: string, ctx: MeasureCtx): number {
  const codeFonts = { ...ctx.theme.fonts, body: ctx.theme.fonts.code };
  const block: ProseBlock = {
    kind: 'prose',
    id: 'execute-width',
    variant: 'body',
    runs: [{ kind: 'text', text }],
  };
  return measureProseNaturalWidth(block, codeFonts);
}

/** Inner width (px) of the panel that a row's text can occupy. */
function rowWidth(ctx: MeasureCtx, vars: ExecuteVars, scrolls: boolean): number {
  return ctx.width - 2 * vars.border - 2 * vars.linePadX - (scrolls ? vars.scrollbarSize : 0);
}

/** One advance of the code font, from a run long enough to average out rounding. */
const ADVANCE_SAMPLE = '0'.repeat(64);
const advanceMemo = new WeakMap<MeasureCtx['theme']['fonts'], number>();
function codeAdvance(ctx: MeasureCtx): number {
  const fonts = ctx.theme.fonts;
  const hit = advanceMemo.get(fonts);
  if (hit !== undefined) return hit;
  const advance = measureTextWidth(ADVANCE_SAMPLE, ctx) / ADVANCE_SAMPLE.length;
  advanceMemo.set(fonts, advance);
  return advance;
}

/**
 * The panel's rows at the current width. The expanded panel may need a
 * vertical scrollbar, which narrows the rows; that in turn is decided by the
 * row count, so wrap once without the bar and again with it when needed.
 */
function executeRows(
  item: ChatExecute,
  ctx: MeasureCtx,
  vars: ExecuteVars,
  expanded: boolean
): ExecuteRow[] {
  const lines = executeLines(item);
  const advance = codeAdvance(ctx);
  const wrap = (scrolls: boolean): ExecuteRow[] => {
    const width = rowWidth(ctx, vars, scrolls);
    const maxChars = advance > 0 ? Math.max(8, Math.floor(width / advance)) : 80;
    return wrapExecuteLines(lines, maxChars, (text) => measureTextWidth(text, ctx) <= width);
  };
  const rows = wrap(false);
  const scrolls = expanded && rows.length > vars.expandedMaxLines;
  return scrolls ? wrap(true) : rows;
}

function executeUnitH(item: ChatExecute, ctx: MeasureCtx, vars: ExecuteVars): number {
  const expanded = ctx.expanded(item.id);
  const rows = executeRows(item, ctx, vars, expanded);
  const { bodyH } = executeBodyH(rows.length, ctx.theme.fonts.code.lineHeight, expanded, vars);
  return vars.rowH + bodyH + chromeY(vars);
}

function ExecuteUnitRender(props: { data: ChatExecute; ctx: RenderCtx; vars: ExecuteVars }) {
  const mCtx = () => props.ctx.measureCtx?.();
  // Inverted semantics: stored "collapsed" bool = "expanded".
  const isExpanded = () => props.ctx.viewState.isCollapsed(props.data.id);

  const rows = createMemo(() => {
    const ctx = mCtx();
    return ctx ? executeRows(props.data, ctx, props.vars, isExpanded()) : [];
  });
  const codeLineH = createMemo(() => mCtx()?.theme.fonts.code.lineHeight ?? 0);
  const bodyGeometry = createMemo(() => {
    const lineH = codeLineH();
    if (!lineH) return { bodyH: 0, contentH: 0, visibleRows: 0 };
    return executeBodyH(rows().length, lineH, isExpanded(), props.vars);
  });

  const totalH = createMemo(() => {
    const ctx = mCtx();
    if (!ctx) return props.vars.rowH + chromeY(props.vars);
    return executeUnitH(props.data, ctx, props.vars);
  });

  return (
    <CollapsibleCard
      id={props.data.id}
      ctx={props.ctx}
      height={totalH()}
      headerH={props.vars.rowH}
      expanded={isExpanded()}
      active={props.data.status === 'running' && !props.data.awaitingPermission}
      error={props.data.status === 'error'}
      errorTitle={props.data.error}
      awaitingPermission={props.data.awaitingPermission}
      icon={<IconTerminal />}
      header={props.data.inputSummary || 'Execute'}
      headerRight={
        <Show when={props.data.command}>
          {/* A native (non-delegated) listener: ChatRoot's collapse toggle is a
              native listener on the scroll container, so only stopping the
              event before it bubbles that far keeps a copy from toggling. */}
          <span class={executeCopy} on:click={(e) => e.stopPropagation()}>
            <CopyButton text={props.data.command} variant="icon" label="Copy command" />
          </span>
        </Show>
      }
    >
      <Show when={codeLineH() > 0 && rows().length > 0}>
        <ExecuteBody
          item={props.data}
          rows={rows()}
          visibleRows={bodyGeometry().visibleRows}
          bodyH={bodyGeometry().bodyH}
          contentH={bodyGeometry().contentH}
          codeLineH={codeLineH()}
          linePadX={props.vars.linePadX}
          padY={props.vars.padY}
          scrollbarSize={props.vars.scrollbarSize}
          expanded={isExpanded()}
        />
      </Show>
    </CollapsibleCard>
  );
}

export const executeUnitDef = defineUnit<ChatExecute, ExecuteVars>({
  kind: 'execute',
  margin: { top: 2, bottom: 6 },
  vars: EXECUTE_VARS,

  estimate(item, ctx, vars): number {
    // Rough geometry before fonts are known: a 20px code line, ~7.5px per
    // character, and the collapsed cap.
    const approxLineH = 20;
    const approxAdvance = 7.5;
    const maxChars = Math.max(8, Math.floor(rowWidth(ctx, vars, false) / approxAdvance));
    let rowCount = 0;
    for (const line of executeLines(item)) {
      rowCount += Math.max(1, Math.ceil(line.text.length / maxChars));
    }
    const { bodyH } = executeBodyH(rowCount, approxLineH, false, vars);
    return vars.rowH + bodyH + chromeY(vars);
  },

  measure(item, ctx, vars): number {
    return executeUnitH(item, ctx, vars);
  },

  Render: ExecuteUnitRender,
});
