# 从 openGym 到「教师 Coach」：大课堂 MVP 迁移方案

2026-10-21。蓝本：https://github.com/DuarteSantos8/openGym（v1.4.1，AGPL-3.0，Node 22 ＋ React 19，调研时 14,163 stars）。本文件是代码迁移的工作底稿，对应方案正文「实施排期」一节。

## 一、为什么它就是教师 Coach

openGym 表面是健身追踪器，骨子里是一个完整的 coach 闭环：

```
计划（每周练什么）→ 引导执行（今天这一节，一步步做）→ 记录（每组做了没做、做到什么程度）
→ 从记录读回（进步了还是卡住了，哪块肌肉该休息）→ 修订计划（AI 提议，人确认）→ 提醒（该练了、漏练了）
```

大课堂做的是同一个闭环，只是对象从「肌肉」换成「岗位能力」：

| openGym | 教师 Coach | 我们已有的对应物 |
|---|---|---|
| 每周训练计划 week / routines | 本岗位学习路径与每周关卡安排 | PATHS 五条路径 34 关 |
| 一次 workout（引导式，带休息计时） | 一关（讲、看、做、测四段） | vLevel 四段页 |
| 一组 set：done / reps / weight | 一个实操事件：平台回传「做了」，测验正确率 | tryPass、event 字段 |
| 进阶策略 progression（linear / double / triple） | 推进节奏：每周几关、测验门槛、补练规则 | 现在固定线性解锁 |
| 疲劳与恢复模型 recovery（半衰期、READY / RECOVERING / FATIGUED） | 技能保持曲线：多久没用会生疏，到期提醒复练 | 无，新增 |
| 1RM 估算 onerm | 岗位能力估值（按已通关卡与测验正确率） | 学分 credits |
| 肌群地图 muscles / BodyMap | 能力地图：账号、健康、膳食、教研、设备、工作台 | SKMAP 六大块 |
| 体重记录 bodyweight | 本园应用体检 12 项探针 | PROBES |
| 起步计划 starter（PPL / 5×5） | 岗位起步路径（保健医、园长先上） | ROLES → path |
| 轮转 rotation（A→B→C 不绑定星期） | 路径按顺序推进，哪天学都行 | prog 指针 |
| PR 检测、徽章 | 岗位徽章、认证资格 | vMe 徽章 |
| 漏练提醒 nudge（三种语气、三天后静默） | 漏学提醒，同样三天后静默 | 无，新增 |
| AI Coach：create / review / debrief | 教师 Coach：开学排路径 / 周回顾调路径 / 单关复盘 | 无，新增 |
| cohort：实例内匿名中位数对比 | 园所间匿名中位数（≥3 园才显示，不排名） | 无，新增（10-22 已做 `academy/cohort.js`） |
| MCP 只读桥 | 园长、教育局用自己的 LLM 客户端问进度 | 改成 HTTP 客户端＋只读令牌（10-22 已做） |
| Admin 面板 | 园长视角、区级视角 | vDirectorHome |

它做了而我们不要的：动作库 5,600 条媒体、杠铃片换算、哑铃组合、心率、Apple Health 导入、进步照片、体测围度、Capacitor 原生壳。

## 二、模块级移植清单

### api/（Node 原生 http，无框架）

| 文件 | 处置 | 说明 |
|---|---|---|
| `server.js`（2,709 行） | **保留骨架，删业务** | `routes['METHOD /path']` 分发、session cookie（HMAC，`DATA_DIR/secret`）、`GET/PUT /api/data` 全量状态同步、`/api/data/rev`、admin 路由、audit.log。删 passkey 注册与登录、media 上传 |
| `durable.js` `rate-limit.js` `queue.js` `verify-error.js` | 原样保留 | 原子写、限流、队列 |
| `sync-stamps.js` | 原样保留 | 字段级合并。小程序与 PC 网页双端离线编辑后合并靠它 |
| `passkeys-store.js` `password.js` | 删 | 换成下面两个适配器 |
| **新增 `auth/wechat.js`** | 新写 | 小程序 `wx.login` code → `code2session` → openid → 用户。按 `device-link.js` 的一次性 code ＋ Bearer token 模式发 token |
| **新增 `auth/platform.js`** | 新写 | 柳州数智幼教平台账号换登录态，取园所、岗位、权限 |
| `device-link.js` | 保留改名 | PC 网页扫小程序码登录，正好是它的「手机配对电脑」反过来用 |
| `nudge.js` `nudge-copy.js` `push-messages.js` | 保留，改规则与文案 | 窗口从 20:00 改为工作日 16:30 离园后；三天静默规则不变；文案三种语气改成「同事、园长、教研员」口吻；推送渠道 Web Push 换为小程序订阅消息 |
| `coach/` 整目录 | **保留流水线，换业务** | 见第三节 |
| `openapi.yaml` | 重写 | 对平台团队的接口契约 |

### frontend/src/lib/（纯函数，每个带同目录测试）

| 文件 | 处置 | 教师版含义 |
|---|---|---|
| `progression.js` | 重写策略体 | 策略：`linear`（通一关解一关）、`paced`（每周 N 关，到周末自动开放）、`gated`（测验 ≥80% 才解锁）、`off`。接口与它一致：纯函数读历史，不存计数器 |
| `recovery.js` | 重写参数，保留模型 | 指数半衰期按技能块设定：晨午检类 14 天、月报类 45 天、年度体检类 180 天。三档：熟练 / 需复习 / 已生疏。生疏触发复练关 |
| `onerm.js` | 重写 | 能力估值 = Σ(关卡权重 × 测验正确率 × 保持度)；首期只做展示，不排名 |
| `finish-workout.js` | 重写为 `finish-level.js` | 一关结算：记 passedAt、学分、徽章、是否触发下一关或复练；日志只追加 |
| `rotation.js` `queue.js` | 保留 | 路径顺序推进 |
| `starter.js` | 用我们的 PATHS 替换 | 五条岗位路径就是 starter plans |
| `exercises.js` 及 `exercises-data.js`、`exercise-muscle-*` | 删，换 `lessons.js` | 微课库：34 关 ＋ 场景微课 ＋ 本地专区，字段沿用 L()/Q() |
| `muscles.js` `body-paths.js` | 改为 `skills.js` | SKMAP 六块能力地图 |
| `bodyweight.js` `measurements.js` | 改为 `checkup.js` | 12 项探针，园级聚合数 |
| `nudge.js` `coach*.js` `sync-*.js` `api.js` `i18n*.js` `format.js` | 保留 | 其中 coach 的 payload 分类改名见下 |
| `plates.js` `dumbbells.js` `bar.js` `incline.js` `speed.js` `health-*.js` `import-*.js` `fit-export.js` `scan*.js` `qr.js` | 删 | 健身专用 |

### frontend/src/views/

| openGym 视图 | 大课堂视图 | 现有原型对应 |
|---|---|---|
| Home | 首页：今天这一关、本周进度、体检一眼看 | vHome |
| Plan / RoutineEdit | 学习路径与关卡安排 | vPaths、pathPanel |
| Workout | 关卡页（讲看做测） | vLevel、stage |
| Stats / History | 我的：学分、徽章、学习记录 | vMe |
| Library | 场景微课 ＋ 资料库 | vLessons、vLibrary |
| Muscles | 能力地图 | SK / SKMAP |
| Measurements / bodyweight 卡 | 本园体检 | vCheckup |
| CoachChat / CoachIntake / CoachSetup | 教师 Coach 对话、入学问卷、园长配置 | 新增 |
| Admin / AdminCoach | 园长视角、区级视角 | vDirectorHome |
| StructuralBalance | 园所岗位均衡：五个岗位进度是否偏科 | 新增，园长视角 |
| CheckIn、ProgressPhotos | 删 | |
| Login | 微信登录 / 平台账号登录 | 新增 |

另有 vLive（园长大讲堂）、vDrill（情景练兵）、vLocal（本地专区）三个视图 openGym 没有对应物，照现有原型直接做。

### mcp/（后置）

保留整个只读桥，工具换成 `list_paths`、`get_progress`、`get_checkup`、`skill_balance`、`list_levels`。园长或教育局在自己的 LLM 客户端里直接问「全区保健医路径通关率」。

## 三、教师 Coach：三个任务、一张闭合变更清单

openGym 的 Coach 流水线（`api/coach/core/pipeline.js`）照用：**payload 白名单 → 系统提示词字节不变（缓存前缀）→ 结构化输出 JSON schema → 校验器是唯一边界 → 一次修复机会 → 客户端应用、可一键回滚**。只换四样东西。

### 1. payload 分类（`categories.js`）

```
plan      路径、关卡安排、推进策略
learning  实操事件、测验结果、通关记录、每关用时（窗口 12 周或 60 关）
checkup   本园 12 项探针的园级数值（无任何幼儿数据）
profile   入学问卷：岗位、入职年限、每周可用时长、带班数、顾虑
cohort    可选：其他园的匿名中位数（≥3 园）
prefs     语言、提醒时间
```

永久排除：姓名与用户 id、登录凭证、幼儿任何字段、班级名册、其他教师的任何数据。消费前的「数据同意页」从这同一个数组渲染，页面与 payload 不会漂移。

### 2. 变更类型闭合清单（`validate.js` 的 CHANGE_TYPES）

| type | target | after |
|---|---|---|
| `add-level` | pathId | `{ levelId, position? }`：插入复练或补充关 |
| `skip-level` | pathId, levelId | `null`：已在平台实操验证过的关直接记通过 |
| `reorder` | pathId | 全部 levelId 的新顺序 |
| `pace` | pathId | 每周关数 1–5 |
| `policy` | pathId | `linear` / `paced` / `gated` |
| `schedule` | weekday | pathId 或 `null`：建议固定学习日 |
| `review-due` | levelId | ISO 日期：到期复练 |
| `add-drill` | — | 情景练兵 id：建议参加 |
| `watch-probe` | probeId | `{ reason }`：提醒园长关注某项探针 |

每条变更必须带 `why` 且引用 payload 里的证据（哪关测验两次没过、哪项实操两周没做、哪个探针连续下滑），没有证据的拒收。Coach 只能动路径与安排，不能改学习记录、不能改体检数、不能写任何对幼儿的评价。

### 3. 三个任务的提示词（`prompts/*.md`）

- **create（开学排路径）**：从 profile 排一条首学期路径；每周时长约束；已有平台操作记录的关标记跳过。
- **review（周回顾）**：读 learning 窗口与 checkup，判断路径是否要调。一关不是趋势；少于三关记录只允许 `review-due` 和 `watch-probe`。没有证据就 `nochange`。
- **debrief（单关复盘）**：只读不改。一关的分数（1–10）、做得好的、要注意的、下一关怎么做。不评价人，只评价这一关的学习。

### 4. 模型提供方

它已支持 Anthropic / OpenAI / Gemini / **任意 OpenAI 兼容端点**。柳州要求数据不出境，走兼容端点接通义千问（DashScope 兼容模式）或 DeepSeek，或者本地 vLLM。系统提示词字节不变 ＋ 启动预热缓存这套做法，对本地小模型特别有用。

### 5. 合规对照（见记忆「2026 幼儿园数字产品政策底线」）

- Coach 的输入输出都不含幼儿数据，payload 在代码层面按名复制，不可能夹带。
- cohort 只给中位数，不排名、不点名；三园以下不显示。
- debrief 评的是「这一关的学习」，不是教师考核；提示词与校验器两层禁止评价人。
- 体检探针是园级运行指标，不是对幼儿或教师的评价。

## 四、数据模型（S 的教师版）

```js
S = {
  // 身份与偏好（prefs）
  lang:'zh', remind:{ day:[1,3], time:'16:30', nudge:true, tone:'colleague' },
  // 计划（plan）
  role:'nurse', paths:{ nurse:{ policy:'paced', pace:2, order:[...levelIds] } }, week:{},
  // 学习记录（learning，只追加）
  sessions:[ { d:'2026-11-03', levelId:'nurse-6', start, end, segs:{jiang,kan,zuo,ce}, quiz:{right:3,of:3}, events:['obs.saved'] } ],
  progress:{ 'nurse-6':{ passedAt, credits:1, reviewDue:'2026-11-17' } },
  // 园所（checkup，园级）
  checkup:[ { d:'2026-11-01', probes:{ attendance:0.98, morning:1, ... } } ],
  // Coach
  coachProfile:{ years:2, hoursPerWeek:1, classes:1, concerns:'...' }, coach:{ history:[...], declined:[...] },
  // 其他
  tickets:[], drills:{}, live:{}
}
```

与 openGym 一样：客户端单一状态，localStorage 持久化，签到后 debounce 推 `PUT /api/data`，`sync-stamps` 字段级合并。小程序侧 `wx.setStorageSync` 等价。

## 五、MVP 排期（11-20 上线）

| 周 | 日期 | 做什么 | 验收 |
|---|---|---|---|
| 1 | 10-22 → 10-31 | fork，剥离健身业务；`api` 保留骨架；微信登录与平台登录两个适配器；`GET/PUT /api/data` 跑通；把 `academy.body.html` 数据块变成 `lessons.js`；小程序 10 页改走接口 | 保健医、园长两条路径在小程序登录后能看、能通关、换手机进度不丢 |
| 2 | 11-01 → 11-12 | `POST /api/events` 平台实操回传（闭合事件清单）；`finish-level.js` 结算；体检探针定时拉数；nudge 改小程序订阅消息；PC 网页扫码登录 | 第 6 关「全日观察已保存」由平台事件自动判通；漏学提醒按规则发 |
| 3 | 11-13 → 11-19 | Coach：payload 改分类、变更清单、三份提示词、校验器；接通义千问兼容端点；入学问卷；园长配置卡；内测 | 周回顾对三周内测数据给出 ≤6 条有证据的建议，无证据时 `nochange` |
| 上线 | 11-20 | 保健医、园长路径；Coach 对园长先开 | |
| 后置 | 12 月起 | recovery 复练模型、cohort 园所对比、MCP、认证报名、其余三条路径 | |

人力：后端 1 人、前端（网页 ＋ 小程序）1 人、内容 1 人，与方案正文三人团队一致。

## 六、工程约定

- 独立代码仓库（建议名 `clife-academy`），不放本文档仓库；本目录只留方案、原型与样片。
- 沿用它的硬约束：前端只有 React ＋ Router ＋ Zustand；api 依赖个位数；任何「决定下一关是什么」或「读回一次学习记录」的逻辑都是 lib 纯函数，旁边带测试。
- 保留它的 parity 测试模式：`modeOf` 之类前后端各一份时用表驱动测试钉住。
- Node 22、Docker 两容器（api ＋ nginx），`./data` 即备份。

## 七、许可证（记一行，不作障碍）

AGPL-3.0 的义务是：对通过网络使用软件的用户提供修改后的源码。基于它改出来的教师 Coach 属于衍生作品，无论改动多少。两条路：接受开源（教育局项目通常不排斥，还可作为「开放协作」卖点）；或只搬架构与概念、代码重写（第二至四节的设计不依赖任何一行它的代码）。11 月上线前定一次即可。

## 八、进度记录

- **2026-10-21** 开仓。基底 openGym v1.4.1（e348fc1）。剥离移动壳、动作库工具、CI；上游文档移 `docs/upstream/`。
  导入 34 关课程数据；`lib/lessons.js`、`lib/finish-level.js` 带测试。
  新壳 `src/academy/AcademyApp.jsx`＋首页、路径、关卡、我的四个视图，接在上游 store、登录、同步之上；
  `S` 增 `role / progress / sessions / credits / lvDraft`，随 `PUT /api/data` 整体同步，`mergeStates` 已验证保留这些字段。
  浏览器走通：访客进入 → 第 1 关讲看做测 → 通关 → 游标推进 → 我的页出记录与学分。
  `scripts/dev.sh` 一键起 api＋vite。
  **待办（第 1 周内）**：微信与平台登录适配器替换上游 Login；`progress`/`sessions` 需要自己的合并规则（只追加、按 levelId 取 passedAt 最早），
  现在跟整块状态走「新的赢」；上游健身视图与 lib 逐步删除；`lvDraft` 不该推服务器（`update(…, false)` 只是不触发推送，草稿仍在 S 里）。
