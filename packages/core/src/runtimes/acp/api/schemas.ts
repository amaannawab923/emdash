import { z } from 'zod';
import { attachmentRefSchema } from '#runtimes/acp/api/models/attachments';
import { permissionDecisionSchema } from '#runtimes/acp/api/models/permissions';
import {
  promptDraftUpdateSchema,
  promptInputSchema,
  queuedPromptSchema,
} from '#runtimes/acp/api/models/prompt';
import { transcriptTurnSchema } from '#runtimes/acp/api/models/turns';

/**
 * An MCP server a caller attaches to ONE session, instead of to the
 * provider's own global config.
 *
 * Why this exists: without it, the only servers a session can see are the
 * ones read out of the provider's config file (`~/.claude.json` for
 * claude). A host that wants to give a single dispatched session an extra
 * tool therefore has to write that tool into the user's GLOBAL config —
 * where every other session on the machine, including ones the host never
 * started, inherits it and spawns it. Servers passed here reach
 * `session/new` / `session/load` for this session and nothing else; no
 * file on disk is touched.
 *
 * The shape is `McpServerRegistration` minus the fields only the config
 * file cares about, so it feeds `registrationsToAcpMcpServers` unchanged.
 */
export const sessionScopedMcpServerSchema = z.object({
  name: z.string().min(1),
  transport: z.enum(['stdio', 'http']).optional(),
  type: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});
export type SessionScopedMcpServer = z.infer<typeof sessionScopedMcpServerSchema>;

export const acpStartInputSchema = z.object({
  conversationId: z.string(),
  providerId: z.string(),
  cwd: z.string(),
  sessionId: z.string().nullable(),
  model: z.string().nullable(),
  modeId: z.string().nullable().optional(),
  initialQueue: z.array(promptInputSchema).optional(),
  env: z.record(z.string(), z.string()).optional(),
  /**
   * Extra servers for THIS session only (see sessionScopedMcpServerSchema).
   * Merged over what the provider's own config lists: a session server
   * whose name matches a configured one replaces it, so a caller passing
   * its own definition is never shadowed by a stale global entry.
   *
   * Unlike `env`, this does not belong in the connection key: `env` is
   * baked into a pooled process once at spawn, while mcpServers is
   * re-sent on every `session/new` / `session/load` over an already
   * pooled connection, so two sessions on one connection can carry
   * different servers.
   */
  mcpServers: z.array(sessionScopedMcpServerSchema).optional(),
});
export type AcpStartInputWire = z.infer<typeof acpStartInputSchema>;

export const acpResumeInputSchema = acpStartInputSchema.extend({ sessionId: z.string() });

export const sendPromptResponseSchema = z.object({ queued: z.boolean() });

export const killCommandSchema = z.object({ conversationId: z.string() });
export const promptPlacementSchema = z.enum(['auto', 'queue']);
export type PromptPlacement = z.infer<typeof promptPlacementSchema>;
export const sendPromptCommandSchema = z.object({
  conversationId: z.string(),
  prompt: promptInputSchema,
  /** 'queue' always queues; 'auto' (default) delivers if idle and queues while a turn is active. */
  placement: promptPlacementSchema.optional(),
});
export const editQueuedPromptCommandSchema = z.object({
  conversationId: z.string(),
  id: z.string(),
  input: promptInputSchema,
});
export const deleteQueuedPromptCommandSchema = z.object({
  conversationId: z.string(),
  id: z.string(),
});
export const changeQueuePromptOrderCommandSchema = z.object({
  conversationId: z.string(),
  ids: z.array(z.string()),
});
export const cancelTurnCommandSchema = z.object({ conversationId: z.string() });
export const setModelOptionCommandSchema = z.object({
  conversationId: z.string(),
  dimension: z.enum(['model', 'effort']),
  value: z.string(),
});
export const setModeOptionCommandSchema = z.object({
  conversationId: z.string(),
  value: z.string(),
});
export const resolvePermissionCommandSchema = permissionDecisionSchema.extend({
  conversationId: z.string(),
});
export const setPromptDraftCommandSchema = z.object({
  conversationId: z.string(),
  draft: promptDraftUpdateSchema,
});
export const exportAcpTranscriptCommandSchema = z.object({ conversationId: z.string() });
export const exportRawAcpLogCommandSchema = exportAcpTranscriptCommandSchema;

export const uploadAttachmentCommandSchema = z.object({
  /** Attachments belong to their conversation (spec §3.6); a conversation exists at upload time. */
  conversationId: z.string(),
  originalPath: z.string().optional(),
});
export const uploadAttachmentResponseSchema = attachmentRefSchema;
export const attachmentKeySchema = z.object({
  conversationId: z.string(),
  attachmentId: z.string(),
});
export const downloadAttachmentCommandSchema = attachmentKeySchema;
export const deleteAttachmentCommandSchema = attachmentKeySchema;
export const deleteAttachmentsCommandSchema = z.object({
  conversationId: z.string(),
});

export const historyPageInputSchema = z.object({
  conversationId: z.string(),
  before: z.number().int().optional(),
  limit: z.number().int(),
});

export const historyPageSchema = z.object({
  turns: z.array(transcriptTurnSchema),
  nextCursor: z.number().int().nullable(),
});
export type HistoryPage = z.infer<typeof historyPageSchema>;

export const resumeResultSchema = historyPageSchema.extend({
  sessionId: z.string(),
});
export type ResumeResult = z.infer<typeof resumeResultSchema>;

export { queuedPromptSchema };
