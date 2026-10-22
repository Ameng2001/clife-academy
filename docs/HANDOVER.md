# 幼师学坊 移交文档（2026-10-22）

给接手的产品与技术两边看。读完这一份能知道：这是什么、代码在哪、怎么跑、规则是什么、做到了哪、还差什么、谁来定。细节不重复写，每节末尾指到对应文档。

## 一、这是什么

幼师学坊是幼儿园教师的专业发展平台，柳州首发，配套柳州市学前教育数智服务平台交付，产品线名「幼师学坊」，柳州实例叫「龙城幼师学坊」，技术署名 C-Life。

和它配对的是教研工坊（jiaoyan.clife.cn，课程研究工具）。两件产品一个闭环：

```
幼师学坊 学（PGC 路径）────积分────▶ 教研工坊 做（起草 → 确认 → 用）
     ▲                                              │
     └──── 课程成果（UGC：改了什么、用过有效）◀──────┘
```

- 学坊：教师按岗位、领域、阶段走关，记积分；在工坊做过、班里用过的课分享回来成为课程成果；专家案例、名师讲堂、斗课、合集都在这边。
- 工坊：教师输入一句话，管线起草一门课，教师逐步确认。积分是它的工具使用额度。
- 判断权：学坊是园长同意、审核人入库；工坊是教研主任。

两边分工与闭环：`docs/POSITIONING.md`。产品全貌与排期：`docs/ROADMAP.md`。

## 二、仓库与目录

只有一个仓库：`clife-academy`，github.com/Ameng2001/clife-academy（私有）。学坊代码、微信小程序、方案与契约、工坊分享增量全在里面。教研工坊引擎本身是另一件产品，不进本仓库。

```
api/            Node 原生 http，无框架。server.js 装路由；api/academy/ 42 个业务模块，每个导出 'METHOD /path' 映射
api/test/       36 个 academy 测试文件（node --test）
api/openapi.yaml  232 条接口，每加一条接口同步一条
frontend/       React 19 + Vite + Zustand。src/academy/views 40 个页面，src/lib 纯函数（带测试）
miniprogram/    微信小程序，原生，16 页（home paths level lessons checkup district studio live drill contest library local me growth community mall）
                utils/ 每个业务一个文件，config.js 里是 API_BASE；根目录 project.config.json 给微信开发者工具
workshop-share/ 教研工坊「分享到幼师学坊」的参考实现，只放与学坊有关的增量（设计、share_academy.py、skill、配置模板、V3 按钮 patch）。
                线上版 jiaoyan.clife.cn 是另一支团队照它做
mcp/            只读 MCP 桥，园长与教育局用自己的 LLM 客户端查看板
web/            nginx，托前端、反代 /api
scripts/        dev.sh / local.sh 本地启停；lessons-source.html 课程数据源，import-lessons.py 与 gen-mp-data.py 从它生成网页与小程序两份课程数据；mp-render.mjs 小程序页渲 html；两个工坊联调脚本
docs/           见第十节文档索引；docs/proposal/ 三份对客契约、继续教育学时说明、微课样片、本移交文档的 Word 与 PDF、导出脚本
data/           本地开发数据（db.json、state-<uid>.json、uploads/、audit.log、secret），不进 git
```

基底是开源项目 openGym（AGPL-3.0），健身业务已剥离，保留的是账号、同步、Coach 流水线、管理台。为什么选它、哪些模块保留重写：`docs/MIGRATION.md` 一到四节。许可证义务见该文第七节，上线前法务过一眼。

## 三、怎么跑

本地：

```bash
cd api && npm ci --omit=optional && npm test
cd frontend && npm ci && npm test
sh scripts/local.sh start      # api :3000 + vite :5173 后台跑，日志在 .local/
```

`local.sh` 默认开 `DEV_LOGIN=1`（名字加岗位直接进，只许本机）、`ALLOW_GUEST=1`，两个本地管理员，`TOOLS_API_KEY=dev-tools-key`。开发数据在 `./data`。

小程序：微信开发者工具打开仓库根目录的 `project.config.json`，勾掉「校验合法域名」，`utils/config.js` 指向本机 3000。还没有 AppID，`WX_APPID` 一到手先做真机联调（见第十一节）。