- **2026-10-21（下午）** 登录三条入口：`api/auth/wechat.js`（code→openid）、`platform.js`（ticket→档案，岗位别名表）、`routes.js`（建档、发 session、cookie＋token）、
  `DEV_LOGIN` 开发桩；`/api/config` 出 `auth` 块，`/api/me` 带 `academy`；`api/test/auth.test.js` 6 项。前端 `src/academy/views/Login.jsx` 替换上游登录页，
  登录后 `S.role` 取服务端岗位。浏览器验证：开发桩以园长身份登录 → 首页岗位、姓名、我的页正确，服务端 `state-<uid>.json` 落了 progress。
  说明在 `docs/AUTH.md`。平台契约待与平台团队对齐。
- **2026-10-21（晚）** 进度合并与草稿只留本地。`lib/academy-merge.js`：`progress` 取并集、同关卡取 `passedAt` 最早；`sessions` 按 id 并集、按结束时间排序；
  `credits` 由 `progress` 推导，不再各自同步；`lvDraft` 从 `S` 移除，合并时一并剔除。挂进 `lib/sync-merge.js`（`OWN_MERGE` 登记四个字段，`localExtras` 多出 `levels`）。
  草稿改走 `lib/level-draft.js`（localStorage `academy_drafts_v1`，`useDraft(id)` 订阅），通关即清；不进 `S`、不进 `PUT /api/data`。
  登录接管：`runAdopt` 的询问条件加上 `extras.levels`，`askAddDeviceData` 出中文弹层「把这台设备上通过的关卡记到账号里？」。
  浏览器验证：访客通过 nurse-0、留 nurse-1 草稿 → 以已有 director-0 的账号登录 → 弹层确认 → 本地与服务端均为 `director-0 + nurse-0`，学分各 1，草稿仍在本地、服务端无 `lvDraft`。
  测试：`academy-merge.test.js` 9 项、`level-draft.test.js` 3 项；api 契约测试 13 项通过。
- **2026-10-21（晚 2）** SyncBanner 的「登录」指到大课堂登录页。`components/SyncBanner.jsx` 加 `signIn` 属性，宿主替换登录动作（不传仍走上游 passkey / Settings）。
  `AcademyApp.jsx`：访客点它 → 退出访客态 → Login；已登录但服务端不认这个浏览器（`sync.status === 'auth'`）→ 临时让页面给 Login，登上去自动回应用。
  Login 收 `relogin`：出「登录已过期」提示、藏「先看看」。浏览器验证两条：访客点横幅 → 登录页；重启 api 清掉会话后刷新 → 登录页带过期提示 → 重新登录 → 回首页、横幅消失。
- **2026-10-21（夜）** 删上游健身视图与 lib。先从 `main.jsx` 做静态 import 可达分析，删掉不可达的 412 个文件（`views/`、`App.jsx`、
  动作名与说明的语言包、健身弹层测试等）；再把三个拖着整套健身 lib 的枢纽换成大课堂自己的：`academy/sheets.jsx`（确认框＋登录时那一问）、
  `academy/components/SyncBanner.jsx`（中文状态条，`signIn` 由壳指定）、`academy/views/Settings.jsx`（外观、账号、同步、关于，退出登录带「还有改动没同步」确认），
  随后再删一轮不可达的 92 个文件。`src/` 从 668 个文件减到 148 个；`vite build` 通过，前端 52 个测试文件 943 项全绿，api 契约测试 13 项通过。
  浏览器验证：访客横幅中文、点「登录」到登录页；开发桩登录后设置页显示姓名、岗位、园所、同步时间；退出登录回登录页，服务端会话已清。
  **还留着的上游件**：`store/useStore.js`（1,990 行，同步引擎，连着 media、health、remote、rotation 等 lib）和 `lib/exercises.js`＋动作数据（store 的 `registerCustom` 还引着，
  打包出 1 MB 的 exercises chunk）。下一步是给 store 做减法：去掉健身字段与 media/health 分支，`exercises` 随之可删。
- **2026-10-21（夜 2）** store 减法，exercises 随之删除。`store/useStore.js` 重写为 400 行：一份 S 存 localStorage，
  推（PUT，baseRev/baseWid 条件写，409 合并再推）、拉（修订号移动才取整份）、每 30 秒查修订、登录接管三条路（账号为空直接推；同一账号重登当两台设备合并；
  换账号问「本地关卡记到账号里？」）、退出时欠着的改动按账号留在本地。去掉多标签页接力、手机文件镜像、媒体、健康、旧版抬升。
  `lib/academy-merge.js` 接管 `mergeStates` / `localExtras`（设置跟 _ts 新的一方，进度三字段走并集）；`lib/api.js`、`store/useUI.js`、`ErrorBoundary.jsx`、`main.jsx` 重写成只剩需要的；
  `accent.js` 不再依赖 format.js；ui.jsx 去掉 i18n。再删一轮不可达文件：exercises 数据、sync-merge、media、health、remote、i18n、locales 等 100 个。
  `src/` 45 个文件；构建 337 kB（之前 1 MB 的 exercises chunk 没了）。测试：`store/useStore.test.js` 对着内存假服务端跑 9 项（推、拉、409、三条接管路、过期重登、强制退出留存）；
  `api/test/academy-state.test.js` 证实没有 workouts/routines 的文档也能走 /api/data，409 带回现文档。前端 14 个文件 125 项、api 14 项全绿。
  浏览器验证：访客通过 nurse-0、留草稿 → 登录已有 director-0 的账号 → 弹层 → 两端并集、学分各 1、草稿仍在；设置页退出 → 登录页，localStorage 只剩空状态与草稿。
  localStorage 键名改为 `academy_*`。
  **还留着的**：public/sw.js 没再注册。（capacitor、jsqr、lean-qr 依赖已于 10-22 卸掉。）
- **2026-10-22** 小程序接登录与同步（工程在文档仓库 `…/学前大课堂/app/miniprogram/`）。`utils/api.js` 带 Bearer 的 `wx.request` 封装；
  `utils/auth.js` 微信登录（code → `/api/login/wechat`）、`/api/me` 换新 token、退出、改岗位；`utils/sync.js` 与网页端同一份进度文档、同一套合并规则，
  PUT 条件写、409 并集、回前台查修订；登录接管时演示进度丢掉、本机真通过的关问一句。`utils/store.js` 改为从文档现算游标与学分，四段草稿只留本机；
  「我的」页登录/退出，顶栏显示「岗位 · 姓名」。api 新增 `PUT /api/me/academy`（自己改岗位；平台账号 403），`auth.test.js` 7 项。
  用 Node 顶替 `wx` 对着真 api 跑了一遍接口层：访客通关 → 微信登录只问真通过的那关 → 改岗位 → 网页端写入 → 回前台拉取 → 再通关 409 并集 → 退出回演示态。
  未做：微信开发者工具里的真机联调（需要 WX_APPID/WX_SECRET 与合法域名）；平台登录态在小程序内的接法等平台契约。
- **2026-10-22（下午）** 对齐平台登录契约。调研结论：成交资料里没有平台或基座的身份接口文档，只知道平台账号是手机号＋验证码、三端共用、
  基座有「统一身份与权限」子系统；现有适配器假定了一个自造的 ticket 核验接口与固定字段名，平台未必照此。于是写 `docs/PLATFORM-AUTH.md`
  （文档仓库同步《平台登录对接契约.md》）给平台接口人：两种方式（一次性票据 / OAuth2 授权码）、档案五字段与岗位对照、网页与小程序回跳、
  失败码、配置项、七条待对齐问题。`api/auth/platform.js` 相应改成可配：`PLATFORM_AUTH_MODE`，`PLATFORM_FIELDS` 点路径取字段、`PLATFORM_OK` 判外包业务码、
  `role` 可给数组；oauth2 模式 `exchangeCode`（code → token → userinfo），`platformLoginUrl()` 拼授权地址。`/api/config.auth` 多 `platform_mode`。
  `Login.jsx` 认 `?ticket=` 与 `?code=&state=` 两种回跳（路径式 `/login/platform` 与 hash 式都认），state 存 sessionStorage 校验。
  小程序 `auth.loginPlatform/ticketFrom`，`app.js` 启动与回前台读 `extraData.ticket` / `query.ticket` 换会话。`api/test/auth.test.js` 加外包业务码与 oauth2 两项，17 项全过。
  **待办**：拿到平台答复后填契约第 7 节、按第 6 节配参数、用测试账号跑一遍；平台注销联动与学习记录回传另立接口。
- **2026-10-22（下午 2）** 卸掉前端无用依赖：capacitor 全家（core/app/filesystem/share/local-notifications、mlkit 扫码、secure-storage、android/ios/cli/assets）、
  jsqr、lean-qr，锁文件同步。`web/Dockerfile` 去掉拷 `api/coach/core/` 的一步与 capacitor postinstall 的说明，只拷 frontend/。
  构建与 120 项测试照常。
- **2026-10-22（下午 3）** `scripts/build-coach-assets.mjs` 去掉动作库生成（源 `exercises-data.js` 已删），只生成 prompts.js；
  `library-data.js` 标为冻结快照，`build-coach-library.mjs` 别名删除。`--check` 通过。
  已知：`api/test/coach-limits.test.js` 有 2 项在此之前就失败（上游健身 coach 的排队与评审逻辑），与本次无关，coach 改业务时一并处理。
- **2026-10-22（晚）** 写 `docs/ROADMAP.md`（第二稿）：平台重定为面向教师专业发展的能力培养平台，以《幼儿园教师专业标准》七个能力领域 × 四个发展阶段为课程地图，
  现有 34 关工具线归入领域；关卡「做」分工具关（平台事件）、实践关（证据提交＋点评）、研讨关（情景题）三型；
  含资源、评估（三方评、三级认证）、教研共同体、四级看板、运营、数据与接口变化、B–E 期排期。文档仓库同步《迭代方向-教师发展平台.md》。`POST /api/events` 的调研已做完（34 个事件名由课程包生成），实现放到下一步。
- **2026-10-22（夜）** `POST /api/events` 平台实操事件回传。`scripts/build-academy-events.mjs` 从课程包生成闭合清单 `api/academy/events-data.js`（34 项，`--check`）；
  `api/academy/events.js`：平台密钥（`PLATFORM_EVENTS_KEY`，timingSafeEqual）单条或批量 ≤100，按 `platform.uid` 找人，幂等按 `id` 或 `(event, ref)`，每人最多 2000 条；
  `DEV_LOGIN=1` 时本人可自回传（演示按钮）；`GET /api/events?since=`；`/api/config.events = { platform?, demo? }`。
  网页：`lib/events.js` 纯函数（按事件名对照关卡）、`store/useEvents.js`（按账号缓存，换账号清空），`Level.jsx` 的「做」由事件判通、停在「做」时每 10 秒拉一次，结算记 `ev:<id>`。
  小程序：`utils/events.js`，`store.zuoDone()`，关卡页 `watchEvents()` 轮询并自动通关。契约 `docs/PLATFORM-EVENTS.md`（文档仓库同步《平台实操事件回传契约.md》）。
  测试：api 3 项（20 项全过）、前端 +3（123）、小程序 harness +5；浏览器验证：平台账号登录 → 第 1 关「等待平台回传」→ curl 平台密钥回传 → 10 秒内变「平台已回传」。
- **2026-10-22（夜 2）** 园长看板（ROADMAP B 期第一项，大课堂自身数据）。`api/academy/org.js`：`GET /api/org/summary`，园长或管理员，按 `academy.org`（id，缺则 name）圈本园成员，
  `summarize()` 纯函数按岗位给人数、完成、在学、平均关数、完成率、本周通关、卡人最多的关（补训建议）；人员列表只有关数与最近学习日，无测验分。
  课程索引（`PATH_LEN/ROLE_PATH/PATH_NAMES/LEVELS`）并入 `build-academy-events.mjs` 的产物。网页 `views/Director.jsx`（`/org`），首页园长看到「园长看板」瓦片；
  小程序首页园长块登录后改取真实汇总，未登录仍是演示数。测试：api +2（22 全过）、harness +2。浏览器验证：三个同园账号加一个外园账号，看板只计本园 3 人。
  探针体检卡仍占位，等平台数据接口。
- **2026-10-22（夜 3）** 微课库与搜索（ROADMAP B 期）。`lib/library.js` 纯函数：全部 34 关按岗位 × 场景筛，关键词搜标题、目标、步骤、平台菜单路径、按钮名、场景，
  多词逗号分隔须同时命中，标题命中排前，`snippet()` 给命中处摘要；5 项测试（前端 128 全过）。`views/Library.jsx`（`/library`，底栏第三个标签），
  筛选与关键词进 URL 便于分享；未解锁的关能进关卡页看「讲」「看」，页顶提示通关仍按路径顺序。小程序 `utils/library.js` 同一规则，`pages/lessons` 加搜索框与命中摘要。
- **2026-10-22（夜 4）** 关卡三种类型与证据提交（ROADMAP B 期）。课程包：`lib/lessons-extra.js` 手写领域路径（`obs` 观察与评价，首期两关：实践关「事实与推断」、研讨关「家长问孩子今天怎么样」，带 `type`、`evidence`、`prompt`、`rubric`、`refs`），
  `lib/lessons.js` 把它与生成的 `lessons-data.js` 合并，`levelOf` 出 `type` / `needsEvent` / `needsSubmission`，`ROLE_PATH_KEYS` 与 `PATH_KEYS` 分开（首页「各岗位进度」只列岗位路径，领域路径另起一段）。
  `finish-level.js` 的 `canPass`：要事件或要提交的关，「做」没完成不能结算。服务端 `api/academy/submissions.js`：`POST/GET /api/submissions`、`GET /api/review/queue`、`POST /api/submissions/review`、`GET /api/submissions/file`；
  实践关交了进 pending，点评 pass 才算「做」完成，revise 必须写意见、可再交；研讨关交了即 pass，交过以后能看同园他人作答；点评权＝园长、管理员、`academy.reviewer`，只看本园、不评自己；
  证据照片走上游 media 存储（`PUT /api/media/{hash}` 存在提交者名下），本园点评人经 `/api/submissions/file` 读。`build-academy-events.mjs` 改走 `lessons.js`，另生成 `LEVEL_TYPES`、`RUBRICS`。
  前端：`store/useSubmissions.js`、`views/SubmissionBox.jsx`（关卡页「做」的实践 / 研讨分支：文字＋照片、状态卡、点评、同园作答）、`views/Review.jsx`（`/review` 点评队列，量表 1–5 分＋意见；园长看板与首页有入口）、`lib/upload.js`（sha256 ＋ PUT）。
  测试：api 4 项新增（`academy-submissions.test.js`）、前端 128 全过。小程序：`utils/extra.js` 同源的领域路径由 `gen_mp_data.py` 合进 `data.js`（`ROLE_PATHS`、`PATH_META`），`utils/submissions.js`，关卡页「做」按类型分支（先交文字，照片在网页端），harness 25 项。
- **2026-10-22（夜 5）** 「沟通与合作」领域路径（ROADMAP 第三节「家长工作六件事」）。`lessons-extra.js` 加 `comm` 六关：接园时的一句话反馈（研讨）、家长会的前十分钟（实践，交开场稿）、
  一次个别约谈（研讨）、群里公开质疑（研讨）、孩子可能需要专业帮助时（研讨，教师不诊断）、一次家园活动的设计（实践，交方案）。场景 → 技能块加 `EXTRA_SKMAP`（family），`lessons.js` 合并。
  措辞守 2026 年口径：不点名、不分档、不比较；群里只收不辩；特殊需要只说事实与频率，评估的决定留给家长。全部 42 关，前端 128 项全过；小程序 `extra.js` 同步，harness 25 项。
