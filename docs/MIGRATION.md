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
| cohort：实例内匿名中位数对比 | 园所间匿名中位数（≥3 园才显示，不排名） | 无，新增 |
| MCP 只读桥 | 园长、教育局用自己的 LLM 客户端问进度 | 无，后置 |
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