部署：`docker-compose.yml` 两容器（api 与 nginx），`.env` 从 `.env.example` 抄，`./data` 就是全部数据，备份它即可。`secret` 丢了所有人下线。配置项全部在 `.env.example` 里带注释，学坊自己加的那一段在文件末尾（微信、平台登录、事件回传、订阅消息、积分、工坊、答疑模型）。

## 四、工程约定

- 前端只有 React、Router、Zustand；api 依赖个位数；不引框架。
- 「决定下一关是什么」「读回一次学习记录」这类逻辑一律是 `lib/` 纯函数，旁边带测试；前后端各一份的用表驱动 parity 测试钉住。
- 每个 api 模块文件头有一段注释：数据结构、谁能做什么、为什么。改模块先读那段。
- 每加一条接口：openapi 一条、测试一条。
- 每晚的改动记在 `docs/MIGRATION.md` 第八节「进度记录」，倒序，到夜 84。要查某个功能为什么这样做，先搜这里。
- 课程数据 `frontend/src/lib/lessons-data.js` 由 `scripts/import-lessons.py` 生成，不手改；追加的路径在 `lessons-extra.js`。
- 提交信息中文，`feat(柳州):` / `fix(柳州):` / `docs:` 前缀。

## 五、角色与登录

| 角色 | 字段 | 能做什么 |
|---|---|---|
| 教师 | `academy.role = teacher` | 走关、交作品、投案例与成果、答题 |
| 园长 | `director` | 本园看板、同意本园作品、授本园称号、分配园所额度、主持园内赛 |
| 区县管理员 | `district` | 区县看板、主持共同体赛 |
| 管理员（本地运营方） | `admin: true` 或 `ADMIN_UIDS` | 运营后台 `/admin`、审核入库、充值额度、发公告、建工作室 |
| 点评人 | `academy.reviewer = true` | 点评实践关作品、加资源、主持园内赛 |
| 审核人 | `academy.curator = true` | 案例与成果入库 |

登录三条入口，开关由环境变量定：微信小程序、平台账号（ticket 或 oauth2）、开发桩。岗位与园所以平台为准，每次登录刷新。详见 `docs/AUTH.md`，给平台接口人的契约 `docs/PLATFORM-AUTH.md`。

接口令牌：用户在「设置」里建，`cla_` 开头。只读令牌给 MCP 桥；投稿令牌只能调六条投稿接口，给工坊和 Agent。令牌不入库明文，撤了即失效。`docs/SUBMIT-TOKEN.md`。

## 六、功能总览

按模块列，每个只一句，细节看 `docs/ROADMAP.md` 对应节。

- **路径与关卡**（一、二节）：16 条路径 105 关，按岗位（5）、领域（6）、阶段（入职、骨干、管理）、区县管理员、工坊做课编。每关讲、看、做、测；「做」分工具关（平台事件判通）、实践关（交证据加点评）、研讨关（作答加点评）。
- **能力地图** `/map`（五节）：七领域各一个状态，只给本人看，不打分。
- **证书与认证**（五节）：领域研修证书、骨干教师认证、继续教育学时回填。
- **专家案例** `/cases`、**课程成果** `/works`、**合集**、**教研共同体** `/community`（六、七节）：案例走园长同意再审核入库；成果必须写「在起草稿上改了什么」；改编带来源链；轻形态（家长会课件、改前改后卡、记忆卡）由案例生成。
- **名师讲堂** `/lectures`（六节）：一场变一个包，预习卡、切片、海报。
- **斗课、情景练兵、荣誉称号**（七节）：园内赛、共同体赛、市级展示三级，不评分不排名。
- **积分、商城、园所额度**：平台唯一资产，学与贡献自动记，花在工坊工具额度和教学物料商城；园所额度池园长分配、工具先扣额度后扣积分。钱包页只在工坊。`docs/POINTS-DESIGN.md`。
- **Coach** `/coach`：按学习记录排一学期，AI 提议人确认；答疑助手；口径库十条红线进所有提示词。
- **园长看板** `/org`、**区县看板** `/district`、**园所应用体检** `/checkup`、**点评时效** `/ops`（八节）。
- **运营后台** `/admin`：六组数字加入口，公告，用户停用，邀请码，审计。
- **MCP 只读桥** `mcp/`：园长与教育局用自己的 LLM 客户端查进度。
- **小程序** 16 页：五个 tab（首页、路径、微课、共同体、我的），其余二级页。

## 七、对外接口与契约

