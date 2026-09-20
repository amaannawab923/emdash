/**
 * CopyButton — shared copy-to-clipboard button.
 *
 * Three variants:
 *   'inline'  — used in the message footer: text label + icon, appears on group-hover.
 *   'overlay' — used in code blocks: icon-only, absolute positioned top-right.
 *   'icon'    — used in card headers: icon-only, in flow, always visible.
 *
 * State is managed by createClipboard (Lane B — never touches measure).
 *
 * The click is a native listener (`on:click`), not Solid's delegated one: a
 * host that wraps the button to stop the click reaching an ancestor toggle
 * (execute.def.tsx) would otherwise also stop it reaching the document, where
 * delegated handlers live, and the copy would never run.
 */

import { Show } from 'solid-js';
import { IconCheck, IconCopy } from './icons';
import { createClipboard } from './use-clipboard';
import { copyButtonIcon, copyButtonInline, copyButtonOverlay } from './copy-button.css';

export type CopyButtonProps = {
  text: string;
  variant: 'inline' | 'overlay' | 'icon';
  /** aria-label prefix shown before 'Copy' / 'Copied'. Defaults to 'Copy'. */
  label?: string;
};

export function CopyButton(props: CopyButtonProps) {
  const { copied, copy } = createClipboard();
  const label = () => props.label ?? 'Copy';
  const ariaLabel = () => (copied() ? `${label()} — copied` : label());

  if (props.variant === 'overlay' || props.variant === 'icon') {
    return (
      <button
        type="button"
        class={props.variant === 'overlay' ? copyButtonOverlay : copyButtonIcon}
        title={label()}
        aria-label={ariaLabel()}
        on:click={() => copy(props.text)}
      >
        <Show when={copied()} fallback={<IconCopy />}>
          <IconCheck />
        </Show>
      </button>
    );
  }

  return (
    <button
      type="button"
      class={copyButtonInline}
      aria-label={ariaLabel()}
      on:click={() => copy(props.text)}
    >
      <Show when={copied()} fallback={<IconCopy />}>
        <IconCheck />
      </Show>
      <span>{copied() ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
