import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { glob } from 'tinyglobby'

describe('DeepSeek Harness dependency boundary', () => {
  it('allows DSH imports only inside the dedicated runtime adapter', async () => {
    const root = process.cwd()
    const files = await glob(['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', '!**/node_modules/**'], {
      cwd: root,
      absolute: true,
    })
    const offenders: string[] = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const normalized = file.replaceAll('\\', '/')
      if (source.includes('@deepseek-ai/dsh') && !normalized.endsWith('/infrastructure/src/dsh-runtime.ts')) {
        offenders.push(relative(root, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