| 对方 | 契约 | 状态 |
|---|---|---|
| 柳州数智幼教平台：登录 | `docs/PLATFORM-AUTH.md`，ticket 或 oauth2 二选一 | 学坊侧已实现，待平台填「待对齐」一节 |
| 平台：实操事件回传 `POST /api/events` | `docs/PLATFORM-EVENTS.md`，闭合事件清单 | 学坊侧已实现，`PLATFORM_EVENTS_KEY` 待交换 |
| 微信：登录与订阅消息 | `docs/AUTH.md`「订阅消息」，三类事件触发，无定时催学 | 待 `WX_APPID` / `WX_SECRET` 与模板 ID |
| 教研工坊：分享到学坊 | `docs/WORKSHOP-SHARE.md`（契约）、`docs/WORKSHOP-SHARE-DESIGN.md`（设计） | 学坊侧已齐，工坊线上版待做 |
| 教研工坊：积分与钱包 | `docs/WORKSHOP-TODO.md` 第 12 到 15 条，`docs/WALLET-TODO.md`；给工坊同学的整理版 `workshop-share/教研工坊-钱包接口增量.md` 与 `wallet-openapi.yaml` | 学坊侧已齐（`TOOLS_API_KEY` 握手），工坊待做 |
| Agent（Claude 等）：替教师整理成果 | 公开 Skill `GET /skill/share-work.md`，投稿令牌 | 已上线 |
| 全部接口 | `api/openapi.yaml` 232 条 | 与代码同步 |

工坊线上版要做的 15 条和钱包 14 条，学坊侧全部已齐，两个联调脚本（分享 18 步、消费 31 步）可以直接对着工坊跑：

```bash
npm run check:workshop
```

## 八、产品红线与口径

写进代码的，改之前先看 `api/academy/policy.js`（十条，`GET /api/policy`，`/policy` 页）：

1. 不用数字产品生成观察记录或评价幼儿；幼儿不对屏；不做陪伴聊天类；不讲留痕迎检。
2. 素材里不出现真实幼儿姓名、正脸、健康信息。
3. 不排名、不比人；能力地图只给本人看，不作考核依据。
4. 积分不是货币：不可转赠、不排行、不奖签到、时长、浏览、点赞；商城只卖教学物料。
5. AI 只起草，人确认；Agent 不替教师写「改了什么」，不替教师点提交，不替教师注册账号。
6. 工坊不替学坊建账号；令牌不入库明文，不提交进 git。
7. 平台不发物质奖励；称号必须写理由，线上只记录。

对客材料口径（给产品）：产品线名用「幼师学坊」；不写元叙述；不出现册号与脚本名；运营主体写本地运营方，不写数联直接运营；天津项目是非典型个案不作对标。温州六维度是唯一园所建设框架。

## 九、测试与联调

| 套件 | 命令 | 现状 |
|---|---|---|
| api 学坊测试 | `cd api && node --test test/academy-*.test.js` | 93 通过 |
| api 全量 | `cd api && npm test` | 17 个失败是上游 openGym 的 jobs、coach、openapi-parity，与学坊无关，已逐个比对确认；接手后可以删上游测试或修 |
| 前端 | `cd frontend && npm test` | 133 通过 |
| 工坊联调 | `npm run check:workshop`（需 api 开 `DEV_LOGIN` 与 `TOOLS_API_KEY`） | 本机全过 |
| CI | `.github/workflows/api.yml` 三个 job | 工作流已写好本机验证过，GitHub Actions 被账号计费挡住没跑过；计费解决后 push 即跑 |

## 十、文档索引

| 文件 | 看什么 |
|---|---|
| `docs/ROADMAP.md` | 产品全貌：能力框架、关卡形态、内容、评估、共同体、互动、看板、运营、排期、待决策、懂了鸭对照、与工坊分工 |
| `docs/MIGRATION.md` | 为什么用 openGym、模块取舍、数据模型、排期、工程约定、许可证、**逐夜进度记录** |
| `docs/POSITIONING.md` | 工坊与学坊怎么分工 |
| `docs/POINTS-DESIGN.md` | 积分规则、价格、额度池、商城 |
| `docs/AUTH.md` `docs/PLATFORM-AUTH.md` `docs/PLATFORM-EVENTS.md` | 登录与事件回传契约 |
| `docs/SUBMIT-TOKEN.md` | 投稿令牌 |
| `docs/WORKSHOP-SHARE.md` `docs/WORKSHOP-SHARE-DESIGN.md` | 工坊分享到学坊的契约与设计 |
| `docs/WORKSHOP-TODO.md` `docs/WALLET-TODO.md` | 工坊线上版要做的 15 条与钱包 14 条，学坊侧状态与联调脚本用法 |
| `docs/KNOWLEDGE-TREE-DESIGN.md` | 教师发展树设计稿（未做，待定四件事） |
| `docs/upstream/` | openGym 原文档 |
| `mcp/README.md` | MCP 桥怎么接 |
| `docs/proposal/` | 三份契约的对客版、继续教育学时回填说明、微课样片、本文的 Word 与 PDF |
| `workshop-share/` | 工坊分享到学坊的设计与参考实现 |

