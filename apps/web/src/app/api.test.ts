// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyWorkspaceState } from '@career/core'
import { careerApi } from './api.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Career API client', () => {
  it('does not send a JSON content type when a POST has no body', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(createEmptyWorkspaceState()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await careerApi.resetDemo()

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).has('content-type')).toBe(false)
  })
})
