import { describe, expect, it } from 'vitest'
import * as infrastructure from '@career/infrastructure'

type CapturedRequest = { url: string; init: RequestInit }

function capture(responseBody: unknown, status = 200): {
  requests: CapturedRequest[]
  fetch: typeof fetch
} {
  const requests: CapturedRequest[] = []
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { requests, fetch: fetchImpl as typeof fetch }
}

function constructor(name: string): new (options: Record<string, unknown>) => {
  generateText(input: { system: string; prompt: string }): Promise<string>
} {
  const value = (infrastructure as Record<string, unknown>)[name]
  expect(value, `${name} must be exported`).toBeTypeOf('function')
  return value as ReturnType<typeof constructor>
}

describe('multi-protocol model transports', () => {
  it('uses the OpenAI chat-completions protocol', async () => {
    const captured = capture({ choices: [{ message: { content: '{"ok":true}' } }] })
    const Protocol = constructor('OpenAiChatProtocol')
    const protocol = new Protocol({
      baseUrl: 'https://gateway.example/v1',
      apiKey: 'openai-secret',
      model: 'third-party-chat',
      fetchImpl: captured.fetch,
    })

    await expect(protocol.generateText({ system: 'system', prompt: 'prompt' })).resolves.toBe('{"ok":true}')
    expect(captured.requests[0]?.url).toBe('https://gateway.example/v1/chat/completions')
    expect(new Headers(captured.requests[0]?.init.headers).get('authorization')).toBe('Bearer openai-secret')
    expect(JSON.parse(String(captured.requests[0]?.init.body))).toMatchObject({
      model: 'third-party-chat',
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'prompt' }],
    })
  })

  it('uses the Anthropic Messages protocol', async () => {
    const captured = capture({ content: [{ type: 'text', text: '{"ok":true}' }] })
    const Protocol = constructor('AnthropicMessagesProtocol')
    const protocol = new Protocol({
      baseUrl: 'https://claude.example',
      apiKey: 'anthropic-secret',
      model: 'claude-model',
      fetchImpl: captured.fetch,
    })

    await expect(protocol.generateText({ system: 'system', prompt: 'prompt' })).resolves.toBe('{"ok":true}')
    expect(captured.requests[0]?.url).toBe('https://claude.example/v1/messages')
    const headers = new Headers(captured.requests[0]?.init.headers)
    expect(headers.get('x-api-key')).toBe('anthropic-secret')
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
    expect(JSON.parse(String(captured.requests[0]?.init.body))).toMatchObject({
      model: 'claude-model',
      system: 'system',
      messages: [{ role: 'user', content: 'prompt' }],
    })
  })

  it('uses the OpenAI Responses protocol', async () => {
    const captured = capture({ output_text: '{"ok":true}', output: [] })
    const Protocol = constructor('OpenAiResponsesProtocol')
    const protocol = new Protocol({
      baseUrl: 'https://responses.example/v1',
      apiKey: 'responses-secret',
      model: 'responses-model',
      fetchImpl: captured.fetch,
    })

    await expect(protocol.generateText({ system: 'system', prompt: 'prompt' })).resolves.toBe('{"ok":true}')
    expect(captured.requests[0]?.url).toBe('https://responses.example/v1/responses')
    expect(new Headers(captured.requests[0]?.init.headers).get('authorization')).toBe('Bearer responses-secret')
    expect(JSON.parse(String(captured.requests[0]?.init.body))).toMatchObject({
      model: 'responses-model',
      instructions: 'system',
      input: 'prompt',
    })
  })

  it('reports protocol HTTP failures without leaking response bodies', async () => {
    const captured = capture({ error: { message: 'secret upstream detail' } }, 401)
    const Protocol = constructor('OpenAiChatProtocol')
    const protocol = new Protocol({
      baseUrl: 'https://gateway.example/v1',
      apiKey: 'secret',
      model: 'model',
      fetchImpl: captured.fetch,
    })

    await expect(protocol.generateText({ system: 'system', prompt: 'prompt' }))
      .rejects.toThrow('chat-completions provider request failed with HTTP 401')
  })
})

describe('configured career runtime', () => {
  it('normalizes protocol text into a validated career artifact', async () => {
    const Runtime = constructor('ConfiguredCareerRuntime') as unknown as new (options: {
      protocol: { generateText(input: { system: string; prompt: string }): Promise<string> }
    }) => {
      analyzeJob(input: Record<string, string>): Promise<unknown>
    }
    const runtime = new Runtime({
      protocol: {
        async generateText() {
          return '\u0060\u0060\u0060json\n{"recommendation":"growth_application","summary":"建议补齐真实证据后投递。","gaps":["缺少作品证据"],"evidenceStrength":"medium"}\n\u0060\u0060\u0060'
        },
      },
    })

    await expect(runtime.analyzeJob({
      title: 'AI 产品实习生',
      company: '星河科技',
      location: '杭州',
      description: '岗位描述'.repeat(40),
    })).resolves.toMatchObject({
      recommendation: 'growth_application',
      gaps: ['缺少作品证据'],
    })
  })

  it('rejects provider output that violates the career artifact contract', async () => {
    const Runtime = constructor('ConfiguredCareerRuntime') as unknown as new (options: {
      protocol: { generateText(input: { system: string; prompt: string }): Promise<string> }
    }) => {
      analyzeJob(input: Record<string, string>): Promise<unknown>
    }
    const runtime = new Runtime({
      protocol: {
        async generateText() {
          return '{"summary":"缺少必要字段"}'
        },
      },
    })

    await expect(runtime.analyzeJob({
      title: 'AI 产品实习生',
      company: '星河科技',
      location: '杭州',
      description: '岗位描述'.repeat(40),
    })).rejects.toThrow('job analysis output failed validation')
  })
})