## 十一、现状与待办

**已做**：ROADMAP 一到十四节里的功能项全部完成，十三节懂了鸭对照六条完成，十二节待决策里平台能定的全部定了并写进代码。网页 38 条路由与小程序 16 页 10-22 做过一轮回归截图。

**待办，按谁来做分**

技术：
1. 真机联调：拿到 `WX_APPID` / `WX_SECRET` 后，配合法域名，跑微信登录、订阅消息三个模板、小程序 16 页真机过一遍。
2. 平台对接：和平台接口人填完 `PLATFORM-AUTH.md`「待对齐」一节，交换 `PLATFORM_EVENTS_KEY`，用闭合事件清单联调。
3. 工坊线上版：`WORKSHOP-TODO.md` 15 条与 `WALLET-TODO.md` 14 条，学坊接口已齐，两个脚本当验收。
4. CI 计费解决后让 `api.yml` 跑起来；顺手处理上游 17 个失败测试。
5. 生产部署：域名与 HTTPS、`.env`、`./data` 备份策略、模型密钥（Coach 与答疑）。
6. 许可证：AGPL 义务确认（MIGRATION 第七节）。

产品与运营：
1. ROADMAP 十二节还开着的四件外部事：市教研员审定哪几条路径、点评的工作量与报酬、称号与市级展示的背书、激励经费。
2. 教师发展树（`KNOWLEDGE-TREE-DESIGN.md`）要定四件：条目照抄与否、叶子谁定稿、先做哪两个领域、师德不进树。定了技术按文内顺序做，第一步是内容工作。
3. 内容：七领域乘四阶段的课程地图还有空格；案例库存量；名师讲堂排期；教学物料商城的货。
4. 直播供应商：平台只认链接，按预算选。

**排期**：MIGRATION 第五节原定 11-20 上线保健医与园长路径，Coach 对园长先开。人力按方案三人：后端一、前端含小程序一、内容一。

## 十二、已知问题与坑

- `scripts/mp-render.mjs` 第二个参数是页名（`home`）不是路径，小程序目录要传绝对路径：`node scripts/mp-render.mjs "$PWD/miniprogram" home out.html '<登录 json>'`。它是看版式用的近似渲染，真机为准。
- 网页 860 宽以下走窄屏布局带底部 tab，1100 是桌面布局；查版式先列路由再批量截图。
- `DEV_LOGIN` 只能本机开；生产 `.env` 不要有它。
- 本地 `data/` 里有演示数据（赵园长、王老师等），不是真实用户。
- api 全量测试的 17 个失败见第九节。
- 工坊投稿令牌只在工坊运行机的 `.workshop/config.yaml`，不能提交进任何仓库。

## 十三、移交清单

| 项 | 现持有 | 交给 |
|---|---|---|
| GitHub 仓库 clife-academy 的权限 | Ameng2001 | 技术负责人加协作者 |
| `TOOLS_API_KEY` | 本机开发值，生产未生成（`openssl rand -hex 32`） | 技术，学坊与工坊各配一份 |
| `WX_APPID` / `WX_SECRET` / 订阅消息模板 ID | 未申请 | 运营方申请，技术配置 |
| 平台登录与事件回传密钥 | 未交换 | 平台接口人与技术 |
| Coach 与答疑的模型密钥 | 未配生产 | 技术 |
| 域名、HTTPS、服务器 | 未定 | 技术与运营方 |
| 柳州实例品牌文案（`BRAND_*`） | `.env.example` 示例 | 产品确认 |

交接人：仓库 owner（GitHub Ameng2001）。本文随仓库走，改了代码记得改这里的现状一节。