- **2026-10-22（夜 6）** 小程序订阅消息（ROADMAP B 期最后一项）。`api/academy/notify.js`：两类事件触发的模板（`review` 点评结果通知教师、`queue` 新提交通知本园点评人），
  一次性额度记在 `db.subscriptions`，`GET /api/notify`、`POST /api/notify/subscribe`（可带 wx.login code 给平台账号绑 openid）；access_token 缓存、过期重取一次、43101 清零；
  字段按微信规则截断，映射走 `WX_TMPL_*_DATA`。`submissions.js` 在实践关提交后与点评后调 `notifier.send`，失败只记日志。没配模板时路由不存在。
  小程序 `utils/notify.js`：实践关提交后问一次 `review`，首页园长块按钮订阅 `queue`。api 4 项新测试（微信桩含 token 过期与拒收），harness 27 项。待真机：在公共模板库选模板、填 ID 与字段映射。
- **2026-10-22（夜 7）** 点评人指定界面。`PUT /api/org/reviewer`（`api/academy/org.js`）：园长或管理员给本园成员标 / 去 `academy.reviewer`，不能标自己、不能跨园；
  `academyOf` 把 reviewer 带给客户端，`/api/org/summary` 的人员行带 `reviewer`。网页 `/org` 本园人员每行一个「设为点评人 / 取消」。org 测试加 1 项。小程序首页园长块只有岗位汇总没有人员行，指定仍在网页端做。
- **2026-10-22（夜 8）** 能力地图（ROADMAP 第五节，C 期第一项）。`lib/capability.js` 纯函数：《专业标准》七个领域各一个状态（有证据 / 在做 / 还空着），
  证据三类：工具关通过、实践关作品通过点评、研讨关作答；工具关按内容归入领域（health/food/sleep/sport → 一日生活，teach → 教育活动计划，场景「观察记录」→ 观察评价，family → 沟通与合作），
  账号、设备、工作台这类平台操作不属于专业领域、单列「平台工具」；领域路径走完标「领域研修证书可申领」。没有分数条、不和他人比。
  `views/CapabilityMap.jsx`（`/map`），「我的」页顶一行七个领域的状态入口；`useSubmissions.loadAll()` 取本人全部提交。4 项测试（前端 132 全过）。
  小程序 `utils/capability.js` 同一规则，「我的」页加能力地图段；harness 29 项。环创、游戏、反思三领域还没有内容，显示「内容建设中」。
- **2026-10-22（夜 9）** 带教配对（ROADMAP 第六节，C 期）。`api/academy/pairs.js`：`db.pairs`，园长或管理员在本园配对（`PUT /api/org/pairs`，被带教的人只有一个带教教师、新配对结束旧的；`POST /api/org/pairs/end`），
  `GET /api/me/pair` 给本人看带教关系。`submissions.js` 的点评权扩到带教教师：队列只给所带的人的提交（`scope: 'mentees'`，行带 `mentee`），能点评、能读证据文件；
  新提交的订阅消息也发给带教教师。网页：园长看板「带教配对」段（列表、结束、两个下拉配对），首页「带教」段（新教师看带教教师是谁，带教教师点进点评队列），点评页标「带教」。
  小程序「我的」页显示带教关系，点评仍在网页端。api 测试 1 项（12 个断言），harness 30 项。
- **2026-10-22（夜 10）** 资源库（ROADMAP 第四节：文献与政策、模板与工具；案例库另做）。`api/academy/resources.js`：`db.resources`，`GET /api/resources`（内置教育部文件 `resources-seed.js` + 本园与公开上传，
  没登录只看公开的；`?q=&kind=&domain=`），`POST /api/resources`（加：管理员、园长、点评人；改删：本人、本园园长、管理员；公开范围只有园长与管理员能设），`POST /api/resources/delete`，`GET /api/resources/file`。
  文件走上游 media（只收图片与短视频），文档类贴链接。内置五份教育部文件只放核对过能打开的原文地址，《评估指南》原文页已下线、先指到基础教育司文件列表。
  网页 `/resources`（微课库页顶入口），关卡「讲」里「依据的条文」按书名跳到资源库。小程序资料页改接接口，连不上回落演示资料。api 测试 2 项，harness 31 项。
- **2026-10-22（夜 11）** 案例库（ROADMAP 第四节）。`api/academy/cases.js`：`db.cases`，教师自荐 `POST /api/cases`（标题、领域、年龄班、用法「可直接用 / 需改编 / 只看思路」、正文 ≥ 50 字、照片）→ 状态 `consent`，本园园长 `POST /api/cases/decide {consent}` 同意后转 `pending`，审核人（`academy.curator`，管理员经 `PUT /api/cases/curator` 指定；管理员自身也可）`approve` 入库、`reject` 必须写意见；退回的本人改了再交自动回到待同意。园长从已通过的实践关、研讨关作品推荐（带 `submissionId`，作者仍是提交者，附件沿用提交文件），直接进待审核。`GET /api/cases` 只给已入库且要登录（实名共享），`?q=&domain=&age=&use=`；`/mine`、`/queue`、`/delete`、`/file`。
  网页 `/cases`（资源库与微课库页顶入口；点评页已通过作品上有「推荐入案例库」预填表单）。小程序资料页加「案例」分类，登录后能看、点开读全文，分享与审核在网页端。api 测试 2 项，harness 32 项。学分（分享入库得 2 学分）还没接，等勋章与学分一起做。
- **2026-10-22（夜 12）** 园长大讲堂（ROADMAP 第四节）。`api/academy/lectures.js`：`db.lectures`，管理员 `POST /api/lectures` 排场（标题、主讲、适合、开播时间、时长、直播链接、回放链接、讲义链接或一张图、要点），`GET /api/lectures` 谁都能看（`upcoming` 含正在直播、`done` 回放），`POST /api/lectures/book` 预约（登录；结束的不能），`/delete`、`/file`。提醒：notify.js 加 `lecture` 模板种类（`WX_TMPL_LECTURE`），server 每分钟跑 `tick()`，开播前 30 分钟给预约且订阅过的人发一条，每人每场一次，改了开播时间重发；没配模板只记名。
  网页 `/lectures`（排场表单只有管理员看得到；首页多一张下一场的卡，能直接预约）。小程序「大讲堂」页与首页卡改接接口，连不上回落演示场次；预约时顺手问一次 `lecture` 订阅；直播、回放、讲义链接复制后到浏览器或腾讯会议打开。api 测试 2 项，harness 34 项。
- **2026-10-22（夜 13）** 研讨关每周一题（ROADMAP 第六节）。`api/academy/drills.js`：`db.drills` 与 `db.drillAnswers`。出题 `POST /api/drills`（管理员面向全平台，园长只面向本园；题干、背景、岗位、领域、开放与收题日，默认七天），`GET /api/drills`（开放中、往期；出题人另见未开放的），作答 `POST /api/drills/answer`（≥ 20 字，一人一份、改了算最新，收题后还能晚答），`GET /api/drills/answers`（同园、先答再看；点评人与带教教师例外；精选在前；人数只给本园），点评 `POST /api/drills/review`（一句意见＋精选，没有分数与排名，作答人收一条 review 订阅消息），`/delete` 连作答一起删。
  网页 `/drills`（本周一题、作答、同园回答、点评与精选；出题表单只有管理员与园长看得到），首页多一张本周题的卡。小程序「情景练兵」页改名「每周一题」、接接口，没登录或连不上回落演示题；首页卡同步。点评在网页端。api 测试 2 项，harness 35 项。优秀作答进案例库、作答得学分还没接：前者等案例库加「从作答推荐」，后者等学分。
- **2026-10-22（夜 14）** 荣誉、学分与积分（ROADMAP 第七节）。`api/academy/honors.js`：学分台账 `db.credits`（案例入库 +2、研讨作答精选 +2，同一来源只记一次）；勋章按记录算不存（成长：每条路径完成；贡献：案例 1/5/20、精选 1/5、点评 20 次、带出一人），`GET /api/me/honors`；荣誉称号 `db.titles`，园长授本园、管理员授任何人、必填理由、不能授自己，`GET/POST /api/org/titles`、`/revoke`，称号显示在案例与研讨作答署名旁。`points.js`：学分兑积分 `POST /api/me/points/exchange`（`POINTS_PER_CREDIT` 默认 10，可兑 = 关卡学分 + 台账 − 已兑），积分是教研工坊、观察评价工具、贝果实验室的使用额度，工具服务端带 `TOOLS_API_KEY` 调 `GET /api/points/balance`、`POST /api/points/spend`（幂等，余额不够 409），管理员 `GET /api/points/of` 对账。案例库加 `POST /api/cases/used`「用过，有效」（数只给作者、本园园长、管理员看）与从研讨作答推荐（`answerId`）；大讲堂排场可记展示的案例 `caseIds` 与颁发的称号 `titleIds`。
  网页 `/honors`（我的页学分格点进去：学分与积分、兑换、称号、两类勋章、学分明细），园长看板每人「授称号」与已授列表，案例卡「用过，有效」，每周一题作答「分享到案例库」、精选作答园长「推荐入案例库」，大讲堂表单选展示案例与颁发称号。小程序「我的」页：学分含台账、积分与兑换、称号、勋章（替代原岗位徽章格）。api 测试 3 项（荣誉 2、积分 1），harness 37 项。ROADMAP 第七节「不设虚拟货币」一句改为学分兑积分的口径。
  没做的：证书类勋章（领域研修证书、七领域都有证据）等认证期次；「点评被标有帮助」「答疑被采纳」等答疑功能；斗课本身（出题、应战、互评）是单独一套，没动。
- **2026-10-22（夜 15）** 斗课园内赛首期（ROADMAP 第七节「线上斗课」）。`api/academy/contests.js`：`db.contests` 与 `db.contestEntries`。主持人（园长、点评人、管理员）`POST /api/contests` 出题（月份、主题、年龄班、活动名、目标、《指南》条目、领域、截止与互评日，默认两周截止再一周互评；截止可改到过去＝提前收稿），`GET /api/contests`、`/one`；教师 `POST /api/contests/enter` 应战（设计 ≥ 100 字、片段走 media、一句反思；应战期内可改；应战期间别人看不到设计）；截止后 `POST /api/contests/rate` 同园互评（五项量表 1–5 ＋ 一句话，实名，不评自己，一人一份），分数只给作者本人与主持人（平均分），别人看不到；主持人 `/group`（默认按报名顺序 3–4 人一组）、`/review`（每组一段同课异构对照 ≥ 50 字）、`/select`、`/close`（全部作品直接入案例库：入选标「同课异构 · 月 · 年龄班」用法「需改编」，其余标「参赛作品」只看思路；对照文字随案例正文；每份 +2 学分）、`/file`。
  网页 `/contests`（列表、出题、应战含片段上传、作品列表按组、打星互评、作者看评价、主持人编组 / 对照 / 入选 / 提前截止 / 收官），首页进行中擂台卡，案例卡显示斗课标签。小程序新页 `pages/contest/contest`（列表、文字应战、看作品、打星互评；片段与主持在网页端），首页卡。api 测试 1 项（覆盖全流程），harness 38 项。
  没做的：共同体赛、市级展示（跨园编组要区县管理员）；大讲堂展示入选作品用现有 `caseIds` 勾选即可。
- **2026-10-22（夜 16）** 探针体检卡（ROADMAP 第八节园长视图；迁移方案 checkup）。`api/academy/checkup.js`：12 项探针定义（键、平台给什么数、阈值、文字、推哪一关，`GET /api/checkup/probes`），11 项平台回传 `POST /api/checkup`（`PLATFORM_EVENTS_KEY` 或管理员；单园或 ≤ 50 园批量；一园一周一条按键覆盖；留 26 周），「学习」由 `summarize()` 自算（各岗位路径是否都开学）。`buildCard()` 纯函数出卡：本周状态与文字、近 4 周色块、同一项连续两周需关注 → 推荐对应岗位的关（设备走本地专区报修）、新上线园所前两周只开三项。`GET /api/org/checkup` 园长看卡，`GET /api/me/checkup` 成员只拿本岗位推荐。契约写进 `docs/PLATFORM-EVENTS.md` 第 7 节（文档仓库《平台实操事件回传契约》同步）。
  网页 `/checkup` 全卡、园长看板「本园应用体检」段改成真卡（需关注的排前、取 5 项，点标题进全卡）、首页体检瓦片与「本园体检推给你的关」段。小程序体检页园长登录后取真卡、没登录演示数；首页按岗位显示推荐。api 测试 2 项，harness 39 项。Coach payload 的 checkup 类别仍从客户端状态读，接 `GET /api/org/checkup` 等 Coach 改园长视角时一起做。
- **2026-10-22（夜 17）** 区县管理员路径与区县看板（ROADMAP 第八节「区县」行、第六节跨园共同体、迭代排期 C）。岗位多一个 `district` 区县管理员（`api/auth/platform.js` ROLES 与别名：区县管理员、教育局、教研员、学前科、教师发展中心），账号多一个 `academy.district:{id,name}`（平台字段 `district.id` / `district.name`，可缺；开发桩登录填区县；区县管理员没有园所）。课程包多一条管理阶段路径 `district` 6 关（`lessons-extra.js`：读区县看板、园所数与覆盖口径、建跨园共同体、组织共同体赛、读体检汇总、数据边界；`EXTRA_ROLES`、`EXTRA_META.kind:'admin'`；`lessons.js` 的 `ROLE_PATH_KEYS` 含管理路径、新增 `ADMIN_PATH_KEYS`）。`events-data.js` 多 `LEVEL_DOMAIN`（关卡→七领域键）、`DOMAINS`、`PATH_KIND`；`org.js` 的园长看板分组只取 `PATH_KIND` 为 role 的岗位（`ORG_ROLES`），区县管理员不进园所分组。`api/academy/district.js`：`db.orgDistricts`（手工挂接）；一所园属于区县 D 当其成员带 district D 或被挂接。`GET /api/district/summary`（区县管理员本区、管理员 `?district=`）给园所名单（按名称，无数字）、园所数、在学人数、走完岗位路径人数、领域认证人次、本周通关、各领域覆盖率中位数与岗位路径完成率中位数（不足 3 园为 null）、共同体活动（斗课场次、研讨作答、入库案例、大讲堂预约）、体检汇总（接通回传的园数、本周有需关注项的园数，不列名）；`GET/PUT /api/district/orgs`、`POST /api/district/orgs/remove`。
  网页 `/district`（区县管理员首页瓦片进；开发桩登录表单多区县一栏），首页「各岗位进度」不列管理路径除非是本人路径。小程序 `pages/district`（演示数回落）、首页区县入口、`utils/district.js`、`extra.js` 带 `ROLES` 与 `PATHS.district`、`auth.js` 岗位键加 district。
  没做的：跨园共同体建组与共同体内共享（案例库、联合研讨）、共同体赛跨园编组——先用 `db.orgDistricts` 的名单，下一步在它上面建组。
- **2026-10-22（夜 18）** 跨园共同体建组（ROADMAP 第六节）。`api/academy/communities.js`：`db.communities`（区、组名、2–6 所本区园、组长园、备注），一园一组；`createCommunities(db)` 给 cases.js / drills.js 查「某园在哪个组」。区县管理员（本区）或管理员：`GET /api/district/communities`（组名单＋本区未编组的园）、`POST /api/district/communities`（建或改）、`POST /api/district/communities/delete`（解散，面向它的联合研讨题一并删）；任何成员 `GET /api/me/community`（名单、组长园、共同体案例数、联合研讨题数）。共享两样：案例库 `GET /api/cases?community=1` 只看组内各园入库的案例（答复多 `community` 字段）；联合研讨题——区县管理员在每周一题里出题时指定共同体（`scope:'community:<id>'`，`postScope:'community'`），组内各园看得到、答了看得到各园作答，人数按组算，区县管理员不用答也看得到作答；点评仍按园（本园园长 / 点评人 / 带教教师），不跨园给意见。`district.js` 抽出 `districtOrgsOf`、`districtOf`、`isDistrictAdmin` 供复用。
  网页：区县看板多「跨园共同体」段（建组：组名、从未编组的园里点选、组长园、备注；改组；解散），每周一题出题表单在区县管理员下多「选共同体」、题目与作答列表标「共同体 · 组名」，首页「跨园共同体」段（点进共同体案例）。小程序：区县页列各组、首页共同体卡、`utils/district.js` 加 `communities` / `myCommunity`，建组只在网页端。
  没做的：共同体赛（跨园编组的斗课）、组内园长互看彼此园的任何数（设计上不做）。
