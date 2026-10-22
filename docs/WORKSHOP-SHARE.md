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
  "source": { "courseId": "1522", "url": "https://jiaoyan.clife.cn/teaching-workshop/<uuid>?id=1522" }
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

## 应答

`200 { work }`，`work.status` 是 `consent`（教师账号，等园长同意）或 `pending`（园长账号，直接待审核）；`work.source` 是 `{ kind: 'token', via: '教研工坊', url }`。工坊可以把 `work.id` 记在课程上，之后教师改了再交时带 `id`（只能改还没入库的）。

## 错误

| 状态 | code | 意思 |
|---|---|---|
| 400 | title / pipeline / summary / changes / domains | 字段不合，见上表 |
| 401 | | 令牌无效或已撤 |
| 403 | scope | 令牌不是投稿令牌，或调了别的写接口 |
| 403 | edit | 带了 id 但不是本人的，或已入库 |

## 不要做的

- 不要把工坊的课程评分、送审次数、审核意见带过来。学坊不展示这些数字。
- 不要替教师点分享。教师自己点，而且页面上要先填「改了什么」。
- 不要带幼儿姓名与正脸。工坊的教案里预设的幼儿应答是写死的剧本，不算。
