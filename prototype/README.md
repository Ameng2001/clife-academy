# 学前大课堂 · 可点通原型

单页 Web 应用，纯静态 HTML，无构建依赖（字体走 Google Fonts，离线自动回退）。结构沿用 `Plugins/clife-pet-proj/pet-app`。

| 文件 | 内容 |
|---|---|
| `src/academy.body.html` | **源文件**（Artifact 片段，无 html/head/body 外壳），只改这一份 |
| `build.py` | 由 `src/` 生成可独立打开的 `学前大课堂.html` |
| `学前大课堂.html` | 生成物，双击即可打开，不要直接改 |

```bash
cd app && python3 build.py
```

## 页面与路由

路由以内存为准，同步写入地址栏 `#xxx`，浏览器前进后退可用；地址栏不可写的预览环境也能跳转。

| 路由 | 页面 |
|---|---|
| `#home` | 首页（各身份都显示本人路径进度、下一关与体检；园长身份另有全园岗位完成情况与补训建议） |
| `#paths` | 学习路径（五条路径全部关卡＋区县管理员待上线路径） |
| `#level-<路径>-<关号>` | 关卡页，路径为 `nurse / teacher / care / it / director`，如 `#level-nurse-6` |
| `#lessons` | 精品微课（全部 / 本周常查 / 一日生活三个视图，岗位 × 场景筛选，点开直落「讲」，未解锁关卡可先看微课与录屏） |
| `#community` | 教研共同体 tab，和网页端同一形态：tab 最新 / 本园 / 本共同体 / 合集，「本期」大卡（市级展示案例或名师讲堂最近一场），「动动手」四入口，带类型底色封面的作品卡两列（案例、成果、合集），按领域筛、可搜；不显示人数与点赞；分享在网页端 |
| `#checkup` | 本园应用体检（12 项、近 4 周状态、推课入口），二级页，从首页卡或「我的」进 |
| `#district` | 区县看板（园所名单、覆盖率中位数、认证人数、共同体活动、体检汇总；区县管理员岗位） |
| `#live` `#drill` `#library` `#local` `#me` | 名师讲堂、情景练兵、资料库（含专家案例）、本地专区（工单与报修）、我的（学分、徽章、学习记录、认证） |

## 演示要点

- 右上角切换身份：保健医、班级教师、保育员、信息接口人、园长。
- 「引导演示」9 步：保健医首页 → 体检 → 第 6 关讲、看、做、测 → 首页进度更新 → 园长首页 → 园长路径第 3 关。
- 通关条件：实操回传（原型用「模拟平台回传」）＋测验全部答对。通关后学分 +1、下一关解锁，首页、路径页、我的同步更新。
- 进度存在浏览器本地，顶部「重置演示进度」恢复初始状态（保健医 5/12、教师 2/10、保育员 1/4、信息接口人 0/2、园长 2/6）。

## 内容口径

- 34 关。保健医、教师、保育员、信息接口人 28 关的标题与步骤取自《数智幼教培训-园医模块》《数智幼教培训模块（教学）》的实操任务；园长 6 关（工作台总览、风险与待办处置、全园指标、回执与复盘、读体检卡、数据与家长沟通）取自生态体系总体方案的「园长智助」与本方案的体检、合规口径；第 6 关「全日观察与疾病登记」为完整样板（4 幕白板分镜、4 段录屏章节、3 道题），其余关卡按步骤自动生成分镜与录屏章节。
- 园所、人员、学习人数、体检读数均为示例。
- 合规：课程只面向教职工；观察记录写「教师口述、AI 整理、教师审定」；不出现面向幼儿的陪伴类功能；体检不含幼儿数据、不排名、不作考核。

## 已发布的 Artifact

- C-Life 学前大课堂（可点通版）：https://claude.ai/artifact/MfTkevA8RR6uguPwqp79Rn
- 早期单页原型：首页 https://claude.ai/artifact/XU1nxnEKKvbAfQiwhrSd4y ，关卡页 https://claude.ai/artifact/GAEJZxkCreubDMHRm9BEmx

改动 `src/` 后同步线上：用 `src/academy.body.html` 重新发布并带上 URL，链接不变。

## miniprogram/ · 微信小程序版（2026-10-17）

同一套课程数据的微信小程序实现，可直接用微信开发者工具打开本目录（`project.config.json` 指向 `miniprogram/`，AppID 用测试号）。

