# 学前大课堂 MCP 只读桥

园长、教育局（区县管理员）用自己的 LLM 客户端（Claude Desktop、Cursor、Cline 等）问本园、本区的学习进度：「保健医路径这周过了几关」「待点评超期的有几件」「本区覆盖率中位数多少」。桥是一个本地 stdio 进程，客户端起它，它拿一枚**只读接口令牌**去调学前大课堂的 GET 接口。

- **只读**：令牌在服务端就只允许 GET，带它来的任何写请求一律 403。
- **不放大权限**：能看什么由各接口按账号判，教师看自己、园长看本园、区县管理员看本区。
- **不列个人、不排名**：园所与区县汇总只留岗位、人数、中位数这些行，桥把服务端给的名单再滤一道。
- 课程目录直接读仓库里的 `frontend/src/lib/lessons.js`，与网页同一份。

## 接法

1. 在学前大课堂网页「设置 → 只读接口令牌」新建一枚，标签写客户端名。令牌只显示这一次，`cla_` 开头，复制走；最多 5 枚在用，点一枚可撤。
2. 装依赖：

```bash
cd mcp && npm install
```

3. 填进客户端的 MCP 配置。Claude Desktop 的是 `claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`）：

```jsonc
{
  "mcpServers": {
    "clife-academy": {
      "command": "node",
      "args": ["/绝对路径/clife-academy/mcp/src/index.js"],
      "env": {
        "ACADEMY_URL": "https://academy.example.com",   // 学前大课堂地址；本地开发 http://127.0.0.1:3000
        "ACADEMY_TOKEN": "cla_…"
      }
    }
  }
}
```

重启客户端。桥起来会在 stderr 打一行「地址 · 账号 · 园所/区县」；令牌不对会直接说。

## 工具

| 工具 | 答什么 | 谁能用 |
|---|---|---|
| `whoami` | 这枚令牌是谁：岗位、园所或区县 | 所有人 |
| `list_paths` / `get_path` | 课程目录：15 条路径 100 关，每关标题、类型、场景、时长、目标 | 所有人（本地读） |
| `my_progress` | 自己每条路径过了几关、最近过的关、学分 | 本人 |
| `my_honors` | 自己的徽章、称号、证书与学时 | 本人 |
| `org_summary` | 本园各岗位几人、平均过关、完成率、近 7 天过关 | 园长、管理员 |
| `org_weekly` | 上周运营周报：过关、作品、点评、超期、每周一题、答疑、入库 | 园长（本园）、管理员（全平台＋各园一行） |
| `org_review_stats` | 待点评、超期、最老一件、点评用时中位数 | 园长、管理员 |
| `org_checkup` | 本园应用体检卡与推课建议 | 园长、管理员 |
| `org_cohort` | 本园对其他园的匿名对照：完成率、岗位、领域覆盖、在学占比的中位数（≥ 3 所才给） | 园长、管理员 |
| `org_honors` | 园所集体荣誉 | 园长、管理员 |
| `district_summary` | 区县看板：园所数、覆盖率中位数、认证人数（≥ 3 园才给中位数） | 区县管理员、管理员 |
| `district_orgs` | 本区园所名单 | 区县管理员、管理员 |
| `search_cases` | 案例库检索：关键词、领域、只看共同体 | 所有人 |
| `list_resources` | 资源库：关键词、类别、领域 | 所有人 |
| `upcoming` | 将开的讲堂、开着的每周一题、在用的公告 | 所有人 |

没有写工具：预约、作答、交作品都回网页或小程序做。

## 开发

```bash
npm test                         # vitest：假 fetch 下每个工具发到哪条 GET、滤没滤个人名单
npm run check:node-loadable      # 课程包在裸 node 下能不能 import（桥不走 Vite）
ACADEMY_URL=http://127.0.0.1:3000 ACADEMY_TOKEN=cla_… node src/index.js   # 手起，stdin 喂 JSON-RPC
```

令牌的服务端实现在 `api/academy/tokens.js`（`db.apiTokens` 只存 sha256，撤了即失效，账号停用一起失效）。
