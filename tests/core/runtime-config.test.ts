import { describe, expect, it } from 'vitest'
import * as contracts from '@career/contracts'
import * as infrastructure from '@career/infrastructure'

const catalog = {
  version: '1',
  activeProviderId: 'local-demo',
  providers: [
    {
      id: 'local-demo',
      name: '本地确定性演示',
      enabled: true,
      protocol: 'deterministic',
    },
    {
      id: 'responses-gateway',
      name: 'Responses 网关',
      enabled: true,
      protocol: 'responses',
      baseUrl: 'https://gateway.example/v1',
      model: 'career-model',
      apiKeyEnv: 'TEST_RESPONSES_KEY',
      timeoutMs: 15000,
    },
  ],
}

describe('runtime provider catalog', () => {
  it('selects the keyless deterministic provider by default', () => {
    const schema = (contracts as Record<string, unknown>).RuntimeProvidersConfigSchema as {
      parse(value: unknown): unknown
    }
    expect(schema, 'RuntimeProvidersConfigSchema must be exported').toBeDefined()
    const create = (infrastructure as Record<string, unknown>).createConfiguredRuntime as
      (config: unknown, options?: unknown) => {
        runtime: { analyzeJob(input: unknown): Promise<unknown> }
        view: { activeProviderId: string; providers: unknown[] }
      }
    expect(create, 'createConfiguredRuntime must be exported').toBeTypeOf('function')

    const result = create(schema.parse(catalog), { env: {} })
    expect(result.view.activeProviderId).toBe('local-demo')
    expect(result.view.providers).toHaveLength(2)
  })

  it('selects a remote protocol through an environment override and resolves its secret', async () => {
    const schema = (contracts as Record<string, unknown>).RuntimeProvidersConfigSchema as {
      parse(value: unknown): unknown
    }
    const create = (infrastructure as Record<string, unknown>).createConfiguredRuntime as
      (config: unknown, options?: unknown) => {
        runtime: { analyzeJob(input: unknown): Promise<unknown> }
        view: { activeProviderId: string }
      }
    let authorization = ''
    const fetchImpl = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      authorization = new Headers(init?.headers).get('authorization') ?? ''
      return new Response(JSON.stringify({
        output_text: '{"recommendation":"apply","summary":"岗位匹配。","gaps":[],"evidenceStrength":"high"}',
      }))
    }
    const result = create(schema.parse(catalog), {
      env: {
        CAREER_RUNTIME_PROVIDER: 'responses-gateway',
        TEST_RESPONSES_KEY: 'resolved-secret',
      },
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(result.view.activeProviderId).toBe('responses-gateway')
    await result.runtime.analyzeJob({
      title: 'AI 产品实习生',
      company: '星河科技',
      location: '杭州',
      description: '岗位描述'.repeat(40),
    })
    expect(authorization).toBe('Bearer resolved-secret')
  })

  it('rejects an enabled remote provider when its environment secret is missing', () => {
    const schema = (contracts as Record<string, unknown>).RuntimeProvidersConfigSchema as {
      parse(value: unknown): unknown
    }
    const create = (infrastructure as Record<string, unknown>).createConfiguredRuntime as
      (config: unknown, options?: unknown) => unknown

    expect(() => create(schema.parse(catalog), {
      env: { CAREER_RUNTIME_PROVIDER: 'responses-gateway' },
    })).toThrow('requires environment variable TEST_RESPONSES_KEY')
  })

  it('returns a redacted provider view', () => {
    const schema = (contracts as Record<string, unknown>).RuntimeProvidersConfigSchema as {
      parse(value: unknown): unknown
    }
    const create = (infrastructure as Record<string, unknown>).createConfiguredRuntime as
      (config: unknown, options?: unknown) => { view: unknown }
    const result = create(schema.parse(catalog), {
      env: {
        CAREER_RUNTIME_PROVIDER: 'responses-gateway',
        TEST_RESPONSES_KEY: 'must-not-leak',
      },
      fetchImpl: async () => new Response('{}'),
    })

    const serialized = JSON.stringify(result.view)
    expect(serialized).not.toContain('must-not-leak')
    expect(serialized).not.toContain('TEST_RESPONSES_KEY')
    expect(serialized).not.toContain('apiKey')
  })
})
