/* 公开的分享 Skill（docs/WORKSHOP-SHARE-DESIGN.md 三 B 路第 1 条）：GET /skill/share-work.md，不要登录，text/markdown。
 * 教师把这个地址和一枚投稿令牌发给 Claude、WorkBuddy 等 Agent，Agent 读了就知道怎么把教研工坊导出的课整理成课程成果草稿。
 * 同一份也挂在 GET /api/skill/share-work.md：前端开发代理与反向代理只转 /api，页面上给的是这个地址。
 * 内容由 brand 与 ORIGIN 拼出来，不存库；改措辞改这里。 */
import { brandOf } from './brand.js';
import { PIPELINES, FIVE, FILES_SCOPES } from './works.js';

export function skillMarkdown(db, origin) {
  const b = brandOf(db);
  const base = String(origin || '').replace(/\/+$/, '');
  return `---
name: share-work-to-${'academy'}
description: 把教研工坊做出来、班里用过的一门课，整理成${b.short}的课程成果草稿并上传。教师补「改了什么」后自己提交。
---

# 把一门课分享到${b.short}

你是在替一位幼儿园教师整理课程成果。成果会实名发到${b.short}，先落成**草稿**，由教师本人补一栏后提交。你的工作到落草稿为止。

## 先问教师要什么

1. 一枚**投稿令牌**（\`cla_\` 开头）。教师在${b.short}「设置 → 接口令牌 → 新建一枚投稿令牌」里建，标签写你的名字。没有就请教师去建，**不要替教师注册账号**。
2. 教研工坊导出的课程文件：信息采集表、主题网络图或项目大纲、周计划或课程计划表、教案 docx。zip 也行。
3. 教师在班里**用过**这门课。只起草没用过的不算成果，直接告诉教师等用过再分享。

## 从导出物里取什么

| 字段 | 从哪里取 | 规则 |
|---|---|---|
| \`title\` | 信息采集表的主题 / 项目名 | ≤ 120 字 |
| \`pipeline\` | 工坊管线 | ${Object.entries(PIPELINES).map(([k, v]) => `\`${k}\` ${v}`).join(' / ')} |
| \`age\` | 信息采集表的年龄班 | 小班 / 中班 / 大班 / 混龄，没有就不带 |
| \`weeks\` | 周计划的周数、课程计划表的周数 | 1–20，没有就不带 |
| \`domains\` | 信息采集表或网络图里的领域 | ${Object.entries(FIVE).map(([k, v]) => `\`${k}\` ${v}`).join(' / ')}，至少一个 |
| \`summary\` | 主题由来 + 周计划的周重点 + 教师口述的班里效果 | 草稿可短；提交时要 ≥ 50 字，所以能写到 50 字以上最好。写给同行看：主题怎么来的、几周、每周做什么、班里用下来怎样 |
| \`files\` | 工坊的 docx 下载地址，或教师给的网盘外链 | 最多 20 条，只收 \`https://\`；${b.short}不存文件，只存链接 |
| \`source\` | 工坊课程地址（\`/teaching-workshop/<uuid>?id=<n>\`）与 id | 有就带 |
| \`message\` | 教师想对同行说的一句 | ≤ 80 字，可空；是教师说的，不是你总结的 |
| \`allowAdapt\` | 问教师「允许别的老师改编吗」 | 默认 true |
| \`filesScope\` | 问教师「文件给谁看」 | ${Object.entries(FILES_SCOPES).map(([k, v]) => `\`${k}\` ${v}`).join(' / ')}，默认 \`all\` |

## 不许做的

- **不填 \`changes\`（在起草稿上改了什么）。** 这一栏只能教师自己写，是成果里「人」的部分。你填了服务端也会丢掉。教案 docx 里的「活动反思」「理论适配说明」段是工坊生成的，**不是**教师改的东西，不要搬进去。
- 不带幼儿姓名与正脸。教案里预设的幼儿应答是写死的剧本，不算真实幼儿信息，但也不要当成效果写进简介。
- 不带工坊的课程评分、送审次数、审核意见。
- 不替教师点提交。

## 怎么上传

先给教师看一遍你整理的字段，教师确认后再调：

\`\`\`
POST ${base}/api/works/draft
Authorization: Bearer cla_…
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "title": "运动：下肢力量锻炼",
  "pipeline": "theme",
  "age": "小班",
  "weeks": 3,
  "domains": ["health", "lang"],
  "summary": "从体测发现本班下肢力量薄弱出发，三周主题，户外以跨跳、攀爬为主，室内配儿歌与绘本，每周一次家园同做。",
  "files": [{ "name": "主题网络图.docx", "url": "https://jiaoyan.clife.cn/…/主题网络图.docx" }],
  "source": { "courseId": "1522", "url": "https://jiaoyan.clife.cn/teaching-workshop/<uuid>?id=1522" },
  "allowAdapt": true,
  "filesScope": "all"
}
\`\`\`

应答 \`{ work, url, next }\`。把 \`url\`（形如 \`/works?tab=mine&id=…\`）拼在 \`${base}/#\` 后面给教师：

> 草稿已经到${b.short}了：${base}/#/works?tab=mine&id=…  。打开它，补上「在起草稿上改了什么」，点「交给园长」。七天没动会自动删。

只要 \`title\` 与 \`pipeline\` 就能落草稿；\`400\` 是字段不合（看 \`code\`），\`401\` 是令牌无效或已撤，\`403 scope\` 是令牌不是投稿令牌。同一份草稿要改，带上 \`id\` 再调一次。

## 之后

教师在${b.short}「课程成果 → 我交的」里补齐并提交，园长同意、审核人入库，入库记积分。这些都不用你做。
`;
}

export function skillRoutes({ db, origin }) {
  const serve = async (req, res) => {
    const body = skillMarkdown(db, origin);
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  };
  return { 'GET /skill/share-work.md': serve, 'GET /api/skill/share-work.md': serve };
}
