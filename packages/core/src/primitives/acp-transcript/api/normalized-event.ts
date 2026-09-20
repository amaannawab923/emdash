import type {
  AvailableCommand,
  SessionConfigOption,
  SessionUpdate,
} from '@agentclientprotocol/sdk';

export type AttachmentRef = {
  id: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
};

export type SessionUsage = {
  contextSize: number;
  contextUsed: number;
  cost: { amount: number; currency: string } | null;
};

export type PlanEntryInput = {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
};

export type NormalizedDiff = {
  path: string;
  oldText: string | null;
  newText: string;
};

export type NormalizedToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * An image a tool returned as content — an ACP `image` block (base64
 * data + mime type), e.g. a browser tool's screenshot. Carried on the
 * tool item so the transcript shows what the tool saw.
 */
export type NormalizedImage = {
  mimeType: string;
  /** Base64, no data-URL prefix. */
  data: string;
};

export type NormalizedEvent =
  | {
      kind: 'message';
      role: 'user' | 'assistant';
      messageId: string | null;
      text: string;
      attachments?: AttachmentRef[];
    }
  | {
      kind: 'thinking';
      messageId: string | null;
      text: string;
    }
  | {
      kind: 'tool_call';
      toolCallId: string;
      title: string;
      toolKind: string | null;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
      diffs: NormalizedDiff[];
      inputSummary?: string;
      outputText?: string;
      terminalId?: string;
      images?: NormalizedImage[];
    }
  | {
      kind: 'subagent';
      toolCallId: string;
      title: string;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
      inputSummary?: string;
      background?: boolean;
      agentId?: string;
      outputFile?: string;
    }
  | {
      kind: 'subagent_update';
      toolCallId?: string;
      agentId?: string;
      status: NormalizedToolStatus;
      summary?: string;
      outputFile?: string;
    }
  | {
      kind: 'search';
      toolCallId: string;
      query: string;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
      matchCount?: number;
    }
  | {
      kind: 'mcp_tool';
      toolCallId: string;
      server?: string;
      tool: string;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
      inputSummary?: string;
    }
  | {
      kind: 'web_fetch';
      toolCallId: string;
      url: string;
      title?: string;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
    }
  | {
      kind: 'tool_update';
      toolCallId: string;
      title: string | null;
      toolKind: string | null;
      status: NormalizedToolStatus | null;
      parentToolCallId: string | null;
      diffs: NormalizedDiff[];
      outputText?: string;
      terminalId?: string;
      images?: NormalizedImage[];
    }
  | {
      kind: 'plan';
      entries: PlanEntryInput[];
    }
  | {
      kind: 'config';
      options: ReadonlyArray<SessionConfigOption>;
    }
  | {
      kind: 'mode_selected';
      modeId: string;
    }
  | {
      kind: 'commands';
      commands: ReadonlyArray<AvailableCommand>;
    }
  | {
      kind: 'usage';
      usage: SessionUsage;
    }
  | {
      kind: 'title';
      title: string;
    }
  | { kind: 'ignored' };

export type EnrichHook = (event: NormalizedEvent, raw: SessionUpdate) => NormalizedEvent;
