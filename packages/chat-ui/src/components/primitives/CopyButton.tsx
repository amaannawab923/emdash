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
 * The icon variant's click is a native listener (`on:click`), not Solid's
 * delegated one: its host wraps it to stop the click reaching an ancestor
 * toggle (execute.def.tsx), which would otherwise also stop it reaching the
 * document, where delegated handlers live, and the copy would never run.
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

  if (props.variant === 'icon') {
    return (
      <button
        type="button"
        class={copyButtonIcon}
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

  if (props.variant === 'overlay') {
    return (
      <button
        type="button"
        class={copyButtonOverlay}
        aria-label={ariaLabel()}
        onClick={() => copy(props.text)}
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
      onClick={() => copy(props.text)}
    >
      <Show when={copied()} fallback={<IconCopy />}>
        <IconCheck />
      </Show>
      <span>{copied() ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
