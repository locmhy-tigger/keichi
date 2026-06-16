// Streaming LLM wrapper for the agent module.
// Claude-only for keichi (kcagentos also supported ollama/lmstudio — omitted here).

import Anthropic from "@anthropic-ai/sdk"

export type Engine = "claude"

export interface LLMMessage {
  role:    "user" | "assistant"
  content: string
}

export interface LLMOptions {
  system?:    string
  model?:     string
  maxTokens?: number
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function* streamLLM(
  _engine: Engine,
  messages: LLMMessage[],
  opts: LLMOptions = {},
): AsyncGenerator<string> {
  const stream = await anthropic.messages.stream({
    model:      opts.model     ?? "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? 4096,
    system:     opts.system    ?? "",
    messages,
  })
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text
    }
  }
}

export async function completeLLM(
  engine: Engine,
  messages: LLMMessage[],
  opts: LLMOptions = {},
): Promise<string> {
  let result = ""
  for await (const chunk of streamLLM(engine, messages, opts)) {
    result += chunk
  }
  return result
}
