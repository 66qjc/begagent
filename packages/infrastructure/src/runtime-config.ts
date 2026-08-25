import { readFileSync } from 'node:fs'
import type {
  CareerPolicyConfig,
  RuntimeProviderConfig,
  RuntimeProvidersConfig,
} from '@career/contracts'
import {
  CareerPolicyConfigSchema,
  RuntimeProvidersConfigSchema,
} from '@career/contracts'
import type { CareerRuntimePort } from '@career/core'
import { ConfiguredCareerRuntime } from './configured-career-runtime.ts'
import { DeterministicCareerRuntime } from './deterministic-runtime.ts'
import {
  AnthropicMessagesProtocol,
  OpenAiChatProtocol,
  OpenAiResponsesProtocol,
  type ModelProtocol,
} from './model-protocols.ts'

export interface RuntimeProviderView {
  id: string
  name: string
  protocol: RuntimeProviderConfig['protocol']
  enabled: boolean
  configured: boolean
  model?: string
}

export interface RuntimeCatalogView {
  version: string
  activeProviderId: string
  activeProtocol: RuntimeProviderConfig['protocol']
  providers: RuntimeProviderView[]
}

interface RuntimeFactoryOptions {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}

export function loadRuntimeProvidersConfig(path: string): RuntimeProvidersConfig {
  return RuntimeProvidersConfigSchema.parse(readJson(path))
}

export function loadCareerPolicyConfig(path: string): CareerPolicyConfig {
  return CareerPolicyConfigSchema.parse(readJson(path))
}

/** Selects one configured protocol at startup and returns only redacted metadata. */
export function createConfiguredRuntime(
  config: RuntimeProvidersConfig,
  options: RuntimeFactoryOptions = {},
): { runtime: CareerRuntimePort; view: RuntimeCatalogView } {
  const env = options.env ?? process.env
  const activeId = env['CAREER_RUNTIME_PROVIDER'] || config.activeProviderId
  const active = config.providers.find((provider) => provider.id === activeId)
  if (!active) throw new Error(`Runtime provider ${activeId} does not exist.`)
  if (!active.enabled) throw new Error(`Runtime provider ${activeId} is disabled.`)

  const providers = config.providers.map((provider): RuntimeProviderView => {
    const configured = provider.protocol === 'deterministic'
      || Boolean(env[provider.apiKeyEnv])
    return {
      id: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      enabled: provider.enabled,
      configured,
      ...('model' in provider ? { model: provider.model } : {}),
    }
  })

  if (active.protocol === 'deterministic') {
    return {
      runtime: new DeterministicCareerRuntime(),
      view: {
        version: config.version,
        activeProviderId: active.id,
        activeProtocol: active.protocol,
        providers,
      },
    }
  }

  const apiKey = env[active.apiKeyEnv]
  if (!apiKey) {
    throw new Error(`Runtime provider ${active.id} requires environment variable ${active.apiKeyEnv}.`)
  }
  const protocol = createProtocol(active, apiKey, options.fetchImpl)
  return {
    runtime: new ConfiguredCareerRuntime({ protocol }),
    view: {
      version: config.version,
      activeProviderId: active.id,
      activeProtocol: active.protocol,
      providers,
    },
  }
}

function createProtocol(
  config: Exclude<RuntimeProviderConfig, { protocol: 'deterministic' }>,
  apiKey: string,
  fetchImpl?: typeof fetch,
): ModelProtocol {
  const options = {
    baseUrl: config.baseUrl,
    apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
    ...(fetchImpl ? { fetchImpl } : {}),
  }
  if (config.protocol === 'chat-completions') return new OpenAiChatProtocol(options)
  if (config.protocol === 'responses') return new OpenAiResponsesProtocol(options)
  return new AnthropicMessagesProtocol(options)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}
