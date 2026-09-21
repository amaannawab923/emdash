import type { SegmentCtx } from '@core/units';
import { describe, expect, it } from 'vitest';
import type { ToolNode } from '@/model';
import { toolFromItem, toolImageStripHeight, toolUnitDef } from './tool.def';

function searchItem(query: string) {
  return {
    kind: 'search-tool-call',
    id: 'search-1',
    seq: 0,
    toolCallId: 'call-1',
    title: 'Search',
    status: 'done',
    query,
  } satisfies Extract<ToolNode, { kind: 'search-tool-call' }>;
}

const ctx = {
  pendingToolCallIds: () => new Set<string>(),
} as SegmentCtx;

describe('toolFromItem', () => {
  it('preserves raw search queries that begin with search', () => {
    expect(toolFromItem(searchItem('search engine optimization'), ctx)).toMatchObject({
      name: 'Search',
      inputSummary: 'search engine optimization',
    });
  });

  it('preserves search summaries without the redundant prefix', () => {
    expect(toolFromItem(searchItem('SolidJS virtualized list patterns'), ctx)).toMatchObject({
      name: 'Search',
      inputSummary: 'SolidJS virtualized list patterns',
    });
  });
});

function screenshotItem(images: Array<{ mimeType: string; data: string }>) {
  return {
    kind: 'unknown-tool-call',
    id: 'shot-1',
    seq: 0,
    toolCallId: 'call-shot',
    title: 'mcp__browser__take_screenshot',
    status: 'done',
    toolKind: 'other',
    name: 'mcp__browser__take_screenshot',
    images,
  } satisfies Extract<ToolNode, { kind: 'unknown-tool-call' }>;
}

describe('an unknown tool', () => {
  it('reads an MCP id as tool + server, never as `other`', () => {
    const tool = toolFromItem(screenshotItem([]), ctx);
    expect(tool.name).toBe('take_screenshot');
    expect(tool.inputSummary).toBe('browser');
  });

  it('shows a known kind for a plain id, and nothing for `other`', () => {
    const plain = { ...screenshotItem([]), name: 'CustomTool', title: 'CustomTool' };
    expect(toolFromItem(plain, ctx)).toMatchObject({ name: 'CustomTool' });
    expect(toolFromItem(plain, ctx).inputSummary).toBeUndefined();
    expect(toolFromItem({ ...plain, toolKind: 'think' }, ctx).inputSummary).toBe('think');
  });
});

describe('tool images', () => {
  it("maps a tool item's images to attachments with data URLs, in order", () => {
    const tool = toolFromItem(
      screenshotItem([
        { mimeType: 'image/png', data: 'AAAA' },
        { mimeType: 'image/jpeg', data: 'BBBB' },
      ]),
      ctx
    );
    expect(tool.images).toEqual([
      { id: 'shot-1:image:0', name: 'Image 1', dataUrl: 'data:image/png;base64,AAAA' },
      { id: 'shot-1:image:1', name: 'Image 2', dataUrl: 'data:image/jpeg;base64,BBBB' },
    ]);
  });

  it('a tool without images has no images field; a group never has one', () => {
    expect(toolFromItem(searchItem('x'), ctx)).not.toHaveProperty('images');
    expect(toolFromItem(screenshotItem([]), ctx)).not.toHaveProperty('images');
    expect(
      toolFromItem(
        {
          kind: 'tool-group',
          id: 'g',
          seq: 0,
          label: 'Group',
          groupKind: 'unknown',
          status: 'done',
          children: [],
        } as unknown as ToolNode,
        ctx
      )
    ).not.toHaveProperty('images');
  });

  it('measures the strip from the count and the width, tiles fixed', () => {
    const vars = { rowH: 24, imageW: 240, imageH: 150, imageGap: 8 };
    expect(toolImageStripHeight(0, 1000, vars)).toBe(0);
    // One row of three at 1000px: gap + 150.
    expect(toolImageStripHeight(3, 1000, vars)).toBe(8 + 150);
    // 500px fits two per row: three images make two rows.
    expect(toolImageStripHeight(3, 500, vars)).toBe(8 + 2 * 150 + 8);
    // Narrower than one tile still gets one per row.
    expect(toolImageStripHeight(2, 100, vars)).toBe(8 + 2 * 150 + 8);
    // The unit's measure is the row plus the strip.
    const tool = toolFromItem(screenshotItem([{ mimeType: 'image/png', data: 'A' }]), ctx);
    expect(toolUnitDef.measure(tool, { width: 1000 } as never, vars)).toBe(24 + 8 + 150);
    expect(
      toolUnitDef.measure(toolFromItem(searchItem('x'), ctx), { width: 1000 } as never, vars)
    ).toBe(24);
  });
});
