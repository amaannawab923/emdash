import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '@styles/theme.css';

// ── Body ──────────────────────────────────────────────────────────────────────

/**
 * The terminal panel. Height and overflow-y are set inline (they depend on
 * the expanded state and the row count); rows are pre-wrapped so it never
 * scrolls horizontally.
 */
export const executeBody = style({
  position: 'relative',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  background: vars.termBg,
  scrollbarWidth: 'thin',
  scrollbarColor: `${vars.termFgPassive} transparent`,
});

globalStyle(`${executeBody}::-webkit-scrollbar`, {
  width: 'var(--execute-scrollbar-size)',
  height: 'var(--execute-scrollbar-size)',
});

// ── Rows ──────────────────────────────────────────────────────────────────────

export const executeLine = style({
  whiteSpace: 'pre',
  overflow: 'hidden',
  fontSize: vars.typeCodeFontSize,
  fontWeight: vars.typeCodeFontWeight,
  fontFamily: vars.typeCodeFontFamily,
  color: vars.termFg,
  // line-height is set via inline style from theme.fonts.code.lineHeight
  // so it cannot drift from the measured value via a CSS variable.
});

export const executeOutputLine = style({
  color: vars.termFgMuted,
});

export const executeSpacerLine = style({
  userSelect: 'none',
});

export const executeTruncatedLine = style({
  color: vars.termFgPassive,
  fontStyle: 'italic',
  userSelect: 'none',
});

/**
 * The collapsed panel's last row when more rows exist: "··· N more lines —
 * Show all". A real row with a click target, in place of a fade that used to
 * slice text mid-glyph.
 */
export const executeMoreLine = style({
  color: vars.termFgPassive,
  userSelect: 'none',
  cursor: 'pointer',
  selectors: {
    '&:hover': { color: vars.termFg },
  },
});

export const executeMoreAction = style({
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
});

// The panel is dark in both themes, so bash highlighting always uses the
// dark-theme token colors.
globalStyle(`${executeLine} span`, {
  color: 'var(--shiki-dark)',
});

// ── Header ────────────────────────────────────────────────────────────────────

/** Wraps the copy button so its click does not toggle the card. */
export const executeCopy = style({
  display: 'inline-flex',
  alignItems: 'center',
});

/** The hoisted `cd` folder — "in run-x/app" — beside the copy button, muted, one line. */
export const executeCwd = style({
  display: 'inline-block',
  maxWidth: '40%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  color: vars.fgMuted,
  marginRight: 6,
});
