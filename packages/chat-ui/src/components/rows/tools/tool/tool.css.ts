import { style } from '@vanilla-extract/css';
import { textShimmer } from '@styles/effects.css';
import { sx } from '@styles/sprinkles.css';
import { vars } from '@styles/theme.css';
import { createVariableThemeContract } from '@styles/variable-theme-contract.css';

// ── Runtime geometry contract ─────────────────────────────────────────────────

export type ToolStyleVars = {
  rowH: number;
  /** The unit's full height: the row, plus the image strip when there is one. */
  totalH: number;
  imageW: number;
  imageH: number;
  imageGap: number;
};

export const toolVars = createVariableThemeContract<ToolStyleVars>({
  rowH: null,
  totalH: null,
  imageW: null,
  imageH: null,
  imageGap: null,
});

export const toolRoot = style([
  sx({ display: 'flex', flexDirection: 'column', borderColor: 'border' }),
  // overflow:hidden ensures content never escapes the reserved height.
  { height: toolVars.totalH, overflow: 'hidden' },
]);

export const toolRow = style([
  sx({ display: 'flex', alignItems: 'center', gap: '1.5', color: 'fgPassive', userSelect: 'none' }),
  // min-width:0 lets flex children shrink below their intrinsic width so
  // text-overflow ellipsis can take effect on the name and summary spans.
  { minWidth: 0, height: toolVars.rowH, flexShrink: 0 },
]);

// ── Images the tool returned (a screenshot, a chart) ─────────────────────────
// Fixed tiles, so the strip's height is a pure function of the count and the
// width (tool.def.ts measures it the same way); `contain` rather than `cover`
// because a screenshot's edges are where the evidence usually is.

export const toolImageStrip = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: toolVars.imageGap,
  paddingTop: toolVars.imageGap,
});

export const toolImageBtn = style({
  display: 'block',
  padding: 0,
  margin: 0,
  border: 'none',
  background: vars.bg2,
  cursor: 'pointer',
  borderRadius: vars.radiusMd,
  lineHeight: 0,
  width: toolVars.imageW,
  height: toolVars.imageH,
  boxShadow: `0 0 0 1px ${vars.border}`,
  overflow: 'hidden',
  selectors: {
    '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: 1 },
  },
});

export const toolImage = style({
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'top left',
});

export const toolName = style({
  fontSize: vars.typeBodyFontSize,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 1,
  minWidth: 0,
});

export const toolSummary = style([
  {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: 0.75,
  },
  toolName,
]);

export const toolStatusIcon = style({
  marginLeft: 'auto',
  display: 'inline-flex',
  flexShrink: 0,
});

export const toolPermissionIcon = style([
  toolStatusIcon,
  {
    color: '#eab308',
  },
]);

export const toolErrorIcon = style([
  toolStatusIcon,
  {
    color: vars.fgError,
  },
]);

export { textShimmer };
