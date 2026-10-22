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
- **2026-10-22（夜 40）** 桌面壳与登录前页：≥ 1000px 时底部 tab 藏掉，换顶部导航 `academy/components/TopNav.jsx`（首页、学习路径、微课库、案例库、大讲堂、资源库，按角色加园长看板 / 区县看板 / 运营后台，右侧「我的」与设置）；容器 1200，`.narrow.wide` 页 1100（首页与浏览、看板、后台、队列类页面），学习页仍 640 居中；首页两栏（主栏今天这一关与进度，右栏大讲堂、每周一题、斗课、答疑、共同体、带教、点评队列）。没登录时是 `views/Landing.jsx`：桌面左栏介绍、三条原则、路径目录、下一场大讲堂与回放数（读 `/api/lectures`，不登录也给），右栏是原 Login 卡；手机上只有登录卡。不是门户：案例库与看板仍要登录。样式都在 `academy.css` 断点里，手机一切不变。案例库各列表与大讲堂（下一场之外的场次、回放）在桌面上两列（`.grid2`），展开的案例卡占满两列。全页核对：34 条路由无横向溢出、无遗留固定底栏；园长看板、点评、发展档案、能力地图补上宽栏；chips 在桌面换行不再横滑。学习页（关卡、路径、我的、Coach、自评、证书、设置、拿来就用、口径）保持 640 居中是有意的。
- **2026-10-22（夜 41）** 口径库：`api/academy/policy.js` 十条红线（id、是什么、为什么、管哪里、给模型的一句），`systemRules(ids)` 拼「规矩」段；Coach、讲堂包、轻形态、答疑助手的 SYSTEM 提示改为从它拼（各模块导出 SYSTEM 供测试）。`GET /api/policy` 不登录也给；网页 `/policy` 只读页，运营后台「审计」组一行「平台口径」，登录前页三条原则读它；MCP 加 `policy` 工具（17 个）。改口径只改那一个文件。测试 `test/academy-policy.test.js`。
