/**
 * Tool — minimal single-row renderer for generic ChatToolCall items.
 *
 * Used as the desktop fallback for ACP tool kinds without a dedicated renderer
 * (search, fetch, think, other). Consistent with the file-op / execute style:
 * a plain text row with no status badge, no collapse, no detail view.
 *
 * Shimmer applied while status === 'running'. No error-specific chrome.
 *
 * Outer geometry (height, padding) is applied by tool.def.ts Render.
 * This component only describes inner content.
 */

import { useCommands } from '@components/contexts/CommandsContext';
import { IconError, IconShieldAlert } from '@components/primitives/icons';
import { For, Show } from 'solid-js';
import type { ChatImageAttachment, ChatToolCall } from '@/model';
import {
  textShimmer,
  toolErrorIcon,
  toolImage,
  toolImageBtn,
  toolImageStrip,
  toolName,
  toolPermissionIcon,
  toolRow,
  toolSummary,
} from './tool.css';

export type ToolProps = {
  item: ChatToolCall;
};

/** One image the tool returned: a fixed tile; click hands it to the host's viewer. */
function ToolImageTile(props: { image: ChatImageAttachment; itemId: string }) {
  const commands = useCommands();
  return (
    <button
      type="button"
      class={toolImageBtn}
      aria-label={`View image: ${props.image.name}`}
      // `on:click`, not `onClick`: a delegated handler makes Solid touch
      // `window` when this module loads, and tool.def.test.ts runs in node.
      on:click={(e) => {
        e.stopPropagation();
        commands().onViewImage?.({
          attachment: props.image,
          itemId: props.itemId,
          source: 'tool',
        });
      }}
    >
      <img src={props.image.dataUrl} alt={props.image.name} class={toolImage} />
    </button>
  );
}

export function Tool(props: ToolProps) {
  const isRunning = () => props.item.status === 'running' && !props.item.awaitingPermission;
  return (
    <>
      <div class={toolRow} classList={{ [textShimmer]: isRunning() }}>
        <span class={toolName}>{props.item.name}</span>
        <Show when={props.item.inputSummary}>
          <span class={toolSummary}>{props.item.inputSummary}</span>
        </Show>
        <Show
          when={props.item.awaitingPermission}
          fallback={
            <Show when={props.item.status === 'error'}>
              <span class={toolErrorIcon} title={props.item.error ?? 'Failed'} aria-label="error">
                <IconError />
              </span>
            </Show>
          }
        >
          <span
            class={toolPermissionIcon}
            title="Awaiting permission"
            aria-label="awaiting permission"
          >
            <IconShieldAlert />
          </span>
        </Show>
      </div>
      <Show when={props.item.images?.length}>
        <div class={toolImageStrip} data-tool-images>
          <For each={props.item.images}>
            {(image) => <ToolImageTile image={image} itemId={props.item.id} />}
          </For>
        </div>
      </Show>
    </>
  );
}
