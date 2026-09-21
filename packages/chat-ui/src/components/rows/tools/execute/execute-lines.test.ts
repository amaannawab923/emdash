import { describe, expect, it, vi } from 'vitest';
import type { ChatExecute } from '@/model';
import { executeLines, wrapExecuteLines } from './execute-lines';

function item(overrides: Partial<ChatExecute> = {}): ChatExecute {
  return {
    kind: 'execute',
    id: 'x',
    command: 'echo ok',
    status: 'done',
    startedAt: 0,
    ...overrides,
  };
}

describe('executeLines', () => {
  it('prefixes command lines and appends output after a spacer', () => {
    const lines = executeLines(item({ command: 'a\nb', outputLines: ['out1', 'out2'] }));
    expect(lines).toEqual([
      { kind: 'command', text: '$ a' },
      { kind: 'command', text: '  b' },
      { kind: 'spacer', text: '' },
      { kind: 'output', text: 'out1' },
      { kind: 'output', text: 'out2' },
    ]);
  });

  it('shows a single truncation indicator line before the output when flagged', () => {
    const lines = executeLines(item({ outputLines: ['tail'], outputTruncated: true }));
    expect(lines.map((line) => line.kind)).toEqual(['command', 'spacer', 'truncated', 'output']);
  });

  it('returns identical display objects for unchanged lines across live updates', () => {
    const live: string[] = ['one', 'two'];
    const first = executeLines(item({ outputLines: live, outputVersion: 1 }));
    live.push('three');
    const second = executeLines(item({ outputLines: live, outputVersion: 2 }));
    // Command, spacer, and pre-existing output rows keep identity; only the new row is fresh.
    expect(second.slice(0, first.length)).toEqual(first);
    for (let i = 0; i < first.length; i += 1) {
      expect(second[i]).toBe(first[i]);
    }
    expect(second).toHaveLength(first.length + 1);
  });
});

describe('wrapExecuteLines', () => {
  const ascii = () => true;

  it('keeps short lines whole and cuts long ones at maxChars, remembering the offset', () => {
    const lines = executeLines(item({ command: 'abcdefghij', outputLines: ['xy'] }));
    const rows = wrapExecuteLines(lines, 5, ascii);
    expect(rows.map((r) => [r.kind, r.text, r.start])).toEqual([
      ['command', '$ abc', 0],
      ['command', 'defgh', 5],
      ['command', 'ij', 10],
      ['spacer', '', 0],
      ['output', 'xy', 0],
    ]);
    expect(rows[1]!.line).toBe(lines[0]);
  });

  it('shortens a non-ASCII row until it fits instead of trusting the character count', () => {
    // Pretend every glyph here is two advances wide: a row "fits" at 3 chars.
    const fits = (text: string) => text.length <= 3;
    const lines = executeLines(item({ command: '漢字漢字漢字漢' }));
    const rows = wrapExecuteLines(lines, 6, fits);
    expect(rows.map((r) => r.text)).toEqual(['$ 漢', '字漢字', '漢字漢']);
  });

  it('expands tabs so rows count what the panel will draw', () => {
    const lines = executeLines(item({ command: 'a\tb' }));
    expect(lines[0]!.text).toBe('$ a    b');
  });

  it('never splits a surrogate pair', () => {
    const lines = executeLines(item({ command: 'ab😀cd' }));
    const rows = wrapExecuteLines(lines, 4, () => true);
    expect(rows.map((r) => r.text)).toEqual(['$ ab', '😀cd']);
    expect(rows[1]!.start).toBe(4);
  });

  it('reuses row objects for unchanged lines across live updates and widths', () => {
    const live: string[] = ['one', 'two'];
    const first = wrapExecuteLines(
      executeLines(item({ outputLines: live, outputVersion: 1 })),
      40,
      ascii
    );
    live.push('three');
    const second = wrapExecuteLines(
      executeLines(item({ outputLines: live, outputVersion: 2 })),
      40,
      ascii
    );
    expect(second).toHaveLength(first.length + 1);
    for (let i = 0; i < first.length; i += 1) expect(second[i]).toBe(first[i]);
    // Same input, same width: the very same array.
    expect(
      wrapExecuteLines(executeLines(item({ outputLines: live, outputVersion: 2 })), 40, ascii)
    ).toBe(second);
    // A new width re-wraps.
    expect(
      wrapExecuteLines(executeLines(item({ outputLines: live, outputVersion: 2 })), 2, ascii)
    ).not.toBe(second);
  });

  it('keeps rows per width, so alternating two caps (the expanded panel with and without its scrollbar) hits both caches', () => {
    const lines = executeLines(item({ command: 'abcdefghij' }));
    const wide = wrapExecuteLines(lines, 20, ascii);
    const narrow = wrapExecuteLines(lines, 5, ascii);
    expect(wrapExecuteLines(lines, 20, ascii)).toBe(wide);
    expect(wrapExecuteLines(lines, 5, ascii)).toBe(narrow);
  });

  it('re-cuts once the measurement epoch changes (a font finished loading)', () => {
    const lines = executeLines(item({ command: '漢字漢字' }));
    const fallback = vi.fn(() => true);
    const before = wrapExecuteLines(lines, 10, fallback, 1);
    expect(fallback).toHaveBeenCalled();
    const real = vi.fn((text: string) => text.length <= 3);
    const after = wrapExecuteLines(lines, 10, real, 2);
    expect(real).toHaveBeenCalled();
    expect(after).not.toBe(before);
    expect(after.map((r) => r.text)).toEqual(['$ 漢', '字漢字']);
    // The old epoch's rows are still there for a reader of that epoch.
    expect(wrapExecuteLines(lines, 10, fallback, 1)).toBe(before);
  });
});
