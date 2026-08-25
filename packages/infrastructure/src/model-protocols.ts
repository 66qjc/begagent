export interface ModelPrompt {
  system: string
  prompt: string
}

export interface ModelProtocol {
  readonly protocol: 'chat-completions' | 'responses' | 'anthropic-messages'
  generateText(input: ModelPrompt): Promise<string>
}

interface ProtocolOptions {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

abstract class HttpModelProtocol implements ModelProtocol {
  abstract readonly protocol: ModelProtocol['protocol']
  protected readonly baseUrl: string
  protected readonly apiKey: string
  protected readonly model: string
  protected readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: ProtocolOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.model = options.model
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  abstract generateText(input: ModelPrompt): Promise<string>

  protected async post(url: string, headers: HeadersInit, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`${this.protocol} provider request failed with HTTP ${response.status}.`)
    }
    try {
      return await response.json()
    } catch {
      throw new Error(`${this.protocol} provider returned invalid JSON.`)
    }
  }
}

/** OpenAI-compatible POST /chat/completions transport. */
export class OpenAiChatProtocol extends HttpModelProtocol {
  readonly protocol = 'chat-completions' as const

  async generateText(input: ModelPrompt): Promise<string> {
    const value = await this.post(
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.prompt },
        ],
        response_format: { type: 'json_object' },
      },
    )
    const content = asRecord(asArray(asRecord(value)['choices'])[0])['message']
    const text = asRecord(content)['content']
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('chat-completions provider returned no text content.')
    }
    return text
  }
}

/** OpenAI-compatible POST /responses transport. */
export class OpenAiResponsesProtocol extends HttpModelProtocol {
  readonly protocol = 'responses' as const

  async generateText(input: ModelPrompt): Promise<string> {
    const value = await this.post(
      `${this.baseUrl}/responses`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        instructions: input.system,
        input: input.prompt,
        text: { format: { type: 'json_object' } },
      },
    )
    const record = asRecord(value)
    if (typeof record['output_text'] === 'string' && record['output_text'].trim()) {
      return record['output_text']
    }
    const text = asArray(record['output'])
      .flatMap((item) => asArray(asRecord(item)['content']))
      .filter((part) => asRecord(part)['type'] === 'output_text')
      .map((part) => asRecord(part)['text'])
      .find((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    if (!text) throw new Error('responses provider returned no output_text content.')
    return text
  }
}

/** Anthropic-compatible POST /v1/messages transport. */
export class AnthropicMessagesProtocol extends HttpModelProtocol {
  readonly protocol = 'anthropic-messages' as const

  async generateText(input: ModelPrompt): Promise<string> {
    const value = await this.post(
      `${this.baseUrl}/v1/messages`,
      {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.model,
        max_tokens: 1_500,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      },
    )
    const text = asArray(asRecord(value)['content'])
      .filter((part) => asRecord(part)['type'] === 'text')
      .map((part) => asRecord(part)['text'])
      .filter((part): part is string => typeof part === 'string')
      .join('')
    if (!text.trim()) throw new Error('anthropic-messages provider returned no text content.')
    return text
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