- **2026-10-22（夜 19）** 共同体赛（ROADMAP 第七节三级赛制的第二级）。`api/academy/contests.js` 加 `level:'org'|'community'`：区县管理员在斗课里面向本区一个共同体出题（`communityId`；`GET /api/contests` 多 `hostScope`、`communities`），共同体各园教师看得到、能应战，作品带园名；主持人是本区区县管理员（不应战、不打分）；截止后自动编组改为跨园：按园轮流取人，每组 3–4 人里尽量是不同园；互评跨园；收官入库标「共同体赛 · 月 · 年龄班」，案例带 `communityName`，在 `?community=1` 里能看到。不公布各园入选数、不按园统计。
  网页 `/contests`：区县管理员出题表单多「选共同体」，卡片标「共同体赛 · 组名」，作品名后带园名，编组按钮叫「跨园编组」。小程序列表与作品同样带标与园名。
  没做的：市级展示（名师工作室主持）。
- **2026-10-22（夜 20）** 证书类勋章与认证期次（ROADMAP 第五节「认证」、第七节成长勋章）。`api/academy/certificates.js`：三级——岗位数智应用认证（走完本岗位工具路径、测验正确率 ≥ 80%，自动）、领域研修证书（走完一条领域路径、实践关作品全部通过点评，自动＋点评记录）、骨干教师认证（三条领域研修证书＋一份入库案例＋线下答辩，按学期开班）。条件判断是纯函数 `earnedOf`，读本人时才把达到条件的前两级写成 `db.certificates` 一行并给编号 `CL-年-五位`；`GET /api/me/certificates`（证书、三级进度、七领域证据数、开着的期次）、`GET /api/certificates/verify?no=`（公开核验，姓名脱敏，只回证书名与日期）、`GET /api/org/certificates`（园长看本园，只有人名、级别、日期）。期次 `db.cohorts`：管理员 `POST /api/cohorts` 开班（学期、报名窗口、答辩时间地点），`POST /api/cohorts/apply` 报名（窗口内且条件达到），`POST /api/cohorts/result` 记答辩结果（通过即发骨干教师认证），`POST /api/cohorts/close` 结班。`honors.js` 成长勋章加四类：岗位数智应用认证、各领域研修证书、七领域都有证据、骨干教师认证。区县看板多 `certificates:{tool,domain,backbone}` 计数。
  网页 `/certs`（我的证书、三级条件与进度、期次报名、证书核验；管理员开班与记结果）、`/certs/:id` 单张证书可打印存 PDF；荣誉页成长勋章旁入口；园长看板「本园证书」段。小程序「我的」页多证书与期次一段，能报名；`utils/certs.js`。
  没做的：继续教育学时证明导出格式（要等市里认可的格式）；发展档案整体导出。
- **2026-10-22（夜 21）** 答疑：问种子教师 ＋ 答疑助手（ROADMAP 第六节「问种子教师」；AI 只做整理，不做陪聊答疑）。产品形态是带上下文的助手，不是聊天框：每关底部「问一问」，问题带关卡；提交后助手立刻（1）整理：归类、找本园与共同体里相似的已答问题、本关要点与引用条文、相关案例；（2）起草：接了模型时只依据这些材料起草回答，标把握（高 / 低）与引用编号；（3）分流：进本园种子教师 / 园长 / 点评人与带教教师的队列，两个工作日没人答转本地讲师（管理员；`escalateDue` 每 10 分钟跑一次，跳过周末）。草稿不算回答：种子教师「确认」（可改）后才署名成为回答；提问人「采纳」一条回答或标「已解决」。`api/academy/questions.js`（`db.questions`；`GET/POST /api/questions`、`/similar`、`/one`、`/answer`、`/confirm`、`/accept`、`/close`），`api/academy/assistant.js`（模型出口：先 `ASSISTANT_PROVIDER / BASE_URL / API_KEY / MODEL`，否则用 Coach 管理台接的 HTTPS 模型；没配就只整理不起草），`events-data.js` 多 `LEVEL_INFO`（关卡目标、步骤、引用，给助手当材料）。贡献勋章加「答疑被采纳 10 次」。系统提示里写死：只依据材料、不生成观察记录、不评价幼儿、超范围交人工。
  网页：关卡页底部「问一问」（本关我的提问、本园已答的、输入时相似提示）、`/questions`（我的提问 / 待我回答；助手整理卡带材料折叠；确认草稿、回答、采纳、已解决），首页答疑段。小程序关卡页答疑段接接口（我的提问带助手概括与回答、采纳、已解决；没登录仍记本地），`utils/questions.js`。
  没做的：「点评被标有帮助」（点评 20 次且有帮助的勋章条件）；答疑时效看板（每周运营节奏里的「答疑队列清零」只能看队列数）。
- **2026-10-22（夜 22）** 名师工作室与市级展示（ROADMAP 第六节「名师工作室」、第七节三级赛制的第三级）。`api/academy/studios.js`：`db.studios`（管理员建室、定主持人；有骨干教师认证的教师申请，主持人通过或直接加成员，加入即授「名师工作室成员」称号留理由，移出撤；主持人把成员的入库案例收为产出）、`db.showcases`（一个工作室主持，每年一次；候选池是各共同体赛入选作品 ＋ 工作室产出，也可另选任何入库案例；最多 12 件按出场顺序上台；每件一段名师点评，对作品不对人；授「年度分享者」只能授上台作品的作者、留理由；收官后上台案例标 `showcase`，案例库 `?showcase=1` 与「市级展示」筛选条）。没有评分、没有名次、不按园统计。
  网页 `/studios`（工作室列表与申请、主持人管理成员与产出；市级展示建场、上台、点评、授称号、收官），首页市级展示卡，荣誉页与案例库入口。小程序 `pages/studio/`（工作室与展示只读、申请加入；演示数回落），首页入口。
  没做的：市级展示排进园长大讲堂（lectures 的 caseIds 可以勾上台案例，没做自动带入）；工作室内部的共读、观摩活动记录。
- **2026-10-22（夜 23）** 内容路径两条（ROADMAP 第三节）：「教育活动计划与实施」8 关（定目标、选内容、设计环节、准备材料、组织现场、提问与回应、收尾、反思；两份证据：活动设计第二稿——用教研工坊五步管线自检后改的，上一次课 3 分钟片段＋反思）、「环境创设与利用」6 关（看懂现在的区角、材料的层次、幼儿怎么用、调整、观察效果、与主题联动；证据：区角现状照＋说明、前后对比照＋说明）。`lessons-extra.js` 加 `plan` / `env`，关卡三类混用：答题即过的工具关、practice、seminar；practice 的 `evidence.kinds` 首次用到 `video`，`SubmissionBox` 按 kinds 开放片段上传（mp4 / mov / webm，走现有媒体上传与大小限制）。素材规则写进每关：不拍幼儿正脸、不出现姓名、区角照片里没有幼儿。课程包 10 条路径 62 关（工具线 34 ＋ 领域 obs 2 / comm 6 / plan 8 / env 6 ＋ 管理 district 6）；领域研修证书自动多两种，骨干认证的「三条领域证书」条件现在四选三。能力地图里 env、plan 不再「内容建设中」，只剩 play、reflect。小程序 `utils/extra.js` 改为由 `lessons-extra.js` 生成（脚本在会话临时目录，逻辑是整文件 JSON 化），不再手抄。
  没做的：play（游戏活动支持与引导）、reflect（反思与发展）两条路径；教研工坊自检结果自动回传到关卡（现在靠教师截图）。
- **2026-10-22（夜 24）** 发展档案与学时证明（ROADMAP 第五节「发展档案」、继续教育学时）。`api/academy/portfolio.js`：`GET /api/me/portfolio` 把本人全部记录汇成一份 JSON（通过的关含测验对错、实践与研讨作答及点评结论、入库案例、斗课作品与入选、证书、勋章、称号、学分台账、工作室与共同体、答疑被采纳数、预约过的大讲堂；`excluded` 列明不含什么：幼儿数据、AI 中间判断、他人的分与点评），`?download=1` 作为文件下载；网页 `/portfolio` 可打印成 PDF。学时证明：计时规则与证明格式可配（`db.hoursRule`，管理员在同一页改；默认 45 分钟 1 学时，实践关另加 60 分钟，研讨关另加 30 分钟，骨干答辩通过加 240 分钟，大讲堂预约不计，0.5 学时向下取整；标题、出具单位、签发人、说明文字），`GET /api/me/hours` 预览（缺省本学年，9 月 1 日起），`POST /api/me/hours/issue` 出具（同一区间一份，编号 `XS-年-五位`，规则快照随证明保存），`GET /api/hours/verify` 公开核验脱敏，`/portfolio/hours/:id` 打印页。关卡时长进了 `events-data.js` 的 `LEVEL_INFO.minutes`（从课程包的 `dur` 解析）。「我的」页与荣誉页入口；小程序「我的」页一段（本学年分钟与学时、已出具的证明）。
  没做的：市里认可的格式还没拿到，现在是可配的默认版；园所或区县批量出具；档案 PDF 的固定版式（现在是网页打印）。
- **2026-10-22（夜 25）** 「点评被标有帮助」（ROADMAP 第七节贡献勋章）。作品与作答的作者可以给收到的点评标「有帮助」（可取消）：`POST /api/submissions/helpful`、`POST /api/drills/helpful`，写在 `review.helpful`（时间戳）。只有作者能标，点评人看不到谁没标，不公开、不排行。贡献勋章「点评 20 次」改为「点评 20 次且有帮助」：写过 20 次意见，其中至少 5 次被标（`honors.js` `HELPFUL_MIN`），进度条按 20 ＋ 5 计。网页关卡提交框与每周一题「我的回答」下各一个按钮；小程序关卡页与研讨页同样。
  没做的：点评时效看板（每周运营节奏里的那项）。
- **2026-10-22（夜 26）** 点评时效看板（ROADMAP 第八节每周「点评时效看板」、第九节点评队伍）。`api/academy/reviewstats.js` `GET /api/review/stats`：待点评数与最久一条、超两个工作日数（口径同答疑，跳过周末）、近 30 天完成数、从提交到点评的中位时长与两个工作日内完成的比例、点评队伍人数（有点评权的）与近 30 天动过手的人数、答疑队列（开放、已转讲师、首答中位时长）。园长看本园并带待点评队列（最久在前）；管理员看全平台与各园一行，超期多的在前，是工作队列不是名次。不列点评人各自点了多少（只有本人在荣誉页看）。网页 `/ops`，园长看板「点评」段入口；小程序首页园长段一行。
  没做的：时效的周报推送（订阅消息 KINDS 里没有运营类模板）；按关卡或领域拆分。
- **2026-10-22（夜 27）** 领域路径最后两条（ROADMAP 第三节）：「游戏活动支持与引导」6 关（看懂一段自主游戏、介入的时机、介入的方式、材料的调整、游戏后的分享、一段游戏的看与介入；证据：游戏观察与介入决策说明，事实、判断、做法分开写）、「反思与发展」6 关（教研组长路径，阶段标「骨干」：反思从事实开始、把点评变成改法、主持一次课例研讨、带一位新教师、用案例库也往里放、园本课程怎么长出来；证据：一次课例研讨记录）。两条都把平台已有的机制写进课程：点评「有帮助」、带教配对、案例库「用过，有效」、斗课与课例研讨进园本课程。七个领域现在都有内容，能力地图不再有「内容建设中」；课程包 12 条路径 74 关；领域研修证书六种。小程序 `extra.js` 重新生成。
- **2026-10-22（夜 28）** 一日生活与保育 4 关（ROADMAP 第三节）：不单独成路径，接在保健医、保育员两条岗位路径末尾（`care-4…7`、`nurse-12…15`），两条路径共用同一份内容：过渡环节怎么不乱（工具关）、改一次本班的过渡（实践关，交调整说明：改前几分钟、改了哪一处、三天后几分钟）、进餐的组织（工具关：自己取自己吃自己收，不催不比不奖惩，过敏名单不上墙）、午睡的组织（实践关：安静过渡、睡不着的有去处、巡视看呼吸体位、起床不叫醒；睡眠垫数据只给保育员看入睡离床，不给家长看评价）。接在末尾是为了不动已有的关卡序号与进度；`lessons-extra.js` 多出 `EXTRA_APPEND`，`lessons.js` 合并时追加，事件表由构建脚本自动带出（保健医 16 关、保育员 8 关、全库 82 关）。工具线证书照旧按路径走完＋答题正确率算，实践关只要走完即计。小程序 `extra.js` 多出 `APPEND`，`data.js` 合并时同样追加。
- **2026-10-22（夜 29）** 入职与骨干两个阶段的扩展路径（ROADMAP 第一节纵轴、第十一节 D 期）：新增路径种类 `kind:'stage'`，跨领域、不发领域研修证书，每关按场景映射计入对应领域的证据。「新教师入职」`onboard` 6 关：第一周的安全清单、一日常规怎么跟、先学会看（实践关：五分钟只写事实的观察记录＋带教教师一句话）、接园离园的两句话、和带教教师约定第一个月、第一个月回看（实践关）。「主题与项目课程」`backbone` 6 关（阶段「骨干」）：主题从哪来、主题网络与目标、项目的驱动问题、一周的推进与调整、项目的记录与展示、一个主题的完整设计（实践关：三周设计含调整记录）。首页多一段「阶段路径」，学习路径页按 `PATH_META.stage` 标「入职阶段 / 骨干阶段」；贡献勋章「带出一个人」改为带教的新教师完成入职路径或本岗位路径任一即计。课程包 14 条路径 94 关。小程序 `extra.js` 重新生成，路径页同样标阶段。
- **2026-10-22（夜 30）** 一口气补齐 ROADMAP 里没标「已做」的十项，api 各一模块、网页各一页、小程序一页「专业发展」收本人这一侧。
- **2026-10-22（夜 31）** 管理阶段路径（ROADMAP 第一节纵轴「管理」、第十一节 E 期）：「园所管理」`manage` 6 关，阶段「管理」：看懂本园的教师队伍（从园长看板取数，不看个人分）、教研制度怎么定（四件事一页纸，写上三条「不做」）、主持一次教研活动（实践关：交活动记录，评作品不评人）、园本课程从哪来（案例库里长出来，不是买一套）、按《评估指南》做园所自评（用看板的数写事实不写成绩）、本学期自评与下学期三件事（实践关）。首页「阶段路径」只给园长与管理员列这条；Coach 对园长按「管理」阶段排进计划。课程包 15 条路径 100 关。另加 `scripts/local.sh`：api 与前端后台启停、状态、日志（`start|stop|restart|status|log [api|web]`），日志在 `.local/`。
  1. 自评与三方评 `selfreview.js`（`/selfreview`）：学期一份，七领域各一档（还没开始 / 在学 / 能独立做 / 能带别人）＋一件想练的事＋反思；带教教师看作品、园长看参与各写一段，并置不合成；管理员只看人数。
  2. 园所集体荣誉 `honors.js` `orgBadgesOf`（`GET /api/org/honors`，荣誉页一段）：同岗位 ≥ 3 人都走完一条路径；本园案例被外园「用过，有效」10 次。只给本园看。
  3. 练习营 `camps.js`（`/camps`）：管理员或园长办，3–30 天任务；一人一天一帖、只能发到当天、营员互看；退营人与帖一起删；结营记 graduates，`badgesOf` 发「结营 · 营名」。不打卡、不提醒。
  4. 园内教研组 `studygroups.js`（`/groups`）：教研主任（点评人）或园长发任务、可挂入库案例；反思 ≥ 100 字先交再看；谁没交只有出题人看；反思计入七领域「反思」证据与档案。
  5. 研修项目期次 `programs.js`（`/programs`）：管理员建期次（种类、学期、时间、地点、学时、名额）、录取、记完成、收期次；完成的学时进 `hoursOf` 与学时证明、档案。
  6. 园所分享日 `sharedays.js`（`/sharedays`）：区县管理员为本区一个共同体办；各园园长交一页（≤ 8 条本园入库案例＋一段话）；共同体内看，不计票。
  7. 分享者上讲堂 `lectures.js`：`GET /api/lectures/sharers` 管理员看候选（被用 ≥ 3 次或入库 ≥ 3 条或入选，不公开）；`POST /api/lectures/invite` 记为这场的分享者、案例进展示、授「年度分享者」（已有不重复）。大讲堂页加「分享者候选」一段。
  8. 斗课扩展形式 `contests.js` `FORMS`：lesson / env / obs / comm 四种，各有作品名、最少字数、五项量表、入库标签；出题时选形式；环创擂台传对比照。
  9. 运营周报 `weekly.js`（`GET /api/ops/weekly`，`/ops` 与园长看板一行）：上周过关人数与关数、作品、点评、待点评与超期、每周一题、答疑、入库；园长本园、管理员各园一行；周一 09:00 后订阅消息 `weekly` 推一次（`notify.js` 加 kind，`WX_TMPL_WEEKLY`）。
  10. Coach 面向专业发展 `coach.js`（`/coach`，「我的」入口，首页「本周待学」）：证据只有学习记录；plan 16 周每周两关、实践关那周一关，先接停了的线、再补自评最弱领域、入职补入职路径、骨干补主题项目课程；review 看停线（14 天）与反复「改一改」（≥ 2 次）的实践关，变更只有 add-practice、pair；debrief 单关。规则草稿为底，`assistant.js` 接了模型只改措辞不改结构。采用由本人定；采用了的 pair 建议进园长看板 `GET /api/org/coach`，配不配园长定。
  测试 `academy-batch.test.js`、`academy-coach.test.js`；小程序 `utils/growth.js`、`pages/growth/`，首页园长段多一行上周周报。
  没做的：一日生活与保育的「过渡环节」「进餐与午睡的组织」4 关（ROADMAP 说并入保健医、保育员路径，等内容组）；入职与骨干两个阶段的扩展路径。
