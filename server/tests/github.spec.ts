import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubIssuePublisher } from '../src/github.js'
import type { ClusterRecord } from '../src/types.js'

afterEach(() => { vi.unstubAllGlobals() })

describe('GitHub aggregate summary publisher', () => {
  it('publishes only a fixed category summary after service-side aggregation', async () => {
    let requestBody = ''
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? '')
      return new Response(JSON.stringify({ html_url: 'https://github.example/issues/1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }))
    const cluster: ClusterRecord = {
      id: crypto.randomUUID(),
      clusterKey: 'aggregate-key',
      pluginModule: '@example/plugin',
      pluginVersion: '1.0.0',
      health: 'error',
      experience: 'bad',
      category: 'reliability',
      symptom: 'reliability-health-error',
      status: 'clustered',
      similarReports: 5,
      updatedAt: Date.now(),
    }
    await expect(new GitHubIssuePublisher('token', 'owner/repo').publish(cluster))
      .resolves.toBe('https://github.example/issues/1')
    const posted = JSON.parse(requestBody) as { title: string; body: string }
    expect(posted.title).toContain('稳定性聚合反馈')
    expect(posted.body).toContain('脱敏大类：`reliability`（稳定性）')
    expect(posted.body).toContain('聚合报告数：5')
    for (const forbidden of [
      'CANARY_PRIVATE_TASK', 'Prompt 内容', '用户日志内容', '/Users/alice', '单次报告 ID',
    ]) expect(posted.body).not.toContain(forbidden)
  })
})
