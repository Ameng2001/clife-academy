# 教研工坊线上版（jiaoyan.clife.cn）待办清单

2026-10-22。幼师学坊这头的接口全部就绪（契约 docs/WORKSHOP-SHARE.md、docs/POINTS-DESIGN.md、api/openapi.yaml）。下面是工坊线上版要做的事，按先后排。参考实现与界面规格在插件仓库 courses-workshop-plugins（`workshop-core/scripts/share_academy.py`、`apps/teaching-workshop-ui-v3/export-bundle.html`、`docs/design/教研工坊-分享到幼师学坊.md`），线上版照着做即可，不必照搬代码。

每条后面的「验收」是学坊这边能看到的结果。

## 一、分享到幼师学坊（先做）

| # | 待办 | 要点 | 验收 |
|---|---|---|---|
| 1 | 个人设置加「幼师学坊令牌」 | 一个输入框，粘 `cla_` 开头的投稿令牌，存在工坊账号下；只显示「已配置 / 未配置」，不回显令牌；可清掉重粘。旁边一句：到幼师学坊「设置 → 接口令牌 → 新建一枚投稿令牌」，标签写「教研工坊」。**不替教师建学坊账号** | 粘进来先用它调 `GET /api/me/token`：`ok:true` 显示「已配置 · 王老师（园）」，`ok:false` 是只读令牌，显示应答里的 `hint`；401 是无效或已撤。工坊用这枚令牌调学坊接口，学坊里署名是教师本人 |
| 2 | 交付页加「分享到幼师学坊」按钮 | 和「一键导出」并排。课程「未完成 / 待提交」时灰，悬停说「用过再分享」；「审核通过」或教师标过「已在班里用过」才亮。没配令牌的点了弹第 1 条的说明 | 按钮状态随课程状态变 |
| 3 | 四栏表 | ① 标题、管线、年龄班、周数、领域：从信息采集带出，可改。② 简介 ≥ 50 字：预填「主题由来」或项目导览第一段，可改。③ 文件：勾选产物，每个勾选项给**可长期访问的 https 下载地址**（学坊不存文件，链接失效由工坊负责）；默认只勾网络图与周计划。④ **在起草稿上改了什么**：至少一条、每条 ≤ 120 字，空的提交按钮不亮；三个提示词「幼儿应答」「材料」「环节数」各起一行「把 ___ 改成 ___，因为 ___」。**不替教师生成这一栏，不从修改记录、评审意见、活动反思里摘** | 词表、上限、三个提示词与模板句都从 `GET /api/works/options` 取，工坊不自己维护一份。`POST /api/works` 成功，学坊「我交的」出现这门课，`changes` 是教师的原话 |
| 4 | 两个开关 | 允许改编（默认开）；文件对谁可见（全平台 / 本共同体 / 本园，默认全平台）。对应 `allowAdapt`、`filesScope` | 学坊卡片上「只看不改编」「文件 · 本园可见」随开关变 |
| 5 | 提交与回写 | `POST /api/works`，带 `source: { courseId, url }`（`url` 是课程工作台地址）。成功把 `work.id` 记在课程上，按钮变「已分享 · 在幼师学坊里看」，链到应答的 `url`（`/works?tab=mine&id=<id>`，前面拼 `<学坊>/#`），`next` 是下一步给教师看的一句；之后用令牌 `GET /api/works/mine` 查状态。学坊退回（状态 `rejected`）后教师改了再交带同一个 `id` | 重交不生成第二条；学坊卡片写「来自教研工坊」并有「在教研工坊里打开这门课」 |
| 6 | 署名一句（可跳过） | 提交成功那一屏问「给同行留一句话？」≤ 80 字，调 `POST /api/works/message { id, message }`，只改这一句；入库后也能补或改。跳过不追问 | 学坊卡片显示「王老师：……」 |
| 7 | 错误处理 | `400 changes` 回第四栏；`400 summary` 回第二栏；`400 pipeline / domains / title` 回第一栏；`401` 令牌无效或已撤，回第 1 条；`403 readonly` 粘的是只读令牌，`403 scope` 投稿令牌调了别的写接口；`403 edit` 已入库不能改（署名一句除外）；`400 adapt` 原成果不能改编了，去掉 `adaptedFrom` 再交 | 每种错误有一句人话。学坊联调脚本把第 1–8 条的接口都跑一遍：`ACADEMY_URL=<学坊> ACADEMY_TOKEN=<投稿令牌> node scripts/workshop-share-check.mjs` |
| 8 | 不带的东西 | 不带课程评分、送审次数、审核意见；不带幼儿姓名与正脸（教案里预设的幼儿应答是剧本，不算）；不自动推送、不批量分享 | 学坊收到的 body 里没有这些字段 |

## 二、改编回跳