- **2026-10-22（夜 32）** 运营后台汇总页（ROADMAP 第九节「运营后台」，第十二节第 5 条定为「嵌管理端」，不另做独立后台）：`api/academy/admin.js`，`GET /api/admin/overview` 把管理员要管的事按六组给数字——用户与园所（在用用户、停用、园长、点评人、审核人、区县管理员、园所、共同体、配对中、未用邀请码）、研修期次（报名中期次与待定名单、认证期次、练习营、将开讲堂、展示、分享日）、资源与案例（资源、待审与入库案例、被用次数、工作室）、发题与点评（全平台开着的题、应战中与评审中的斗课、待点评与超期、开着与升级的问题、模型接没接）、公告、审计（24 小时条数与失败数、留存）。前端 `/admin`（首页管理员一块「运营后台」替掉原来两块），每组只给数字与入口，事在各自页面做；用户停用与恢复、邀请码新建与撤销、审计流水只看（复用上游 `/api/admin/*`）在这页直接做，因为它们没有别的页。删用户、清审计不放界面。新加的只有「公告」：`db.notices`，`GET /api/notices` 登录的都看在用的（没到期，最多 5 条），`POST /api/admin/notices` 发改撤；首页顶上一条，不推送、不统计谁看过。测试 `academy-admin.test.js`。小程序没动（公告与后台不进小程序）。
- **2026-10-22（夜 33）** MCP 只读桥（ROADMAP 第十一节 E 期）：上游 `mcp/` 是本机直读 `./data` 的单用户版，不合园长、教育局远程用的场景，改成 HTTP 客户端——`mcp/src/http.js` 只发 GET，带只读接口令牌；`tools.js` 15 个工具（whoami、课程目录两个本地读、我的进度与荣誉、园所五个、区县两个、案例与资源检索、近期安排），园所与区县汇总把服务端给的个人名单再滤一道，只留岗位、人数、中位数；没有写工具。令牌在服务端：`api/academy/tokens.js`，`db.apiTokens` 只存 sha256，`cla_<id>.<secret>` 格式，`GET/POST /api/me/tokens`、`POST /api/me/tokens/revoke`，最多 5 枚在用；`server.js` 的 `sessionOf` 认它为 bearer 且不续签，分发处对带它的非 GET 一律 403（`code: readonly`），不进任何路由；账号停用、撤销即失效。网页「设置 → 只读接口令牌」新建（只显示一次）与撤。测试 `api/test/academy-tokens.test.js`、`mcp/test/tools.test.js`（假 fetch）、`mcp/scripts/check-node-loadable.mjs`；本地已用真令牌跑通 stdio 的 initialize / tools/list / tools/call。小程序没动。
- **2026-10-22（夜 34）** 园所间匿名中位数（MIGRATION 第二节「cohort」行、ROADMAP 第十一节 E 期）：`api/academy/cohort.js`，`GET /api/org/cohort` 园长看本园对全市（实例）其他园的一行对照，本区（账号的 district 或手工挂接）另给一行：整体完成率（各岗位按人加权）、各岗位完成率（本园有该岗位、其他园也 ≥ 3 所有才比）、七领域覆盖率（园里至少过一关该领域的人占比）、近 30 天在学占比；本园的数与其他园的**中位数**，其他园 ≥ 3 所才给；只给中位数，不给任何一所别的园的数，不排名、不点名、没有测验分。网页园长看板「与其他园对照」一节；小程序首页园长段一行（整体与在学两项）；MCP 桥加 `org_cohort`。测试 `academy-cohort.test.js`。
- **2026-10-22（夜 35）** 发展档案随人迁移（ROADMAP 第五节「发展档案」随人走、第十一节 E 期）：同一城市换园不用动——`auth/routes.js` 登录时园所变了就把旧园、旧岗位、起止时间推进 `academy.history`，档案「随人走」一节列出来，记录连续。换城市（另一实例）走迁移包：`api/academy/transfer.js`，`GET /api/me/portfolio/package` 把整份档案打成带本实例 HMAC 签名的 JSON 并在 `db.transfers` 记 `{ id, uid, hash }`；`GET /api/portfolio/verify?id&hash` 公开核验（姓名脱敏）；`POST /api/me/portfolio/import` 在新账号下挂进 `db.imports`，本实例发的本地核、别的实例联网到它的 verify 核，联不上记「未核验」，核不上标「核验不通过」；只存精简条目（数量、路径、证书、称号、勋章、案例标题、过关清单 ≤ 200），不存作品全文。迁入的只是档案：不并进进度、不发勋章、不算本实例学时证明。`portfolio.js` 的组装抽成 `createPortfolioOf` 供两边用，档案多 `history`、`imports` 两节。网页 `/portfolio`「随人走」一节：经历、迁入列表（核验状态）、导出迁移包、迁入一份文件。测试 `academy-transfer.test.js`。小程序不做迁入（文件操作留网页），README 注一句。
- **2026-10-22（夜 36）** 运营后台「研修期次」组加一行「学时规则与证明格式」，跳 `/portfolio?rule=1` 并滚到表单；对应给教育局的确认表（docs 仓库 `学前大课堂/继续教育学时认定-回填说明.md`）回填位置。
- **2026-10-22（夜 37）** 讲堂包：`api/academy/lectures.js` 加 `l.pack`（讲稿、预习卡要点 ≤ 5、微课切片 ≤ 6、海报标题＋行），`POST /api/lectures/pack/draft {id,script}` 规则切段生成草稿（小标题行→要点与切片标题，段落→切片简介，接了模型只改措辞不改结构），`POST /api/lectures/pack {id,pack|null}` 改定或删，`GET /api/lectures/clips` 给微课库「讲堂微课」一节；预习卡随场次一直可见，切片与海报讲完（phase=done）才对外，讲稿只管理员看。网页 `/lectures` 卡片显示预习卡、切片（带回放起点秒）、海报，管理员「做讲堂包」内联编辑；`/library` 末尾「讲堂微课」；MCP `upcoming` 带 preview；小程序大讲堂页讲前显示要点、回放下显示切片与海报。ROADMAP 新增第十三节（懂了鸭对照六条）。测试 `test/academy-lectures-pack.test.js`。
- **2026-10-22（夜 38）** 轻形态：`api/academy/forms.js`，db.caseForms，三种 kind（parents 家长会十分钟课件五页、transition 过渡环节改前改后对比卡、memo 《评估指南》条文记忆卡，关键指标按案例领域配在 `GUIDE`）。`GET /api/cases/forms?caseId`、`POST /api/cases/forms/draft {caseId,kind}`（规则只搬正文句子，模型只改措辞；同种再生成是覆盖）、`POST /api/cases/forms {id,content|remove}`、`GET /api/cases/forms/all?kind`。只对已入库案例，作者、审核人、管理员可做，登录可看；署名随案例。网页 `/forms/:caseId`（看、改、打印），案例卡展开后一行「拿来就用」入口。小程序没有案例库，不动。测试 `test/academy-forms.test.js`。
- **2026-10-22（夜 39）** 改编来源链：`api/academy/cases.js` 案例加 `adaptedFrom {caseId,title,byName,note,at}`，`POST /api/cases` 收 `adaptedFrom`（只能是已入库案例、不能是自己这条）与 `adaptNote`；对外 `adaptedFrom`（原案例删了也留标题）、`chain`（往上最多 5 级）、`adaptations`（直接改自这条的已入库案例，实名）；审核入库时改编者不是原作者就给原案例记一次「用过，有效」（备注「改编为《…》」，已记过不重复）。网页案例卡展开后「改编这条」预填来源与底稿，分享表单里一行「改了什么」；轻形态页脚带来源。测试 `test/academy-adapt.test.js`。
- **2026-10-22（夜 40）** 桌面壳与登录前页：≥ 1000px 时底部 tab 藏掉，换顶部导航 `academy/components/TopNav.jsx`（首页、学习路径、微课库、案例库、大讲堂、资源库，按角色加园长看板 / 区县看板 / 运营后台，右侧「我的」与设置）；容器 1200，`.narrow.wide` 页 1100（首页与浏览、看板、后台、队列类页面），学习页仍 640 居中；首页两栏（主栏今天这一关与进度，右栏大讲堂、每周一题、斗课、答疑、共同体、带教、点评队列）。没登录时是 `views/Landing.jsx`：桌面左栏介绍、三条原则、路径目录、下一场大讲堂与回放数（读 `/api/lectures`，不登录也给），右栏是原 Login 卡；手机上只有登录卡。不是门户：案例库与看板仍要登录。样式都在 `academy.css` 断点里，手机一切不变。案例库各列表与大讲堂（下一场之外的场次、回放）在桌面上两列（`.grid2`），展开的案例卡占满两列。全页核对：34 条路由无横向溢出、无遗留固定底栏；园长看板、点评、发展档案、能力地图补上宽栏；chips 在桌面换行不再横滑。学习页（关卡、我的、Coach、自评、证书、设置、拿来就用、口径）保持 640 居中是有意的；学习路径页桌面改两栏：左栏十五条路径竖列表带进度（吸顶），右栏关卡，手机仍是 chips 加单列。
- **2026-10-22（夜 41）** 口径库：`api/academy/policy.js` 十条红线（id、是什么、为什么、管哪里、给模型的一句），`systemRules(ids)` 拼「规矩」段；Coach、讲堂包、轻形态、答疑助手的 SYSTEM 提示改为从它拼（各模块导出 SYSTEM 供测试）。`GET /api/policy` 不登录也给；网页 `/policy` 只读页，运营后台「审计」组一行「平台口径」，登录前页三条原则读它；MCP 加 `policy` 工具（17 个）。改口径只改那一个文件。测试 `test/academy-policy.test.js`。
- **2026-10-22（夜 42）** 投稿令牌：`api/academy/tokens.js` 令牌加 `scope: read|submit`（`POST /api/me/tokens {label, scope}`），`SUBMIT_ROUTES` 三条（`POST /api/cases`、`/api/cases/forms/draft`、`/api/cases/forms`）；`server.js` 分发处按 scope 挡：只读令牌任何写 403 `readonly`，投稿令牌只放那三条、其余 403 `scope`，放行时 `req.apiToken` 带 id 与标签；`cases.js` 新建时记 `source: { kind:'token', via:标签 }`，案例卡显示「经「×」投稿」。设置页两行：新建只读令牌 / 新建投稿令牌，列表显示范围。对接说明 `docs/SUBMIT-TOKEN.md`。MCP 桥仍只读。测试 `academy-tokens.test.js` 加一条。
- **2026-10-22（夜 43）** 合集：`api/academy/collections.js`，db.collections，条目五种（case 已入库案例、level 关卡、clip 讲堂微课 `lectureId:cid`、lecture 场次、resource 资源）≤ 40，范围 all / district / community / org；建：管理员任何范围，区县管理员本区与区内共同体，园长本园与所在共同体，种子教师本园；改删本人、管理员、园所范围的本园园长；看按范围，条目再按看的人过滤。`GET /api/collections[?id]`、`POST /api/collections`、`POST /api/collections/delete`。没有点赞、浏览数。网页 `/collections`（列表两列、详情、建改表单带五类挑选器），微课库页头「合集」入口，运营后台资源组一行，顶部导航归在微课库下；MCP `list_collections`（18 个工具）。另：口径页桌面两列；关卡页「n 题 · 对 m」不再换行。测试 `test/academy-collections.test.js`。
- **2026-10-22（夜 44）** 桌面布局统一：`academy.css` 1000px 以上单栏页 `.narrow` 从 640 提到 860（关卡、Coach、我的、设置、证书、档案、自评、表格），两列列表页 `.narrow.wide` 仍 1100；档案页从 1100 回到 860。磁贴 `.tiles` 恰好两块时两列铺满（Coach）；运营后台六组入口套 `grid2.groups` 两列；微课库、资源库列表 `sect-b cols2` 两列；园所分享日、研修项目、练习营、园内教研组的卡片列表套 `grid2`（一张占满，两张以上两列）。设置页页头改成标题在左、关闭在右，与其他页一致。36 个路由在 1440 下全部看过，分享日、研修、练习营、教研组用临时数据看过有内容的状态；375 下 14 页复核未受影响（桌面规则全在媒体查询内）。
- **2026-10-22（夜 45）** 平台名称可配：`api/academy/brand.js`，db.brand `{ name 全称 ≤40, short 短名 ≤12, region 地区 ≤20, tagline 一句话 ≤80, credit 技术支持署名 ≤40 }`，默认「C-Life 学前大课堂」，环境变量 `BRAND_*` 给初始默认（.env.example 有柳州示例）；`GET /api/brand`、`PUT /api/brand`（管理员，`reset:true` 回默认），也随 `/api/config` 公开下发。网页 `academy/brand.js` 的 `useBrand()`：顶部导航与首页用短名，登录页用全称＋地区＋一句话，设置「关于」、证书与学时证明用地区＋全称，证书页脚出技术支持署名，标签页标题订阅 store 跟着全称走；运营后台审计组「平台名称」行展开表单改。答疑助手的模型提示词改为取当前全称。小程序 `utils/brand.js` 启动时取一次并缓存，顶栏与导航栏标题跟着换。定名：产品线名「幼师学坊」（与教研工坊对应，坊＝上手练），brand.js 默认值、网页与小程序回退值、index.html 静态标题都改成它；柳州实例全称「幼师学坊」、地区「柳州市」、署名「技术支持：C-Life」，本地库已按此配置，别的城市加地方前缀（如「龙城幼师学坊」）；仓库里不再出现产品名：`index.html` 静态标题与主屏标题、MCP 桥注释与 README 改成通用名「学前教师发展平台」，只有 brand.js 默认值与 .env.example 示例还写 C-Life 学前大课堂。未采用的候选名：「柳侯学坊」（柳宗元任柳州刺史兴学，柳侯祠）、「种柳学堂」（柳宗元《种柳戏题》「柳州柳刺史，种柳柳江边」，以种柳喻育人）、「紫荆幼师学堂」（市花）、「鱼峰幼师学堂」（刘三姐传歌处），定名前先查教育系统重名与商标。测试 `test/academy-brand.test.js`。
- **2026-10-22（夜 88）** `workshop-share/` 加钱包增量：`教研工坊-钱包接口增量.md` 把学坊侧六条工具接口（握手、余额、报价、扣减、钱包整包、来源核对）按工坊钱包页的用法整理成一份，带应答样例、错误码、14 个功能点对应字段、一次起草的调用顺序、验收脚本用法；`wallet-openapi.yaml` 从 `api/openapi.yaml` 抽这六条成独立定义。没改接口。
- **2026-10-22（夜 87）** 并仓收口：`workshop/` 整份引擎副本删掉，只留与学坊有关的增量到 `workshop-share/`（设计、`share_academy.py`、skill 与命令、配置模板、V3 按钮 patch、README）；`prototype/` 删掉，课程数据源留为 `scripts/lessons-source.html`，小程序数据生成脚本改为 `scripts/gen-mp-data.py`，两份课程数据文件重新生成后与提交的一致。文档仓库的学前大课堂目录整个删除，deals/06 README 留迁出说明。README、HANDOVER、WORKSHOP-TODO、WORKSHOP-SHARE-DESIGN、ROADMAP 的路径同步。
- **2026-10-22（夜 86）** 并仓：移交只认一个仓库。微信小程序从文档仓库搬进 `miniprogram/`（根目录 `project.config.json`，渲染脚本到 `scripts/mp-render.mjs`）；早期 H5 原型与课程数据源进 `prototype/`（`gen_mp_data.py` 输出路径改为 `../miniprogram/utils/data.js`）；方案正文、三份对客契约、继续教育学时说明、微课样片、移交文档 Word/PDF 与导出脚本进 `docs/proposal/`；教研工坊引擎（courses-workshop-plugins，去掉 .git 与 .workshop）整份进 `workshop/`，根 .gitignore 挡 `workshop/.workshop/`。AUTH、ROADMAP、WORKSHOP-TODO、WORKSHOP-SHARE-DESIGN、README、HANDOVER 里的跨仓库路径全部改成仓库内路径；文档仓库原目录删掉代码只留一页指引。
- **2026-10-22（夜 85）** 移交文档 docs/HANDOVER.md：给产品与技术接手用，十三节——这是什么、三个仓库与目录、怎么跑与部署、工程约定、角色与登录、功能总览、对外契约与状态、产品红线与口径、测试与联调现状、文档索引、现状与待办（按技术 / 产品运营分）、已知问题与坑、移交清单（仓库权限、密钥、AppID、域名、品牌文案）。README 结构表加一行指过去。
- **2026-10-22（夜 84）** 设计稿 docs/KNOWLEDGE-TREE-DESIGN.md「教师发展树」：借懂了鸭「知识树挂国家课程标准」的做法（公开报道只有一句，没有结构），骨架取《幼儿园教师专业标准》的两个维度做两根主干——专业知识（3 领域，教师要懂的）与专业能力（7 领域，教师要会做的），师德不进树只做边界；每根三层（领域、条目照原文抄、叶子即知识点或能力点），每个节点带出处、标阶段（入职 / 成长 / 骨干 / 管理）；两根主干之间横向连线，每个能力点写明「做这件事要懂哪几个知识点」。两根主干证据分开：知识轻（答对过、读过就算），能力沿用现有三类证据；都不打分不排行。九个功能点：树页与节点页、内容挂树（测验题标知识点、条文解读页、记忆卡改按知识点）、能力地图改成发展地图（两块、按阶段筛）、与工坊共用节点词表、Coach 按节点排学期、讲堂切片与自动合集、练兵题与研讨关按节点出题、阶段认证按树算、后台空节点清单。没改代码，等定四件事（条目照抄与否、叶子谁定稿、先做哪两个领域、师德不进树）。
- **2026-10-22（夜 83）** ROADMAP 第十二节「待决策」核对一遍：七条里凡是平台能定的，都对照代码写成已定——内容署名与审定流（讲堂主讲、工作室主持、案例与成果「园长同意 → 审核人入库」）、作品权属与两开关、点评记积分不记学时、工坊直连与导出件两条都留、存储只存文件或链接且视频不存、案例审核两步留名、斗课与称号的授予主体。还开着的只剩四件外部事：市教研员审定哪几条路径、点评的工作量与报酬、称号与市级展示的背书、激励经费。没改代码。
- **2026-10-22（夜 82）** 全站回归截图一轮：网页 38 条路由（教师王老师、园长兼管理员赵园长两个身份，1100 与 860 两档宽）、小程序 16 页 18 份渲染（含园长首页与我的页），积分 / 商城 / 园所额度相关页面没有版式问题。顺手修了小程序三处旧问题，都在 hundredscity 仓库：`growth`、`district` 页的输入框写的是 `class="input"`，而 app.wxss 只定义了 `.inp` / `.ta`，一直是裸的，app.wxss 把 `.input` 并进同一条规则；`live` 页回放行的日期原来放在标题右侧，把标题挤成三四个字一行，改成放到标题下面的 `.sub` 里；`mp-render.mjs` 只换 wxss 里的 rpx，行内 `style` 里的 rpx 浏览器当无效值丢掉（海报、流水行间距全靠它），现在输出前把 `style="…"` 里的也换成 px。
- **2026-10-22（夜 81）** 钱包待办第五节学坊侧四条（docs/WALLET-TODO.md）：W9 `/api/points/of` 的 `history[]` 改编半价那几笔带 `adaptedFrom {id, title, url}`（个人积分行本来存 id；从园所额度扣的行原来没存，`quota.spend` 加 `extra` 参数把 `adaptedFrom` 一并记进 orgQuotaLog）；W10 翻页 `?before=<at>&limit=<n ≤ 500>`，`sections` 与新加的 `total` 按全量，`history` 只给这一页，`nextBefore` 给下一页，不传 limit 行为不变；W11 教师视角的 `quotaLog[]`（alloc / recall / spend，n 正进负出，byName、tool、text 一句话），不进 history、不算积分；W13 `links.paths`。points、works 测试加断言；联调脚本第 9 步加 9f、9g，11c 查 adaptedFrom；openapi 同步；WALLET-TODO 14 条全部变成「接口已齐 · 待工坊」。
- **2026-10-22（夜 80）** 定规矩：钱包页只有一个，在教研工坊；凡是和钱包有关的功能，今后一律以功能点待办记在 `docs/WALLET-TODO.md`，学坊这边只保证接口给齐，不做钱包界面（网页荣誉页与小程序「我的」只留余额与最近几笔）。首版 14 个功能点分余额、明细、花之前三组，每条写取哪个字段与状态（接口已齐 / 待学坊 / 待工坊）；学坊侧抽出四条：流水公开 `adaptedFrom`、`?before=&limit=` 分页、教师视角的园所额度分与收、`links.paths`。WORKSHOP-TODO 第 15 条、POINTS-DESIGN、README 指过去。
- **2026-10-22（夜 79）** 园所额度在网页荣誉页的流水标注（`Honors.jsx`）：积分 tile 的副文案有额度或用过额度时写「园所额度 N（园长分的，只用在工具上，先扣它再扣积分，已用 M）」；最近 8 笔前加一行「最近几笔」，有从额度扣的时再接一句「标「园所额度」的几笔扣的是园长分的额度，没动你的积分」；从额度扣的那几笔（`sub: 'quota'`）note 前是 `.tag.acc` 小标签「园所额度」而不是纯文字，右侧数字用更淡的颜色并带 title。与小程序我的页「最近几笔」同一口径。前端 133 测试通过，浏览器核过。
- **2026-10-22（夜 78）** 园所额度在小程序「我的」页的流水：积分面板下加「最近几笔」面板，用 `GET /api/me/points` 的 `history` 取最近 6 笔（钱包页与工坊统一，学坊只给最近几笔），每行 日期 · （工具 ·）（园所额度 ·）note · ±n，从园所额度扣的（`sub: 'quota'`）标「园所额度」，有用过额度时提示语写明这部分不动个人积分；超过 6 笔写「只给最近 6 笔」，并说完整明细在工坊钱包页、同一本账。标题与提示分两行，免得标题折行。渲染核过。
- **2026-10-22（夜 77）** 园所额度流水的小程序侧：园长首页「园所额度」面板下加「流水」，用 `GET /api/org/quota` 的 `log`（最近 50 条）按池子视角一句话一行：「运营方充值 N（备注）」「分给 谁 N · 园长」「收回 谁 没用的 N · 园长」「谁 在教研工坊用了 N（备注）」，充值与收回标 +、分出与用掉标 −；默认露 6 条，「看全部 N 条 / 收起」切换（整体替换 quota 对象，不用点路径）。mp-render 的 setData 顺手支持 `a.b` 路径。渲染核过收起与展开两态。
- **2026-10-22（夜 76）** 园所额度池的小程序侧（平台仓库 `学前大课堂/app/miniprogram`）：园长首页「本园学习概况」之后加「园所额度」面板，`GET /api/org/quota` 取池子剩余、已分在手、已用（从流水 spend 行算）与每位教师剩 / 已用；点一个人弹 actionSheet「分 10 / 30 / 100」（池子够才出）、「分指定数量…」（showModal 可编辑输入）、「收回没用的 N」（确认后 recall 全收），`409 pool` 提示池子只剩多少；没人登录过、池子没充值各有一句话。`utils/honors.js` 加 orgQuota / allocQuota / recallQuota。教师「我的」页积分面板：有额度或用过额度时写「园所额度 N（园长分的，只能用在教研工坊等工具上，先扣它再扣积分，已用 M）」，「换物料 →」不折行。mp-render 顶替 showActionSheet / showModal 记录调用。渲染核过园长首页与教师我的页。
- **2026-10-22（夜 75）** api 的 CI：`.github/workflows/api.yml`（仓库在 GitHub，上游的 .gitlab-ci.yml 不跑）。三个 job：`academy-tests` 跑 `api/test/academy-*.test.js`，红了就是坏了；`api-full-suite` 跑上游继承的全套，十几个与学坊无关的旧失败只记录不拦（`continue-on-error`）；`workshop-checks` 起一个带 `DEV_LOGIN` / `FIRST_USER_ADMIN` / `TOOLS_API_KEY` 的 api，先用 dev 登录让「CI管理员」占住第一个账号，再 `npm run check:share -- --dev CI教师`、`npm run check:spend -- --dev CI教师 --admin CI管理员`、`npm run price`，任何一步 FAIL 就红，失败时贴 api 日志。触发：main 推送与 PR 中改到 api/、scripts/、根 package.json 或工作流本身，也可手动。WORKSHOP-TODO 第五节与 README 提一句。
- **2026-10-22（夜 74）** 分享到学坊第 1–8 条的学坊侧（docs/WORKSHOP-TODO.md 第一节）：学坊接口原本就齐，补了工坊界面要靠的几样。`tokens.js` 加 `GET /api/me/token` 令牌自检（用令牌调：`ok` 是不是投稿令牌、scope、label、user {name, orgName, role}、submitRoutes、只读令牌给 `hint`；会话调 404 no-token，无效 401），工坊令牌设置页粘进来就能显示「已配置 · 谁（园）」。`works.js` 加 `GET /api/works/options`（四栏表的词表、上限、默认值、三个提示词与模板句、状态流、查状态与打开地址，工坊不自己维护词表）、`POST /api/works/message { id, message }`（署名一句单独改，本人、不是草稿就行，入库后也能补或清；进 `SUBMIT_ROUTES`），`POST /api/works` 应答加 `url` 与 `next`。写请求令牌拦截的错误文案改成「只放投稿接口（案例、成果）」。新联调脚本 `scripts/workshop-share-check.mjs`（`ACADEMY_TOKEN` 投稿令牌或本机 `--dev`，可加 `--readonly-token`）：令牌自检 → 词表 → 六种字段错误 → 提交（署名本人、source 带令牌标签与课程 id、没有评分等字段、非 https 链接丢掉）→ 署名一句与 80 字截断 → 带 id 重交不生成第二条 → `/api/works/mine` 查状态，18 步。tokens、works 测试同步；openapi 三条；WORKSHOP-TODO 第 1、3、5、6、7 条写上接口与脚本；WORKSHOP-SHARE 加「配套接口」节；README scripts 行。
- **2026-10-22（夜 73）** 改编回跳的学坊侧（docs/WORKSHOP-TODO.md 第 9、10 条）：工坊收到 `?from=<课程 id>&work=<成果 id>` 开新课前有地方核对了。`works.js` 加 `GET /api/tools/work?id=&from=&uid=`（带 TOOLS_API_KEY，不登录、不动账、不给文件——工坊自己库里有原课）：成果基本信息与 `source.courseId`、`canAdapt` 与 `why`（not-approved / not-allowed / course-mismatch，`from` 与成果的课程 id 对不上也算不能改）、`match`、`own`（uid 就是分享者）、新课要标的 `label`「改编自《…》· 谁（园）」、`share.adaptedFrom`（分享与扣积分都带这个 id）。`points.js` 的 `toolAuth` 改成模块导出给 works 用。第 10 条学坊侧原本就齐（`POST /api/works` 与 `/api/works/draft` 都认 `adaptedFrom`，入库双署名、原成果记用过、原作者 20 分），只补了待办说明：原成果不再允许改编时答 `400 adapt`，去掉 `adaptedFrom` 再交。works 测试加核对接口断言；联调脚本第 12 步；openapi、WORKSHOP-TODO 第 9、10 条、WORKSHOP-SHARE 字段表同步。
- **2026-10-22（夜 72）** 改编半价的学坊侧（docs/WORKSHOP-TODO.md 第 14 条）：工坊不必自己算价、不必自己写「改编自」。`points.js` 加价表 `PRICE`（主题式 30 / 周、项目式 40 / 周、单节活动 10）与 `priceOf(pipeline, weeks, adapted)`（改编向上取整 5 折）；`POST /api/points/spend` 多认 `pipeline / weeks`（与 `n` 二选一）和 `adaptedFrom`（学坊成果 id）：`adaptBasis` 核成果入库且允许改编，否则 `400 adapt`；折后 n 扣，note 自动写「改编自《…》 5 折 · <管线> · <工坊的 note>」，流水行存 `adaptedFrom`，应答多 `n / full / adapted / note`。加 `GET /api/points/quote?pipeline=&weeks=&adaptedFrom=&uid=` 报价（不动账，给了 uid 带余额与 enough）。握手 `ping` 多 `prices` 与 quote 路由。works 测试加报价与半价扣减断言（含 locked 成果与不存在的成果答 adapt）；联调脚本第 10 步报价（与本地 priceOf 对数）、第 11 步改编报价与扣减（`--work <成果 id>`，`--dev` 下自动在本机 db 找一门）；openapi、WORKSHOP-TODO 第 14 条、POINTS-DESIGN 价表同步。
- **2026-10-22（夜 71）** 工坊接密钥的学坊侧（docs/WORKSHOP-TODO.md 第 12 条）：工坊与学坊是同一个平台账号登录，但工坊手里只有平台 uid，学坊的 `user.id` 是自己生成的，原来三条工具接口只认 `user.id`，统一登录接不上。`points.js` 加 `toolUserOf(db, uid)`：先按 `user.id` 找，找不到按 `user.platform.uid` 找，停用的不认；balance / spend / of 都改用它，应答带 `uid`（学坊 id）与 `platformUid`，找不到人 `404 code uid`。加握手 `GET /api/tools/ping`（带密钥，不带 uid、不动账）：学坊名与地址、认的 tool、四栏、`uid.accepts`（接了平台登录是 `['academy','platform']`）、三条路由、当前积分规则；没配密钥 404 `off`，密钥不对 403。联调脚本加第 0 步握手并对 404 / 403 各给一句提示；测试加握手断言与 `toolUserOf` 单测；openapi、WORKSHOP-TODO 第 12 条与第五节（运维发密钥的做法）、POINTS-DESIGN、.env.example 同步。
- **2026-10-22（夜 70）** 工坊钱包页的学坊侧（docs/WORKSHOP-TODO.md 第 15 条）：`GET /api/points/of?uid=` 从「余额＋流水」变成钱包页整包，工坊只渲染不算：`name`、`points`、`quota {left, used, orgName}` 两行余额；`sections` 四栏小计按顺序给（`GROUPS`：learn 学与贡献 / interact 互动 / tool 工具扣减 / mall 教学物料商城，各带 label、n、count）；`history[]` 每笔加 `group`（`groupOf`：interact → 互动，tool mall → 商城，其他带 tool 的 spend → 工具扣减，其余 → 学与贡献；`/api/me/points` 的流水同样带）；`links {mall, honors}` 用 ORIGIN 拼成「换教学物料」入口地址，`mallHint` 按钮文案。`pointsRoutes` 多收 `origin`。余额与 `/api/me/points` 同一份 `summary()`，两边不会不一致。联调脚本加第 9 步五项断言（整包字段、四栏、group、入口链接、与 balance 一致），测试 academy-points 加整包断言，openapi 写明应答结构，WORKSHOP-TODO 第 15 条改成照字段渲染的说明。
- **2026-10-22（夜 69）** 工坊接积分扣减的联调脚本（docs/WORKSHOP-TODO.md 第 13 条学坊侧）：`scripts/workshop-spend-check.mjs`，给工坊服务端的同学对着学坊测试环境跑：没密钥 403 → 查余额（points / quota / total）→ 单节活动扣 10（园所额度先扣，`fromQuota + fromPoints = n`，应答余额对得上）→ 同一 ref 重复调用 `duplicate:true` 不再扣 → 超额 409 insufficient → 字段校验（tool / n / ref 400、uid 404）→ 算价 → 流水里有 tool 为教研工坊的一笔；每步打印请求与应答，最后 PASS / FAIL。`--price <pipeline> <weeks> [--adapted]` 只算价，`priceOf()` 导出作工坊算价的参考实现（主题式 30 / 周、项目式 40 / 周、单节活动 10、改编向上取整 5 折）。`--dev <姓名> [--admin <管理员姓名>]` 本机开发桩：建教师、推 3 关攒 30 分，有管理员就充 15 分园所额度。跑出来发现一个洞：从园所额度扣的那几笔记在 orgQuotaLog，`/api/points/of` 与 `/api/me/points` 的 history 里没有，工坊钱包页会少显示；`points.js` 加 `history(uid)` 把额度扣减并进流水（`sub: 'quota'`，tool 同样显示工具名），荣誉页那几笔前标「园所额度」。测试 academy-points 加流水断言；README、POINTS-DESIGN 第三节、WORKSHOP-TODO 第 13 条验收列写上脚本。
- **2026-10-22（夜 68）** 「改编这门课」跳工坊（docs/WORKSHOP-TODO.md 第 11 条，学坊侧那一行）：服务端环境变量 `WORKSHOP_ADAPT_URL`（模板，`{courseId}` 工坊课程 id、`{workId}` 学坊成果 id，见 .env.example），配了就在 `GET /api/config` 里给 `workshop.adaptUrl`；`works.js` 的 `source` 公开 `courseId`。`Works.jsx`：配了且成果来自工坊，按钮文案改「到教研工坊照它开一门新课，用过再分享回来」，新开工坊地址，旁边留「不用工坊，在这里手填」；没配或成果没有课程 id，仍在学坊开预填表。工坊 9、10 上线前环境变量空着，行为不变。
- **2026-10-22（夜 67）** 工坊侧「分享到幼师学坊」按钮做在工坊仓库 courses-workshop-plugins（本仓库只改设计文档的 A 路标记）：skill `workshop-core:share` + `share_academy.py`（prepare / submit / message / state；门槛 phase approved / shipped 或 `used_in_class`；令牌读 `.workshop/config.yaml` academy 段，已 gitignore；`changes` 空不交；回写 `status.json` academy 段；退回再交带同一 id；`--draft` 走草稿路由），V3 原型交付页按钮与四栏弹层，设计文档。用本地学坊对脚本跑通：拒空 changes、交、留言、重交同 id、门槛、草稿。
- **2026-10-22（夜 66）** 课程成果改编链与「改编这门课」（docs/WORKSHOP-SHARE-DESIGN.md 第四节，分享设计学坊侧最后一项）：`works.js` 加 `adaptedFrom { workId, title, byName, at }`，`POST /api/works` 与 `/draft` 收 `adaptedFrom`（只能改自已入库、`allowAdapt` 没关的，不能改自自己这条；null 清掉，不带不动），应答带 `adaptedFrom`（含 available）、`chain`（最多 5 级）、`adaptations`（已入库的改编版，带前三条 changes）、`canAdapt`（入库、允许、不是本人）。审核入库时若有来源：原作者不是改编者就给原成果记一次「用过，有效」（注「改编为《…》」）并给原作者记 adapted（ref `work:<id>`）。`Works.jsx`：详情显示「改自 … 再往上 …」「被改编：…改了：…」，`canAdapt` 的显示「改编这门课」，点了开预填表（标题前加「改编：」，管线 / 年龄 / 周数 / 领域 / 简介复制当底稿，文件与工坊地址不带，「改了什么」自己写），表头一块「改自 …」可去掉，有工坊地址给「先打开原课」。工坊 `?from=` 跳转留在工坊仓库。契约与 openapi 加 `adaptedFrom`。测试 academy-works.test.js 加一条。
- **2026-10-22（夜 65）** 公开分享 Skill 与「用 Agent 整理」页（docs/WORKSHOP-SHARE-DESIGN.md 三 B 路第 1、2 条）：`api/academy/skill.js` 的 `GET /skill/share-work.md` 与 `GET /api/skill/share-work.md`（不要登录，text/markdown，缓存 5 分钟，由 brand 与 ORIGIN 拼出；vite 代理加 `/skill`）——先问教师要令牌与导出文件、字段取自哪里、不许填 changes / 不带幼儿信息与工坊评分、怎么调 `POST /api/works/draft`、落了草稿把 `/#/works?tab=mine&id=…` 给教师。前端 `/works/agent`（`views/AgentShare.jsx`）：三步说明、投稿令牌（列现有的、可就地新建，新令牌直接拼进指令）、一键复制「读 <Skill 地址>…用这枚令牌上传…不要替我写改了什么」的指令、Agent 不会做的；入口在课程成果页头「用 Agent 整理」chip 与表单提示。测试 academy-tokens.test.js 加一条（两条地址、frontmatter、提到草稿路由与不填 changes），并把 submitRoutes 断言补上 works 两条。
- **2026-10-22（夜 64）** 课程成果草稿（docs/WORKSHOP-SHARE-DESIGN.md 三 B 路、五之第 1 条）：`POST /api/works/draft`（投稿令牌可调，`tokens.js` SUBMIT_ROUTES 加入），只要 title 与 pipeline，summary 可短、changes 可空；令牌投来的 changes 一律丢弃（「改了什么」只能教师写）；状态 `draft`，只本人可见（`/api/works/mine` 带 `expiresAt`），不进园长队列、不记积分；应答 `{ work, url: /works?tab=mine&id=…, next }`。教师 `POST /api/works` 带 id 补齐提交才变 consent（园长自己则 pending）；令牌不能用 `POST /api/works` 推草稿进流程（403 draft）。七天没动的草稿在读「我交的」或再落草稿时顺手删。前端 `Works.jsx`：草稿卡灰底虚框、「草稿 · 经「X」导入」、一行「还没写改了什么 · 几号自动删」、按钮「补齐并交给园长」；`?id=` 到了直接把那条打开成表，表头「补齐这份草稿」，提交按钮「交给园长」。openapi、docs/WORKSHOP-SHARE.md 加草稿一节。测试 academy-works.test.js 加一条。
- **2026-10-22（夜 63）** 园所额度池（docs/POINTS-DESIGN.md 第五节）：`api/academy/quota.js`，一张流水 `db.orgQuotaLog`（topup / alloc / recall / spend）。管理员 `POST /api/admin/quota/topup`（按合同充给园所，≤ 100000，不能撤）与 `GET /api/admin/quota`；园长 `GET /api/org/quota`、`POST /api/org/quota/alloc`（本园教师、不含自己、不超池子）、`POST /api/org/quota/recall`（只收没用掉的，不带 n 全收）。`POST /api/points/spend` 先扣园所分给本人的额度再扣个人积分，应答 `fromQuota / fromPoints`，幂等在两本账上一起查；`GET /api/points/balance` 加 `quota`、`total`；`GET /api/me/points` 加 `quota {left, used, orgName}`。商城只看个人积分。前端：园长看板「园所额度」节（池子、每人在手 / 用掉、分配、收回）、运营后台积分组「园所额度充值」、荣誉页与我的页积分 tile 带「园所额度 N」、小程序我的页积分面板一句。测试 academy-points.test.js 加一条（充、分、扣先额度后积分、重复不扣、收回、商城不用额度）。
- **2026-10-22（夜 62）** 商城入口提到一步之内（用户点名参照懂了鸭左栏底部「鸭蛋 / 邀请好友」的位置）：桌面壳顶部导航右侧、用户名左边常驻「N 积分 · 换物料」胶囊（`frontend/src/academy/components/TopNav.jsx`，样式 `#topnav .pts`），点了进 `/mall`，在商城页高亮，换页刷新余额，没登录不显示；网页「我的」积分 tile 直达商城（副题「去换物料 ›」），荣誉页入口挪到「岗位徽章」tile；小程序「我的」积分面板挪到顶部四格之后，一行余额加「换物料 →」整条可点，首页积分格标「积分 · 换物料」也进商城（`home.js` `goMall`）。首页不加「可换物料 N 件」行。前端 133 测试过；1200 宽看胶囊并点进商城、760 宽看我的页；小程序 me / home 用 mp-render 看过。
- **2026-10-22（夜 61）** 教学物料商城（docs/POINTS-DESIGN.md 第三节第 2 条）：`api/academy/mall.js`，`db.mallItems`（名称、说明、积分价、库存空为不限、范围 all / district / community、收货 org 寄到园 / pickup 现场领、下架）与 `db.mallOrders`（placed → shipped → done | cancelled）；`GET /api/mall`、`POST /api/mall/items`（管理员或区县管理员；全平台的只有管理员）、`POST /api/mall/redeem`（扣积分、生成订单，不够或换完答 409，寄到园用账号的园所）、`POST /api/mall/orders`（教师取消待发货的；运营方发货、签收、取消；取消退回积分，同一单只退一次）。points.js 挂 `ledger.points.balance / spend / refund`，流水 tool `mall`（标「教学物料商城」）。教师看不到库存数与已兑件数，只有「还有 / 换完了」；运营方看剩余与已兑。网页 `/mall`（物料 / 我换的 / 订单三 tab，运营方上架表），入口在荣誉页积分卡、我的页 tile、运营后台积分组；小程序 `pages/mall/mall`（列表、换、我换的、取消），入口在我的页积分面板。测试 academy-mall.test.js 一条。
- **2026-10-22（夜 60）** 剩下的三项贡献给分：规则表 `EARN` 加 adapted 20（案例被改编入库，记原作者，`cases.js` 入库处；改编者自己的入库仍记 case）、lecture 50（`lectures.js` 邀上台，`lecture:uid` 一场一次）、shareday 20（`sharedays.js` 园长交页，`shareday:org` 一次分享日一园一次，改页不重复）；server.js 给 lectures / sharedays 传 ledger。运营后台规则组自动多出三行。测试：points 加一条（改编、邀上台），batch 的分享日一条加断言。
- **2026-10-22（夜 59）** 只保留积分一种资产，不再有学分（用户定）。`points.js` 重写：规则表 `EARN`（过关 10、走完路径 50、实践关作品通过点评 10、证书 100、结营 20、案例 20、课程成果 30、精选 20、赛 20）＋ `INTERACT` 五项，`db.pointsRules.earn / interact` 管理员可改（学与贡献 0–1000、互动 0–100）；honors.js 的 `db.credits` 改口径为「专业发展事件记录」（一事一条，n 不再有意义），points.js 包住 `ledger.grant` 按事件名记积分；`ledger.learn(uid, stateOf)` 按进度补记走完的路径与拿到的证书；submissions 点评通过记 practice、camps 结营给发过帖的营员记 camp；过关由客户端进度对账补记（`sub: 'level'`，带 levels）。删了 `POST /api/me/points/exchange` 与 `POINTS_PER_CREDIT`；`GET /api/me/points` 改答 `{ points, levelsPassed, rules, tools, history }`。网页：荣誉页改「荣誉与积分」（积分、通过的关两块，「记过的事」不再带数）、我的页积分 tile 取 `/api/me/points`、首页去掉学分、关卡通过提示「积分已记」、落地页与案例 / 成果文案改「记积分」、运营后台规则改成学与贡献九项＋互动五项；口径库 `credits-not-money` 改「积分是工具额度」；路径文案三处（lessons-extra）改并重建 events-data 与小程序 extra.js。小程序：首页与我的页显示积分（登录后取），去掉兑换按钮与接口，关卡提示改「积分已记」。docs/POINTS-DESIGN.md 第一、二节重写，ROADMAP、POSITIONING 同步。测试：points 三条（规则、学侧、互动）、honors learn 一条。
- **2026-10-22（夜 58）** 互动类给分（docs/POINTS-DESIGN.md 第二节第 3 条）：`points.js` 加 `INTERACT` 五项（used 5 / usedBy 2 / adopted 5 / review 3 / campPost 1）与 `ledger.interact(uid, sub, ref, note, about)`，同一 (sub, ref) 只记一次，日上限（usedBy 3、review 5）、月上限（used 20）、同一作品每天 1 次（used 按 about）；流水 `kind: 'interact'` 带 sub。接入点：`cases.js` / `works.js` 的「用过，有效」（分享者记 used；标的人写了一句才记 usedBy）、`questions.js` 采纳（答的人，不给自己答自己的）、`submissions.js` 点评（点评人，一份提交只记第一次）、`camps.js` 发帖（改帖不重复）；server.js 给 questions / submissions / camps 传 `ledger`。数字在 `db.pointsRules.interact`，`POST /api/admin/points/rules` 可带 `interact`（0–100，0 是不给），运营后台「积分」一组列五项与上限。只记积分不记学分；签到、时长、浏览、点赞仍不给。academy-points.test.js 加一条覆盖五项、上限、幂等与改成 0。
- **2026-10-22（夜 57）** 积分自动到账与后台可配比例（docs/POINTS-DESIGN.md 第六节第一项）：`points.js` 包一层 `ledger.grant`，台账一记学分就记一笔 `earn`（带来源备注）；关卡学分在客户端状态里，读余额、工具查余额与扣减时 `settle` 对账补记；`exchanged` 口径改为「手动兑的 + 自动到账的」，所以可兑学分总是 0，手动兑换接口保留作过渡。比例存 `db.pointsRules`（默认取 `POINTS_PER_CREDIT` 或 10），管理员 `GET/POST /api/admin/points/rules` 改，1–100，只影响之后到账的；运营后台加「积分」一组。`GET /api/points/of` 也接受 `TOOLS_API_KEY`，给工坊的钱包页取流水。用户定的口径：**钱包页与教研工坊统一，学坊不单独做**，钱包跟账号走、账号统一登录；荣誉页去掉兑换输入，只留余额、比例与最近几笔并注明明细在工坊钱包页。academy-points.test.js 改成自动到账与改比例的断言。
- **2026-10-22（夜 56）** 写了积分资产设计 docs/POINTS-DESIGN.md（参照懂了鸭三种资产：只留一种「积分」，不做下载次数、不做鸭蛋式用户间流转、不做签到）：学分是记录、积分是额度，由手动兑换改为自动到账（1 学分 = 10 积分，运营方可配不追溯）；三条途径赚：学（过关、走完路径、带做段微课、证书、结营）、贡献（案例、成果、精选、赛、改编版、讲堂上台、分享日）同时记学分与积分，互动（被标用过有效、标别人并写一句、答疑采纳、点评、营帖）只记积分且有日月上限；不奖签到、时长、浏览、点赞、关注、邀请。花在工具额度（工坊按管线按周定价、改编半价）与新的**教学物料商城**（运营方上架教具、绘本、耗材、名额，寄到园，不上购物卡）；园所额度池走合同、园长分配、只能用在工具。七条红线、学坊侧七项待做列在文内。ROADMAP 积分段同步，「不做实物商城」改成「只做教学物料、运营方发货到园」。只写设计未动代码。
- **2026-10-22（夜 55）** 课程成果加三个字段（docs/WORKSHOP-SHARE-DESIGN.md 学坊侧第一项）：`message` 分享者给同行的一句话（≤ 80 字，可空，卡片与详情上以「王老师：…」左竖线显示，教研共同体卡也显示）、`allowAdapt`（默认 true，关了详情标「只看不改编」，改编按钮下一项再做）、`filesScope`（all / community / org；看不到的用户 `files` 为空且 `filesHidden: true`，详情提示「文件只给本园看，简介与改动说明全平台可见」；本人、管理员、同园、同共同体可见；works.js 接 communities.sameCommunity）。分享表加一句话输入、改编勾选、三档 chips。openapi、WORKSHOP-SHARE.md 契约、academy-works.test.js 新增一条测试同步。
- **2026-10-22（夜 54）** 写了教研工坊分享作品到幼师学坊的功能设计 docs/WORKSHOP-SHARE-DESIGN.md（参照懂了鸭「发布作品 / 从外部 Agent 导入」）：三条路（A 工坊交付页按钮、B 外部 Agent 读学坊公开的 SKILL.md 用投稿令牌落草稿、C 手填）最后同一条记录同一流程；A 路四栏表前三栏工坊预填、「改了什么」只能教师手打并给三个提示词；发布前两个开关（允许改编、文件对谁可见）；提交后一屏「给同行留一句话」（`message` ≤ 80 字）；B 路 `POST /api/works/draft` 落 `draft`，教师在「我交的」补改再交，七天不动自动删；入库成果加「改编这门课」（跳工坊 `?from=` 或学坊预填表，`adaptedFrom` 来源链）。三处不照搬：不自动生成「改了什么」、不自动发表、不显示下载次数。学坊侧待加五项列在文内第五节，只写了设计没动代码。
- **2026-10-22（夜 53）** 教研共同体页改成内容社区的样子（参照懂了鸭首页：顶部 tab、一张大卡＋「动动手」入口、带封面的作品卡网格）。`views/Community.jsx` 重写：五个 tab 最新 / 本园 / 本共同体（有共同体才显示）/ 合集 / 按领域（按七领域分组，课程成果的五大领域映射到七领域：语言→计划、社会→沟通、健康→一日生活、艺术→环境、科学→游戏）；「本期」大卡取市级展示的案例，没有就取名师讲堂最近一场；「动动手」四个入口：分享一个案例、分享一门课、建一份合集、交一页分享日，脚注讲投稿令牌与工坊「分享到幼师学坊」；下面「全部作品」搜索框＋类型 chips（专家案例 / 课程成果 / 讲堂微课）＋领域 chips，卡片网格沿用精品微课的 `.course` 卡（手机两列、桌面四列）：案例有图用第一张图作封面，否则按类型底色（案例蓝、成果橙、讲堂微课紫、合集绿）＋领域 / 管线标签，卡上是类型标签、副题、标题、谁 · 园 · 日期。四种东西（案例 `/api/cases`、成果 `/api/works`、讲堂微课 `/api/lectures/clips`、合集 `/api/collections`）在前端拍平成一种卡，不加接口。懂了鸭里不照搬的：「关注」tab（跟人走，评作品不评人）换成本园 / 本共同体；浏览、点赞、收藏数一律不显示；鸭蛋式互赠不做（积分是工具额度，不流转）；AI 自动建合集不做。tab 与筛选都在 URL 参数里，可回退。小程序共同体页同轮改成同一形态（hundredscity 仓库 `pages/community`）：tab 最新 / 本园 / 本共同体 / 合集，本期大卡，动动手四格（分享案例、分享一门课、看合集、名师工作室），作品卡两列，领域 chips 与搜索；封面不用图（案例图要带登录态取，小程序 image 带不了 Bearer），按类型底色；没有讲堂微课卡（小程序没接 clips）；合集卡点了提示去网页端看；`utils/resources.js` 加 `collections()`。用 mp-render.mjs 渲过四个状态：最新（本期大卡＋动动手＋五张作品卡两列）、合集（领域 chips 隐去，本地建的一份合集绿封面）、本园＋一日生活筛（只剩两条）、未登录（说明＋「去登录」，按钮原折两行已改不折行）。本地种子为看效果投了两门成果、两条案例、一份合集，只在本机数据里。
- **2026-10-22（夜 52）** PGC 补「用教研工坊做课」路径（ROADMAP 第十四节 3）：`lessons-extra.js` 新路径 `workshop`，阶段「骨干」（kind stage），五关：① 工坊起草，教师定稿（三条管线、每步都是起草、积分是工具额度）；② 信息采集：目标怎么填才过（知识·技能·情感三维各判一次，写「幼儿能……」，情感写成看得见的事，领域勾两三个）；③ 周计划：三个模板怎么选（一日生活环节 / 周重点＋半日 / 固定槽位可拖拽；户外场地按真实填）——研讨关，写本班时段与场地再选模板；④ 教案拿到手先改三处（预设幼儿应答、材料、环节数；理论依据段收附录）——实践关，交 200–400 字修改说明，量表五条；⑤ 用过了，分享回学坊（用过并改过才算、「改了什么」必填、文件只带外链、不带工坊评分、不带幼儿）。内容按教研工坊线上版 2026-10 看到的阶段与产物写（主题式信息采集逐项合规判定、三个周计划模板、八环节教案带预设应答与理论依据段）。新场景 工坊起草 / 周计划 / 教案修改 → teach（计划领域），课程成果 → reflect。路径 16 条 105 关：lessons / capability / library / mcp 四处计数断言、Admin 课程包行、mcp README 与工具说明、POSITIONING 同步；`events-data.js` 重建（事件数不变）；小程序 `utils/extra.js` 重新生成（hundredscity 仓库）。小程序路径页用 mp-render.mjs 渲过：工坊路径卡在列表末尾，展开五关序号、场景、研讨 / 实践标记都对；顺手删掉路径页底部写死的「区县管理员路径 · 寒假上线」占位卡（区县路径早已在数据里，列表上下两张重名）。mp-render.mjs 加了渲染前先点几下的参数（JSON `[[方法, dataset], …]`），并把 `{{ }}` 里的比较符先换占位再解析，关卡序号不再乱码；关卡页有计时器收不了尾，暂不用它渲。网页端路径页也核过：桌面左栏新路径排在区县管理员后，右栏五关第 1 关可进、2–5 带锁，研讨 / 实践标记对；手机上标题「用教研工坊做课路径」折两行，与「教育活动计划与实施路径」一样，是长名路径原本的排法；首页「阶段路径」分组多一行「用教研工坊做课 · 骨干阶段」。小程序关卡页（工坊路径第 4 关）也渲过，顺手修了三处对所有领域 / 阶段路径都成立的旧问题（hundredscity 仓库）：「看」段原来不管有没有平台入口都画演示园假界面与「示例幼儿 A/B」表，现在没有 `menu` 的关只列步骤并提示「这一关没有平台操作」；录屏时间戳原来是 `'0:' + 秒数`，第四步起出 0:75、0:100，改成 m:ss；「下一段」按钮原来写死「平台实操」，改按做段的名字（实践任务 / 情景研讨 / 平台实操）。mp-render.mjs 第六个参数传 onLoad 的 query，渲完调 onUnload 并退出进程，关卡页也能渲了。网页端同一关四段也核过：讲 五步与依据条文；看 是实践关的「微课制作中」占位框，没有录屏；做 显示实践任务要求、五条点评量表与「不用数字工具代写」提示，未解锁时「下一步：测一测」置灰；测 三题可练但没有「通关」只有「返回路径」。都是既有形态，没改代码。
- **2026-10-22（夜 51）** 导航按「学 / 分享」分组：学习路径、精品微课、名师讲堂都是运营方编的 PGC，专家案例与课程成果是教师交的 UGC，之前混在一排，课程成果还藏在案例页头的一枚 chip 里。新开 `/community` 教研共同体页（`views/Community.jsx`）作 UGC 的一级入口：五个入口砖（专家案例、课程成果、合集、园所分享日、名师工作室）＋跨园共同体砖，下面三块：最新入库（案例与成果混排，取 `/api/cases` 与 `/api/works`，按入库时间排，最多 8 条，点开按标题进对应页）、本园做过的（按园所名筛）、名师讲堂讲过 / 要讲的那一场（`/api/lectures` 里有分享者或展示案例的最近一场）。不做信息流墙、不显示人数、不排行。名字不用「社区」（会让人期待评论、点赞、热榜，都是红线），用学前政策里的现成词「教研共同体」。顶部导航改为 首页 / 学习路径 / 精品微课 / 名师讲堂 / 教研共同体，仍五项，/cases /works /forms /resources /collections /sharedays /studios 都归共同体高亮；手机底部 tab 从四个加到五个（共同体）。五个 UGC 页头统一加「教研共同体」回链 chip，精品微课页头的「合集」「专家案例」两枚 chip 换成这一枚。首页「课程成果」卡改为「教研共同体」卡。小程序同步（hundredscity 仓库）：新 tab 页 `pages/community/community`（三条入口、跨园共同体、最新入库、本园做过的；分享仍在网页端），tabBar 换成 首页 / 路径 / 微课 / 共同体 / 我的，「体检」让出 tab 变二级页，入口留在首页体检卡与「我的」。小程序效果没有开发者工具，用 hundredscity 仓库 app 目录的 `mp-render.mjs` 看：Node 顶替 wx 跑页面 onLoad/onShow（真 api 在 :3000，带 dev 登录的 `{user,token}`），把 wxml 渲成 375 宽的 html 截图；共同体页登录 / 未登录两态、首页跨园共同体卡改指共同体页、「我的」多一行体检入口都核过，三页的 tap 路由（navigateTo / switchTab）用桩跑过。
- **2026-10-22（夜 50）** 定位：教研工坊是课程研究工具，幼师学坊是教师发展平台（PGC）兼工坊的 UGC 社区（docs/POSITIONING.md，ROADMAP 第十四节）。落地一项：**课程成果** `api/academy/works.js`，`db.works` / `db.workUses`，六条接口 `GET/POST /api/works`、`/mine`、`/queue`、`/decide`、`/delete`、`/used`；流程同专家案例（教师交→园长同意→审核人入库，退回可改再交），入库 +3 学分（ledger kind `work`）。字段：管线 theme/pbl/activity、年龄班、周数、五大领域、简介 ≥50 字、**changes 至少一条**（在起草稿上改了什么，空的不收：工坊起草不算成果）、文件只收 https 外链 ≤20、source 带工坊课程 id 与地址。投稿令牌范围加 `POST /api/works`（tokens.js SUBMIT_ROUTES），教研工坊按 docs/WORKSHOP-SHARE.md 直接投。网页 `/works` 页（全部 / 我交的 / 待办，管线、领域、年龄筛，「用过，有效」），专家案例页头加「课程成果」chip，顶部导航在 /works 时高亮专家案例，首页加一张入口卡。不显示人数、不排名；用过有效的名单只给分享者本人、本园园长与管理员。openapi 六条、契约测试、`academy-works.test.js` 两条。小程序资料页已加「课程成果」分类（hundredscity 仓库，点开看简介、改了什么、文件名，工坊地址可复制）。
- **2026-10-22（夜 49）** 精品微课与学习路径分工：路径管「走」，微课管「查」。精品微课去掉「系列课」tab（它就是学习路径页左栏的翻版，点开还跳回路径页），默认视图直接是单关卡片，按方向 / 场景筛、关键词搜，不再按路径分组（`?path=` 仍可作次要筛选）。卡片改成查阅形态：点开直接到「讲」（`/level/:id?seg=jiang`，Level 只接受 jiang / kan，做与测仍按草稿），脚注写本人状态（已通过 / 学习中 / 未解锁·可查阅 / 可学）与「看讲与看」。新增两个只有库才有的视图：「本周常查」取本园最近 7 天回传过的实操事件对应的场景排前面（新接口 `GET /api/org/recent-events?days=`，只给事件名与关卡 id，不给次数、不给人；账号没挂园所时只看本人，`scope: self`）；「一日生活」按入园与晨检、进餐与午睡、活动与游戏、过渡与一日常规、健康与特殊情况、离园与家园六个环节分组（`lib/library.js` `DAY_PARTS`，账号、教研、园长工作台等不属于一日生活的场景不出现）。讲堂微课保留为第二个 tab。首页加「遇到事查一下」搜索卡，回车进精品微课；「本周待学」与 Coach 推课本来就指向 Coach 与关卡页，不动。合并两页成一页的方案不取：手机底部 tab 本就分着两格，合并反而多一层。小程序「微课」页同步加了视图行（全部 / 本周常查 / 一日生活，hundredscity 仓库）：本周常查登录后调同一接口，没登录或连不上就按全部并给一句提示；一日生活用同一张环节表（`utils/library.js` `DAY_PARTS`）；卡片点开带 `seg=jiang` 直落「讲」。顺带把小程序微课卡与首页微课卡上的「N 人已学」演示人数去掉（`D.LEARN` 造的假数，违反不展示人数的红线），改显这一关的目标。openapi、契约测试、`academy-events` 测试各加一条；`library.test` 加环节表校验。
- **2026-10-22（夜 48）** 桌面切顶部 tab 时内容左右抖 7px：专家案例、资源库等短页不到一屏，文档滚动条消失，居中列整体右移。`academy.css` 末尾给 `html` 加 `scrollbar-gutter: stable`，六个 tab 的内容列左缘一致（1440 宽下都是 163px）。覆盖式滚动条的系统本来就不抖，这条对它无影响。顺带核过关卡页 reflect-4「用专家案例，也往里放」换名后的文案：标题、学习目标、操作步骤三处都是「专家案例」。
- **2026-10-22（夜 47）** 微课库改名「精品微课」，页面改成课程列表形式（参照神策学堂系列课页）：顶部「课程类型」切 系列课 / 单节课 / 讲堂微课，再按方向（岗位/领域/阶段/管理）与场景筛；每门课一张带封面的卡（封面按方向配色），系列课卡进 `/paths/:key`，卡脚只显示本人进度与「开始/继续/回看」；单节课卡进 `/level/:id`，状态只有 已通过/学习中/可预习；讲堂微课卡进回放或名师讲堂。桌面 4 列、手机 2 列（`academy.css` 末尾 `.course-grid` 系列）。URL 参数 type / kind / path / scene / q 不变含义（带 q 时默认切到单节课）。同时三处改名：案例库→专家案例、大讲堂（园长大讲堂）→名师讲堂、微课库→精品微课，前端、小程序、api 文案（海报、讲堂包提示、通知、荣誉、档案、表格、练习营、合集 kind 标签）与 `academy-lectures-pack` 测试一起改；`lib/lessons-extra.js` 里的「案例库」（13 处课程文案）同步改成「专家案例」，小程序 `utils/extra.js` 由它重新生成，两边一致。数据、接口、权限不动。提醒：「专家案例」字面带专家署名之意，而案例是园里教师实名投稿、审核入库的，对客说明时按「经专家审核入库的园所案例」解释。 小程序页名随之对齐（hundredscity 仓库 aff3317）：「微课」tab 页与导航栏标题 场景微课→精品微课，首页微课分区同改；资料库页保留「资料库」名（该页主体是文献与模板，案例只是其中一个分类，与网页「资源库收进专家案例」方向相反，不强求同构），分类 chip 案例→专家案例，首页共同体卡的「专家案例」链接改为直达 `/pages/library/library?kind=case`（library.js 加 onLoad 读 kind）；名师讲堂页上轮已改。本机没有微信开发者工具，只做了模板与逻辑层核对，字号与换行待装上工具后看。
- **2026-10-22（夜 46）** 资源库撤出顶部导航，入口放进案例库页头（chip），微课库页头不再放资源库；在资源库页时顶部导航高亮案例库。原因：三个「库」并排教师分不清，资源是做案例时查依据的参考书架，从案例库进最顺；数据、接口、权限、运营后台一行不动，案例库与资源库仍是两套（案例有投稿/审核/署名/改编链，资源是静态材料）。手机底部 tab 本来就没有资源库，不变；小程序的资料库页独立，不动。 顺带：手机（<1000px）页头动作区允许换行、标题列至少占一半（`academy.css` 末尾 `#app .hdr` 两条），案例库页头三个动作时副题不再挤成四行窄柱；桌面不受影响。
