import type { ClusterRecord } from './types.js'

export interface IssuePublisher {
  publish(cluster: ClusterRecord): Promise<string>
}

export class GitHubIssuePublisher implements IssuePublisher {
  constructor(
    private readonly token: string,
    private readonly repository: string,
  ) {}

  async publish(cluster: ClusterRecord): Promise<string> {
    const [owner, repo] = this.repository.split('/')
    if (owner === undefined || repo === undefined) throw new Error('GITHUB_REPOSITORY must be owner/repo')
    const title = `[Plugin Lab] ${cluster.pluginModule}: ${cluster.symptom}`
    const body = [
      '## 聚合实测',
      '',
      `- 插件：\`${cluster.pluginModule}\``,
      `- 版本：\`${cluster.pluginVersion ?? 'unknown'}\``,
      `- 运行状态：\`${cluster.health}\``,
      `- 用户确认体验：\`${cluster.experience}\``,
      `- 聚合报告数：${cluster.similarReports}`,
      '',
      '此 Issue 只包含达到阈值后的有限枚举聚合，不包含单条报告、日志、会话、环境、时间或身份字段。',
    ].join('\n')
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'user-agent': 'omdsh-plugin-lab',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, labels: ['plugin-lab', 'needs-triage'] }),
    })
    if (!response.ok) throw new Error(`GitHub issue creation returned HTTP ${response.status}`)
    const value = await response.json() as { html_url?: unknown }
    if (typeof value.html_url !== 'string') throw new Error('GitHub issue response has no html_url')
    return value.html_url
  }
}
