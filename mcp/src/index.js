#!/usr/bin/env node
/* 学前大课堂 MCP 只读桥 — stdio。LLM 客户端（Claude Desktop、Cursor 等）本地起这个进程，它拿只读接口令牌去调学前大课堂的 GET 接口。
   只读：令牌在服务端就只允许 GET；能看什么按账号判。 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { TOOLS } from './tools.js'
import { checkConfig, get } from './http.js'

const server = new McpServer({ name: 'clife-academy', version: '0.1.0' })

// 配置不对先在 stderr 说清楚，但工具照样全部注册，客户端能看到清单，改好环境变量重启就行。
try {
  const { url } = checkConfig()
  get('/api/me').then(r => console.error(`[clife-academy-mcp] ${url} · ${r.user.name}${r.user.academy?.org?.name ? ' · ' + r.user.academy.org.name : ''}${r.user.academy?.district?.name ? ' · ' + r.user.academy.district.name : ''}`))
    .catch(e => console.error(`[clife-academy-mcp] ${e.message}`))
} catch (e) {
  console.error(`[clife-academy-mcp] ${e.message}`)
}

for (const t of TOOLS) {
  server.tool(t.name, t.description, t.schema, async params => {
    try {
      const result = await t.handler(params || {})
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `${err.code || 'ERROR'}: ${err.message}` }] }
    }
  })
}

const transport = new StdioServerTransport()
await server.connect(transport)