| # | 待办 | 要点 | 验收 |
|---|---|---|---|
| 9 | 支持 `?from=<courseId>&work=<学坊成果 id>` 开新课 | 工坊新建课程时读 `from` 与 `work`，先带密钥调 `GET /api/tools/work?id=<work>&from=<from>&uid=<教师>` 核一下：`canAdapt` 为 true 才复制（false 看 `why`：没入库 / 分享者不许改编 / `from` 与这门成果的课程 id 对不上，提示「这门课现在不能改编」回到普通新建）；把原课的信息采集、网络图、周计划复制成新课的起草稿，用应答的 `label` 标「改编自《…》· 谁（园）」，把 `work` 记在新课上。原课不是本人的也能改编；`own` 为 true 是改自己的，照常开 | 从学坊「改编这门课」跳过来能直接进新课工作台，新课标着「改编自」。学坊联调脚本第 12 步验核对接口：`node scripts/workshop-spend-check.mjs --uid <uid> --work <学坊成果 id>` |
| 10 | 改编版分享时带来源 | 第 9 条记在新课上的 `work`，这门课分享时作 `adaptedFrom` 放进 `POST /api/works`（草稿路 `/api/works/draft` 也认）；扣积分时也带它，5 折（第 14 条）。学坊核原成果仍入库且允许改编，否则 `400 adapt`，这时去掉 `adaptedFrom` 再交、照常入库但不算改编。不要把原课的「改了什么」搬过来，这一栏仍是教师自己写的 | 学坊入库后原作者与改编者都署名，原成果记一次「用过，有效」（原作者记 20 分），学坊卡片上「改自《…》」「被改编」两行都出现 |
| 11 | ~~学坊那边把按钮改成跳工坊~~ 学坊已做（夜 68）：服务端配 `WORKSHOP_ADAPT_URL`（模板，`{courseId}` `{workId}`）后，「改编这门课」在来自工坊的成果上跳工坊，旁边留「在这里手填」；没配就仍开预填表。工坊 9、10 上线时只要学坊运维配这一个环境变量 | 配置后点按钮新开 `<工坊>/teaching-workshop/new?from=1522&work=<id>` |

## 三、积分

| # | 待办 | 要点 | 验收 |
|---|---|---|---|
| 12 | 服务端接 `TOOLS_API_KEY` | 工坊服务端配学坊地址与密钥（只放服务端，不进前端、不进日志）；接上先调 `GET /api/tools/ping` 握手，拿到学坊名、认的 tool、`uid.accepts`。**uid 传平台账号的 uid 就行**（统一登录，学坊按 `user.platform.uid` 找人），也认学坊自己的 `user.id`；应答里 `uid` 是学坊 id、`platformUid` 是平台 uid。找不到人答 `404 uid`：这位教师还没登过学坊，工坊提示「先用平台账号登一次幼师学坊」 | `ping` 答 `ok:true`；`GET /api/points/balance?uid=<平台 uid>` 返回余额、园所额度与合计。学坊联调脚本第 0 步验握手：`node scripts/workshop-spend-check.mjs --uid <平台 uid>` |
| 13 | 按管线扣减 | 起草确认那一步调 `POST /api/points/spend { uid, tool: 'workshop', n, ref, note }`。建议价：主题式 30 / 周、项目式 40 / 周、单节活动 10；`ref` 用课程 id 加阶段（如 `course:1522:draft`），同一 `ref` 重复调用不再扣。学坊先扣园所额度再扣个人积分，应答 `fromQuota / fromPoints`。余额不够答 `409 insufficient`，工坊提示「积分不够：去幼师学坊学几关，或请园长分配园所额度」 | 学坊流水里出现 tool 为教研工坊的扣减。学坊给了联调脚本：`ACADEMY_URL=<学坊测试环境> TOOLS_API_KEY=<密钥> node scripts/workshop-spend-check.mjs --uid <测试教师 uid>`，查余额、扣减、重复 ref、超额 409、字段校验、流水一遍跑完打 PASS；`--price pbl 4 --adapted` 只算价，`priceOf()` 是算价的参考实现 |
| 14 | 改编半价 | `?from=…&work=<学坊成果 id>` 开的课，扣减时把 `work` 作 `adaptedFrom` 传给学坊：`POST /api/points/spend { uid, tool:'workshop', pipeline, weeks, ref, adaptedFrom }`，学坊核过这门成果入库且允许改编就按 5 折扣（向上取整）、自己写 note；起草确认前可先 `GET /api/points/quote?pipeline=&weeks=&adaptedFrom=&uid=` 报价给教师看（带够不够）。工坊不必自己算价、不必自己写「改编自」；不是从学坊跳来的课不传 `adaptedFrom`，原价。成果没入库或不许改编答 `400 adapt`，这时按原价再调一次 | 流水 note 写「改编自《…》 5 折」。联调脚本第 10、11 步：`node scripts/workshop-spend-check.mjs --uid <uid> --work <学坊成果 id>` |
| 15 | 钱包页两行 | 工坊个人页的钱包：`GET /api/points/of?uid=`（带密钥）一次取齐：`points` 与 `quota.left` 两行余额（「积分 N」「园所额度 N · 来自 quota.orgName」）；`sections` 四栏小计按顺序渲染（学与贡献 / 互动 / 工具扣减 / 教学物料商城，各带 label、n、count）；`history[]` 每笔带 `group`（归哪一栏）、`tool`（显示名）、`note`、`n`（正入负出）、`at`，`sub === 'quota'` 的是从园所额度扣的，前面标「园所额度」；`links.mall` 就是「换教学物料」入口地址（`mallHint` 是按钮文案）。**不做**充值、转赠、排行，也不自己算余额 | 教师在工坊看到的余额与学坊「我的」一致（同一份算法）。学坊联调脚本第 9 步把这几项都验了：`node scripts/workshop-spend-check.mjs --uid <uid>` |