| 文件 | 内容 |
|---|---|
| `miniprogram/utils/data.js` | **生成物**：课程、体检、资料、直播、练兵数据，由 `gen_mp_data.py` 从 `src/academy.body.html` 抽取；改课程只改 H5 源，然后 `python3 gen_mp_data.py` |
| `miniprogram/utils/config.js` | `API_BASE`：clife-academy api 地址（开发 `http://127.0.0.1:3000`，开发者工具勾掉「校验合法域名」） |
| `miniprogram/utils/api.js` | `wx.request` 封装，登录后每个请求带 `Authorization: Bearer`；401 清本地 token |
| `miniprogram/utils/auth.js` | 微信登录：`wx.login()` 的 code → `POST /api/login/wechat`；平台票据登录 `loginPlatform(ticket)`（平台小程序拉起或二维码带票据，`app.js` 启动时读）；`/api/me` 换新 token；退出；改岗位 `PUT /api/me/academy` |
| `miniprogram/utils/library.js` | 精品微课搜索：标题、目标、步骤、平台菜单路径，多词须同时命中；「微课」页的搜索框用它 |
| `miniprogram/utils/events.js` | 平台实操事件：`GET /api/events` 缓存、`has(event)` 判「做」完成、演示回传 `POST /api/events` |
| `miniprogram/utils/extra.js` | 领域路径（「观察与评价」2 关、「沟通与合作」6 关、「教育活动计划与实施」8 关、「环境创设与利用」6 关、「游戏活动支持与引导」6 关、「反思与发展」6 关）、阶段路径（「新教师入职」6 关、「主题与项目课程」6 关、「园所管理」6 关，标入职 / 骨干 / 管理阶段）、区县管理员路径 6 关，以及接在保健医、保育员路径末尾的一日生活 4 关（`APPEND`），由 clife-academy 的 `lessons-extra.js` 生成，不手改；`gen_mp_data.py` 把它合进 `data.js`（`ROLE_PATHS`、`PATH_META`） |
| `miniprogram/utils/resources.js` | 资源库：`GET /api/resources`；资料页接它，连不上回落演示资料；链接复制后浏览器打开，上传在网页端 |
| `miniprogram/utils/resources.js` `cases()` | 专家案例：`GET /api/cases`，资料页「专家案例」分类；`works()` 课程成果分类（`GET /api/works`）；`collections()` 合集（`GET /api/collections`，共同体页用），登录后能看、点开读全文；分享、园长同意、审核入库都在网页端 `/cases` |
| `miniprogram/utils/drills.js` | 每周一题：`GET /api/drills`、作答 `POST /api/drills/answer`、同园作答 `GET /api/drills/answers`；「每周一题」页（原情景练兵）与首页卡接它，没登录或连不上回落演示题；出题与点评在网页端 `/drills` |
| `miniprogram/utils/checkup.js` | 探针体检卡：园长 `GET /api/org/checkup`，成员 `GET /api/me/checkup`；体检页园长登录后取真卡、否则演示数；首页按岗位显示「本园体检推给你的关」 |
| `miniprogram/utils/contests.js` ＋ `pages/contest/` | 斗课园内赛：`GET /api/contests`、`/one`，文字应战 `POST /api/contests/enter`，互评 `POST /api/contests/rate`；片段上传与主持（出题、编组、对照、入选、收官）在网页端 `/contests` |
| `miniprogram/utils/district.js` ＋ `pages/district/` | 区县看板：`GET /api/district/summary`、园所名单与挂接 `GET/PUT /api/district/orgs`；区县管理员岗位（`district`）登录后取真数，否则演示数；首页多一个入口。跨园共同体：区县页列本区各组，首页「跨园共同体」卡（`GET /api/me/community`）；建组在网页端 |
| `miniprogram/utils/certs.js` | 证书与认证期次：`GET /api/me/certificates`（我的证书、三级条件进度、期次）、报名 `POST /api/cohorts/apply`；「我的」页多一段；开班与答辩结果在网页端 `/certs` |
| `miniprogram/utils/questions.js` | 答疑：关卡页底部提问 `POST /api/questions`（助手整理与起草，种子教师回答）、本关问答 `GET /api/questions?level=`、采纳、已解决；回答与确认草稿在网页端 `/questions` |
| `miniprogram/utils/growth.js`、`pages/growth/` | 专业发展（本人这一侧）：Coach 排一学期、周回顾、采用 `/api/me/coach*`；本学期自评 `/api/me/selfreview`；园内教研组交反思 `/api/studytasks`；练习营报名、发当天任务、退营 `/api/camps*`；研修项目报名 `/api/programs*`；园所分享日各园的一页 `/api/sharedays`；首页园长段多一行上周运营周报 `/api/ops/weekly`。发任务、办营、建期次、办分享日、写三方评、邀分享者上讲堂、斗课扩展形式出题都在网页端 |
| `miniprogram/utils/studios.js`、`pages/studio/` | 名师工作室与市级展示：工作室名单与产出 `GET /api/studios`、申请加入；市级展示上台作品与名师点评 `GET /api/showcases`；建室、办展、上台、点评在网页端 `/studios` |
| `miniprogram/utils/portfolio.js` | 发展档案与学时：「我的」页一段，本学年分钟与学时、已出具的证明编号 `GET /api/me/hours`；打印、下载 JSON、出具证明在网页端 `/portfolio` |
| 发展档案随人迁移 | 同城换园登录自动留痕（档案「随人走」一节）；换城市的迁移包导出、迁入与核验只在网页端 `/portfolio`，小程序不做文件操作 |
| 首页园长段「与其他园对照」 | `GET /api/org/cohort`（`utils/auth.js` `orgCohort`）：本园对全市其他园与本区其他园的整体完成率、近 30 天在学占比的中位数，≥ 3 所才给；岗位与领域的明细在网页端园长看板 |
| 首页园长段「点评时效」 | `GET /api/review/stats`（`utils/auth.js` `reviewStats`）：待点评、超两个工作日、近 30 天中位时长、答疑队列；全平台各园一行在网页端 `/ops`（管理员） |
| `miniprogram/utils/honors.js` | 荣誉与学分：`GET /api/me/honors`、`GET /api/me/points`、兑积分 `POST /api/me/points/exchange`；「我的」页学分含案例与精选、积分与兑换、称号、勋章；称号授予在网页端园长看板 |
| `miniprogram/utils/lectures.js` | 名师讲堂：`GET /api/lectures`、预约 `POST /api/lectures/book`；讲堂包随场次带回（讲前 `pack.preview.points` 预习卡，讲完 `pack.clips` 微课切片与 `pack.poster` 海报，大讲堂页直接显示）；大讲堂页与首页卡接它，连不上回落演示场次；预约时问一次 `lecture` 订阅（开播前 30 分钟一条）；直播、回放、讲义链接复制后外部打开，排场在网页端 `/lectures` |
| `miniprogram/utils/capability.js` | 能力地图：七个领域各一个状态，证据是工具关通过、作品通过点评、研讨作答；「我的」页一段 |
| `miniprogram/utils/notify.js` | 订阅消息：`GET /api/notify` 取模板，`wx.requestSubscribeMessage` 后 `POST /api/notify/subscribe` 记额度；实践关提交后问一次点评结果通知，园长首页按钮订阅新提交提醒 |
| `miniprogram/utils/submissions.js` | 实践关、研讨关的提交：`GET/POST /api/submissions` 缓存、`done(level, list)` 判「做」完成（实践关要点评通过，研讨关交了就算） |
| `miniprogram/utils/sync.js` | 进度文档（与网页端同一结构）与同步：`PUT /api/data` 条件写、409 并集、回前台查修订；未登录时预置演示进度，登录时不带进账号 |
| `miniprogram/utils/store.js` | 页面用的状态：游标与学分从文档现算；单关四段草稿、预约/作答/工单只留本机 |
| `miniprogram/utils/brand.js` | 平台名称：启动时取 `/api/config` 的 brand（全称、短名、地区、一句话），缓存本机；顶栏与导航栏标题从这里取，运营方在网页运营后台改一处小程序跟着换 |
| `miniprogram/components/topbar` | 顶部名字与地区副题（来自 brand）＋身份切换（picker）＋原型提示条＋重置 |
| `mp-render.mjs` | 没装微信开发者工具时看页面效果：Node 顶替 wx 跑某页的 onLoad/onShow（真 api 在 :3000，可带 dev 登录的 `{user,token}`），再把 wxml 渲成一张 375 宽的 html（带 tabBar）。`node mp-render.mjs miniprogram community out.html "$(curl -s -X POST http://127.0.0.1:3000/api/login/dev -H 'Content-Type: application/json' -d '{"name":"赵园长","role":"director","org":"柳北区示例幼儿园"}')"`。只认 wx:if/elif/else、wx:for 与 {{}}，组件 topbar 画成静态条 |
| `miniprogram/pages/*` | 10 个页面：home / paths / lessons / community / me 五个 tab，level / live / drill / library / local / checkup 为二级页（体检从 tab 让位给教研共同体，首页卡与「我的」保留入口） |
| `miniprogram/assets/lesson6.mp4` | 第 6 关白板微课样片（960×540，1.5 MB），关卡页「讲」段用 `<video>` 播放；其余关卡显示分镜占位 |

