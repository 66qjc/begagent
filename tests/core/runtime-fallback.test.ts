import { describe, expect, it } from 'vitest'
import * as infrastructure from '@career/infrastructure'
import type { RuntimeProvidersConfig } from '@career/contracts'

const { createConfiguredRuntime } = infrastructure as Record<string, unknown>
const runtime = createConfiguredRuntime as (config: RuntimeProvidersConfig, options?: { env?: Record<string, string | undefined> }) => {
  runtime: unknown
  view: { activeProtocol: string; degraded: boolean; providers: { id: string; configured: boolean }[] }
}
const loadConfig = infrastructure.loadRuntimeProvidersConfig as (path: string) => RuntimeProvidersConfig

function baseConfig(overrides: Partial<RuntimeProvidersConfig> = {}): RuntimeProvidersConfig {
  return {
    version: '1',
    activeProviderId: 'local-demo',
    providers: [
      { id: 'local-demo', name: '本地确定性演示', enabled: true, protocol: 'deterministic' },
      {
        id: 'remote-chat',
        name: '远程 Chat',
        enabled: true,
        protocol: 'chat-completions',
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
        apiKeyEnv: 'CAREER_TEST_API_KEY',
        timeoutMs: 30000,
      },
    ],
    ...overrides,
  }
}

describe('runtime graceful degradation', () => {
  it('uses deterministic runtime when the active provider is deterministic', () => {
    const { view } = runtime(baseConfig(), {})
    expect(view.activeProtocol).toBe('deterministic')
    expect(view.degraded).toBe(false)
  })

  it('falls back to deterministic when a remote provider key is missing', () => {
    const config = baseConfig({ activeProviderId: 'remote-chat' })
    const { view } = runtime(config, { env: {} })
    expect(view.activeProtocol).toBe('deterministic')
    expect(view.degraded).toBe(true)
    // The provider should show as not configured
    const remote = view.providers.find((p) => p.id === 'remote-chat')
    expect(remote?.configured).toBe(false)
  })

  it('does not degrade when the remote provider key is present', () => {
    const config = baseConfig({ activeProviderId: 'remote-chat' })
    const { view } = runtime(config, { env: { CAREER_TEST_API_KEY: 'secret-key' } })
    expect(view.activeProtocol).toBe('chat-completions')
    expect(view.degraded).toBe(false)
    const remote = view.providers.find((p) => p.id === 'remote-chat')
    expect(remote?.configured).toBe(true)
  })

  it('loads the real runtime.providers.json and contains the deepseek provider', () => {
    const config = loadConfig('config/runtime.providers.json')
    const deepseek = config.providers.find((p) => p.id === 'deepseek-chat')
    expect(deepseek, 'deepseek-chat provider must exist in config').toBeDefined()
    expect(deepseek?.protocol).toBe('chat-completions')
  })
})
