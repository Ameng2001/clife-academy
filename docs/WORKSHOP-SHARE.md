# 教研工坊「分享到幼师学坊」接口契约

工坊里一门课做完、用过以后，教师点「分享到幼师学坊」，工坊替教师往幼师学坊交一条课程成果。交过去仍走园长同意、审核人入库，署名是令牌主人。

## 前提

教师在幼师学坊「设置 → 接口令牌 → 新建一枚投稿令牌」，标签写「教研工坊」，把令牌粘到工坊的个人设置里。令牌只显示一次，`cla_` 开头，可撤。没有令牌的教师，工坊按钮应提示去学坊建一枚，不要替教师建账号。

## 请求

```
POST https://<幼师学坊>/api/works
Authorization: Bearer cla_…
Content-Type: application/json
```

```json
{
  "title": "运动：下肢力量锻炼",
  "pipeline": "theme",
  "age": "小班",
  "weeks": 3,
  "domains": ["health", "lang", "social", "art", "sci"],
  "summary": "从体测发现下肢力量薄弱出发……（至少 50 字，工坊可以用课程简介或主题由来预填，教师可改）",
  "changes": ["户外跳箱改成跨跳垫，小班跳不上去", "第 2 周语言活动换成本班熟悉的儿歌"],
  "files": [
    { "name": "主题网络图.docx", "url": "https://jiaoyan.clife.cn/…/主题网络图.docx" },
    { "name": "3周周计划.zip", "url": "https://jiaoyan.clife.cn/…/3周周计划.zip" }
  ],
  "source": { "courseId": "1522", "url": "https://jiaoyan.clife.cn/teaching-workshop/<uuid>?id=1522" },
  "message": "第二周换成本班儿歌以后，幼儿自己会唱着做了",
  "allowAdapt": true,
  "filesScope": "all"
}
```

| 字段 | 说明 |
|---|---|
| `pipeline` | `theme` 主题式 / `pbl` 项目式 / `activity` 单节活动 |
| `age` | 小班 / 中班 / 大班 / 混龄，可不带 |
| `weeks` | 1–20，可不带 |
| `domains` | 五大领域：`lang` 语言 / `social` 社会 / `health` 健康 / `art` 艺术 / `sci` 科学，至少一个 |
| `summary` | ≥ 50 字 |
| `changes` | **必填，至少一条**：教师在起草稿上改了什么。工坊应在分享前让教师填这一栏，不要自动生成。空的学坊不收（`400 { code: 'changes' }`） |
| `files` | 最多 20 条，只收 `https://` 外链；学坊不存文件，链接失效由工坊负责 |
| `source` | 工坊课程 id 与地址；学坊会显示「在教研工坊里打开这门课」 |
| `message` | 可空，≤ 80 字：分享者给同行的一句话，显示在卡片上。工坊在提交成功那一屏问一句「给同行留一句话？」，可跳过；不是评价、不是总结 |
| `allowAdapt` | 可空，默认 `true`：允许别的教师改编这门课 |
| `filesScope` | 可空，默认 `all`：文件外链对谁可见，`all` 全平台 / `community` 本共同体 / `org` 本园。简介与「改了什么」始终全平台可见 |
| `adaptedFrom` | 可空：改自学坊里哪门课程成果的 `work.id`（从学坊「改编这门课」跳来的 `?work=`；开课前可带 TOOLS_API_KEY 调 `GET /api/tools/work?id=&from=` 核对）。只能是已入库、分享者允许改编的；入库时原作者与改编者都署名，原成果记一次「用过，有效」。工坊若支持从学坊「改编这门课」跳回来开新课，交的时候带上它 |

## 应答

`200 { work }`，`work.status` 是 `consent`（教师账号，等园长同意）或 `pending`（园长账号，直接待审核）；`work.source` 是 `{ kind: 'token', via: '教研工坊', url }`。工坊可以把 `work.id` 记在课程上，之后教师改了再交时带 `id`（只能改还没入库的）。

## 错误

| 状态 | code | 意思 |
|---|---|---|
| 400 | title / pipeline / summary / changes / domains | 字段不合，见上表 |
| 401 | | 令牌无效或已撤 |
| 403 | scope | 令牌不是投稿令牌，或调了别的写接口 |
| 403 | edit | 带了 id 但不是本人的，或已入库 |

## 配套接口

- `GET /api/me/token`（用令牌调）：令牌自检，答 `ok`（是不是投稿令牌）、`label`、`user {name, orgName}`、`hint`。工坊令牌设置页粘进来就调一次。
- `GET /api/works/options`（令牌或登录）：四栏表的词表与上限（`pipelines / domains / ages / filesScopes / limits / changesHints / changesTemplate / flow`），工坊不自己维护一份。
- `POST /api/works/message { id, message }`：署名一句单独改，入库后也能。
- `GET /api/works/mine`（令牌可读）：本人交过的，带 `status` 与退回的 `note`。
- 提交应答 `{ work, url, next }`：`url` 是 `/works?tab=mine&id=…`（前面拼 `<学坊>/#`），`next` 给教师看的下一步。

联调脚本：`scripts/workshop-share-check.mjs`。

## 草稿（外部 Agent 走这条）

用 Claude 等 Agent 整理课程的教师，不直接 `POST /api/works`，而是 `POST /api/works/draft`（同样的令牌、同样的字段）。给 Agent 读的说明在 `GET /skill/share-work.md`（公开，text/markdown，也挂在 `/api/skill/share-work.md`）；教师在学坊「课程成果 → 用 Agent 整理」页拿到带这个地址与令牌的指令。

- 只要 `title` 与 `pipeline`，`summary` 可短，`changes` **不要带**，带了服务端也丢弃：「改了什么」只能教师自己写；
- 应答 `{ work, url, next }`，`url` 是 `/works?tab=mine&id=<id>`，把它给教师；教师在学坊打开，补齐「改了什么」后点「交给园长」才进流程；
- 草稿只有本人看得到，不进园长队列，不记积分；七天没动自动删；
- 令牌不能用 `POST /api/works` 带 `id` 把草稿推进流程（`403 { code: 'draft' }`）。

教研工坊自己的「分享到幼师学坊」按钮仍走 `POST /api/works`：教师在工坊页面上已经填了「改了什么」。

## 不要做的

- 不要把工坊的课程评分、送审次数、审核意见带过来。学坊不展示这些数字。
- 不要替教师点分享。教师自己点，而且页面上要先填「改了什么」。
- 不要带幼儿姓名与正脸。工坊的教案里预设的幼儿应答是写死的剧本，不算。
