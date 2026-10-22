# 投稿令牌：教研工坊与第三方往案例库投稿

把工坊或别的系统的产出投进学前大课堂案例库，不搬引擎、不开新账号：用一枚**投稿令牌**调三条接口。投来的东西仍走园长同意、审核人入库的流程，署名是令牌主人。

## 拿令牌

网页「设置 → 接口令牌 → 新建一枚投稿令牌」，标签写系统名（如「教研工坊」），标签会显示在它投来的案例上（「经「教研工坊」投稿」）。令牌只显示一次，`cla_` 开头，库里只存哈希；最多 5 枚在用，点一枚可撤，撤了立刻失效。

## 能做什么

| 请求 | 用途 |
|---|---|
| `GET` 任意接口 | 和只读令牌一样，按令牌主人的账号能看什么 |
| `POST /api/cases` | 投一条案例：`{ title, domain, age?, use, text(≥50 字), files?, adaptedFrom?, adaptNote? }`；也能改自己还没入库的（带 `id`） |
| `POST /api/cases/forms/draft` | 给已入库案例生成轻形态草稿：`{ caseId, kind: parents\|transition\|memo }` |
| `POST /api/cases/forms` | 改定轻形态：`{ id, content }` |

其余写请求一律 `403 { code: 'scope' }`。只读令牌的任何写请求仍是 `403 { code: 'readonly' }`。

## 投一条

```bash
curl -X POST https://<学前大课堂>/api/cases \
  -H "Authorization: Bearer cla_…" -H "Content-Type: application/json" \
  -d '{"title":"午睡前的安静角","domain":"life","use":"adapt","text":"之前午睡前孩子们总是吵……"}'
```

应答里 `case.source` 是 `{ kind: 'token', via: '教研工坊' }`，`case.status` 是 `consent`（教师账号）或 `pending`（园长账号）。之后在网页「案例库 → 我交的」能看到，退回会写原因。

## 边界

- 投来的正文一样不能出现幼儿姓名与正脸；审核人会退。
- 附图要先用本账号的上传接口传好再带 `files`（哈希）；工坊首期不带图。
- 来源链：改自库里某条案例就带 `adaptedFrom`（那条的 id），入库时给原案例记一次「用过，有效」。
- 令牌不放大权限：教师账号的投稿令牌投稿后仍要本园园长同意。

细节见 `api/academy/tokens.js`（`SUBMIT_ROUTES`）与 `api/openapi.yaml`。
