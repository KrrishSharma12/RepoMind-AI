/** Types shared by the chat API and the chat UI. */

export interface SourceRef {
  path: string;
  startLine: number;
  endLine: number;
  /** True if the answer actually refers to this file. */
  cited: boolean;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: SourceRef[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** One event in the streamed answer. */
export type StreamEvent =
  | { type: "meta"; conversationId: string; sources: SourceRef[] }
  | { type: "delta"; text: string }
  | { type: "done"; sources: SourceRef[] }
  | { type: "error"; message: string };