## 四、顺序建议

1. 第 1、2、3、5 条先上（能分享就行），4、6、7、8 同一周补齐。
2. 第 12、13、15 条第二批：积分扣减上线前先用园所额度池给试点园充值，避免老师第一次用就被拦。
3. 第 9、10、11、14 条第三批。

## 五、联调要的东西

- 学坊测试环境地址与一枚投稿令牌（学坊侧出）；`TOOLS_API_KEY`（学坊运维出，只给工坊服务端）。学坊运维发密钥的做法：`openssl rand -hex 32` 生成，写进学坊服务端环境变量 `TOOLS_API_KEY` 重启，用安全渠道交给工坊服务端一个人；换密钥就换环境变量重启，工坊同步换，旧的即刻失效；测试环境与正式环境各一枚。
- 工坊给学坊：课程工作台地址格式、下载地址有效期、`courseId` 规则。
- 测试账号：同一个 `uid` 在两边都能登录的教师账号一个、园长账号一个。

### 两个联调脚本

学坊仓库 `scripts/` 下，Node 18 以上直接跑，不装依赖；根目录 `package.json` 也挂了 `npm run check:share` / `check:spend` / `check:workshop`（两个连跑）/ `price`，参数跟在 `--` 后面。每步打印请求、应答与判定，最后一行 `PASS n/n` 或 `FAIL`，退出码 0 / 1，可以放进工坊的 CI。两个脚本都只动测试账号，交上去的课园长不同意就留在「等园长同意」，不进库。

| 脚本 | 验哪几条 | 要什么 |
|---|---|---|
| `workshop-share-check.mjs` | 第 1–8 条：令牌自检、四栏表词表、六种字段错误、提交、署名一句、带 id 重交、查状态，18 步 | 学坊地址 ＋ 一枚教师的投稿令牌 |
| `workshop-spend-check.mjs` | 第 9、10、12–15 条：握手、查余额、扣减、重复 ref、超额、字段校验、钱包页整包、报价、改编半价、开改编课前核对来源，28 步 | 学坊地址 ＋ `TOOLS_API_KEY` ＋ 教师 uid |

**分享（第 1–8 条）**

```bash
ACADEMY_URL=https://<学坊测试环境> ACADEMY_TOKEN=cla_… npm run check:share
```

等于 `node scripts/workshop-share-check.mjs`。

`ACADEMY_TOKEN` 是教师在学坊「设置 → 接口令牌 → 新建一枚投稿令牌」建的。另有一枚只读令牌时加 `--readonly-token cla_…`，顺带验它该被怎么拒（自检 `ok:false`、投稿 `403 readonly`）。

**积分、钱包与改编来源（第 9、10、12–15 条）**

```bash
ACADEMY_URL=https://<学坊测试环境> TOOLS_API_KEY=… npm run check:spend -- --uid <教师 uid> --work <学坊成果 id>
```

等于 `node scripts/workshop-spend-check.mjs --uid … --work …`。两个一起：`ACADEMY_URL=… ACADEMY_TOKEN=… TOOLS_API_KEY=… npm run check:workshop -- --uid … --work …`（`--` 后的参数只传给第二个脚本，分享脚本不要参数）。

- `--uid` 传平台账号的 uid（统一登录）或学坊的 `user.id` 都行，`404 uid` 是这位教师还没登过学坊。
- `--work` 给一门入库且允许改编的学坊成果 id，用来验改编报价、半价扣减与开课前核对（第 9、10、14 条）；不给就跳过那几步并说一句。
- 账户余额不够 10 分时扣减那步走 409 分支，脚本仍算通过，但要看完整效果先让测试教师学几关或请园长分配园所额度。
- 只算价不连学坊：`npm run price -- pbl 4 --adapted`（即 `node scripts/workshop-spend-check.mjs --price pbl 4 --adapted`），`priceOf()` 是工坊算价的参考实现。

**本机开发桩**（学坊开发者自测用，工坊不用管）：学坊 api 用 `DEV_LOGIN=1 TOOLS_API_KEY=tools-secret` 起着，两个脚本分别加 `--dev <姓名>`，自动建账号、建令牌、推 3 关攒分；积分脚本再加 `--admin <本机 db 里的管理员姓名>` 可以顺带充园所额度。

**跑出 FAIL 时**：第 0 步 404 是学坊没配 `TOOLS_API_KEY`，403 是密钥不对；分享脚本第 1 步 401 是令牌无效或已撤、`ok:false` 是粘了只读令牌。其他失败把那步打印的请求与应答发给学坊这边。
