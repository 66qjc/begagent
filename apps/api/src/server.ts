import { resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createConfiguredRuntime,
  loadCareerPolicyConfig,
  loadRuntimeProvidersConfig,
} from '@career/infrastructure'
import { buildApp } from './app.ts'

const port = Number(process.env['PORT'] ?? 4317)
const host = process.env['HOST'] ?? '127.0.0.1'
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const databasePath = process.env['CAREER_DB_PATH'] ?? resolve(workspaceRoot, 'data', 'career.sqlite')
const runtimeConfigPath = process.env['CAREER_RUNTIME_CONFIG']
  ?? resolve(workspaceRoot, 'config', 'runtime.providers.json')
const policyPath = process.env['CAREER_POLICY_PATH']
  ?? resolve(workspaceRoot, 'config', 'career-policy.json')

const runtimeBundle = createConfiguredRuntime(loadRuntimeProvidersConfig(runtimeConfigPath))
const policyConfig = loadCareerPolicyConfig(policyPath)
const app = await buildApp({
  databasePath,
  logger: true,
  runtime: runtimeBundle.runtime,
  runtimeView: runtimeBundle.view,
  policyConfig,
})

const close = async (): Promise<void> => {
  await app.close()
  process.exit(0)
}

process.once('SIGINT', () => { void close() })
process.once('SIGTERM', () => { void close() })

await app.listen({ host, port })
