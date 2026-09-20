import { ROW_H } from '@components/engine/row-metrics';
import type { SegmentCtx } from '@core/units';
import { defineUnit } from '@core/units';
import { pxTokens } from '@styles/px-tokens';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import type { ChatImageAttachment, ChatToolCall, ToolNode } from '@/model';
import { Tool } from './Tool';
import { toolRoot, toolVars } from './tool.css';

export type ToolVars = {
  rowH: number;
  imageW: number;
  imageH: number;
  imageGap: number;
};

/**
 * Height of the image strip under a tool row, including the gap that separates
 * it from the row; 0 with no images. Tiles are fixed-size so this is exact.
 */
export function toolImageStripHeight(count: number, width: number, vars: ToolVars): number {
  if (count <= 0) return 0;
  const { imageW, imageH, imageGap } = vars;
  const perRow = Math.max(1, Math.floor((width + imageGap) / (imageW + imageGap)));
  const rows = Math.ceil(count / perRow);
  return imageGap + rows * imageH + (rows - 1) * imageGap;
}

function imagesFromItem(item: ToolNode): ChatImageAttachment[] | undefined {
  // A group has no result of its own; every call item may carry images.
  const images = 'toolCallId' in item ? item.images : undefined;
  if (!images?.length) return undefined;
  return images.map((image, i) => ({
    id: `${item.id}:image:${i}`,
    name: `Image ${i + 1}`,
    dataUrl: `data:${image.mimeType};base64,${image.data}`,
  }));
}

export function toolFromItem(item: ToolNode, ctx: SegmentCtx): ChatToolCall {
  const base = 'toolCallId' in item ? item : null;
  const name =
    item.kind === 'search-tool-call'
      ? 'Search'
      : item.kind === 'mcp-tool-call'
        ? 'MCP'
        : item.kind === 'web-fetch-tool-call'
          ? 'Fetch'
          : item.kind === 'spawn-subagent-tool-call'
            ? 'Subagent'
            : item.kind === 'unknown-tool-call'
              ? item.name
              : item.kind === 'tool-group'
                ? item.label
                : 'Tool';
  const inputSummary =
    item.kind === 'search-tool-call'
      ? `${item.query}${item.matchCount !== undefined ? ` (${item.matchCount} matches)` : ''}`
      : item.kind === 'mcp-tool-call'
        ? [item.server, item.tool].filter(Boolean).join('.')
        : item.kind === 'web-fetch-tool-call'
          ? (item.pageTitle ?? item.url)
          : item.kind === 'spawn-subagent-tool-call'
            ? `${item.name}${item.background ? ' (background)' : ''}`
            : item.kind === 'unknown-tool-call'
              ? (item.toolKind ?? undefined)
              : base?.inputSummary;
  const images = imagesFromItem(item);
  return {
    kind: 'tool',
    id: item.id,
    name,
    status: 'status' in item ? item.status : 'done',
    awaitingPermission: base ? ctx.pendingToolCallIds().has(base.toolCallId) : false,
    inputSummary,
    ...(images ? { images } : {}),
  };
}

export const toolUnitDef = defineUnit<ChatToolCall, ToolVars>({
  kind: 'tool',
  margin: { top: 2, bottom: 2 },
  vars: { rowH: ROW_H, imageW: 360, imageH: 225, imageGap: 8 },

  measure(data, ctx, vars): number {
    return vars.rowH + toolImageStripHeight(data.images?.length ?? 0, ctx.width, vars);
  },

  Render(props) {
    // Width comes from the measure context (Lane A: it affects height); with
    // none yet, one tile per row is the conservative guess.
    const totalH = () => {
      const width = props.ctx.measureCtx?.().width ?? props.vars.imageW;
      return (
        props.vars.rowH + toolImageStripHeight(props.data.images?.length ?? 0, width, props.vars)
      );
    };
    return (
      <div
        class={toolRoot}
        style={assignInlineVars(
          toolVars,
          pxTokens({
            rowH: props.vars.rowH,
            totalH: totalH(),
            imageW: props.vars.imageW,
            imageH: props.vars.imageH,
            imageGap: props.vars.imageGap,
          })
        )}
      >
        <Tool item={props.data} />
      </div>
    );
  },
});
