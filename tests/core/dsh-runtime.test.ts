import { describe, expect, it } from 'vitest'
import * as infrastructure from '@career/infrastructure'

describe('DSH runtime adapter', () => {
  it('is lazy and can be constructed without starting a runtime', async () => {
    const Adapter = (infrastructure as Record<string, unknown>).DshCareerRuntime
    expect(Adapter, 'DshCareerRuntime must be exported').toBeTypeOf('function')
    const runtime = new (Adapter as new (options: unknown) => { close(): Promise<void> })({
      launch: { command: 'missing-runtime', args: [] },
      provider: 'deepseek-official',
      model: 'deepseek-chat',
      cwd: process.cwd(),
    })
    await expect(runtime.close()).resolves.toBeUndefined()
  })
})