路由：`/pages/level/level?p=nurse&i=5` 打开保健医第 6 关（`i` 从 0 起）。通关逻辑、体检推课、园长视角与 H5 相同。

包体 1.55 MB，低于主包 2 MB 上限；再加视频就要拆分包或改为远程地址。

登录与同步（2026-10-22）：「我的」页微信登录，进度随账号与网页端（clife-academy）互通；服务端见 `~/Codes/clife-academy/docs/AUTH.md`；与平台的登录对接契约见上一级目录《平台登录对接契约.md》（待平台接口人确认）。园长看板已接（首页园长块登录后取 `GET /api/org/summary` 的本园汇总，未登录仍是演示数）。实操事件回传已接（服务端 `POST /api/events`，契约见上一级目录《平台实操事件回传契约.md》；关卡页登录后每 10 秒查一次，收到即通关）。关卡三种类型已接（`type` 为 practice / seminar 的关，「做」这一段改为交文字，照片上传与点评在网页端 `/review`）。订阅消息已接（点评结果、本园新提交两类，模板 ID 待在公共模板库选定后填服务端 `WX_TMPL_*`）。「我的」页有能力地图与带教关系（配对与点评在网页端园长看板做）。未做的事：真机联调（需 WX_APPID/WX_SECRET 与合法域名）、回放播放器、资料下载。

## 相关调研

- `../迁移方案-openGym改教师Coach.md`：以 openGym（自托管健身 PWA，本质是 coach 闭环）为蓝本改成教师 Coach 的模块级迁移清单、闭合变更清单、数据模型与 11-20 排期。
