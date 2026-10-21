# 登录：三条入口

上游的 passkey 与密码路由原样保留但不在界面上出现。大课堂自己的入口在 `api/auth/`，三条路落到同一件事：
找到或建立 `db.users` 里的一个用户，发一张 session（网页用 cookie，小程序用返回的 `token` 作 `Authorization: Bearer`，
两者是同一个 `makeSession`），岗位与园所记在 `user.academy = { role, org, source, linkedAt }`。

| 入口 | 路由 | 开关 | 身份键 | 岗位来源 |
|---|---|---|---|---|
| 微信小程序 | `POST /api/login/wechat` `{ code, name? }` | `WX_APPID` ＋ `WX_SECRET` | `user.wx.openid` | 默认 `teacher`，园长改 |
| 平台账号 | `POST /api/login/platform` `{ ticket }` 或 `{ code, redirect_uri? }` | `PLATFORM_AUTH_MODE=ticket`：`PLATFORM_AUTH_URL`；`oauth2`：authorize/token/userinfo 三地址＋`PLATFORM_CLIENT_ID` | `user.platform.uid` | 平台每次登录刷新，权威 |
| 开发桩 | `POST /api/login/dev` `{ name, role, org }` | `DEV_LOGIN=1` | `user.dev && user.name` | 表单给什么是什么 |

没开的入口是 404，`GET /api/config` 的 `auth` 块说哪几条开着，登录页按它渲染。`GET /api/me` 带回 `academy`。
三条路由只花地址预算、不按账号计失败：code 与 ticket 都是外部签发，猜不出来。

## 平台契约

全文与给平台接口人的待对齐清单在 `docs/PLATFORM-AUTH.md`（文档仓库同步一份《平台登录对接契约.md》）。要点：

- 两种方式由 `PLATFORM_AUTH_MODE` 选。`ticket`：平台登录页带 `redirect` 跳回 `?ticket=`，服务端 `POST PLATFORM_AUTH_URL {ticket}` 核验；
  `oauth2`：标准授权码，前端生成 `state` 存 sessionStorage，回跳 `{ORIGIN}/login/platform?code=&state=`，服务端换 token 再取 userinfo。
- 档案五个字段 `uid / name / orgId / orgName / role` 按点路径从平台答复里取，位置由 `PLATFORM_FIELDS` 配；
  「200 外包业务码」用 `PLATFORM_OK=code=0` 判成功。`role` 认英文键也认中文岗位名，可给数组；对照表在 `api/auth/platform.js` 的 `ROLE_ALIASES`，认不出落到 `teacher`。
- `GET /api/config` 的 `auth` 多两个字段：`platform_mode`、`platform_login_url`（oauth2 时已拼好 client_id 与 redirect_uri，前端只加 `state`）。
- 票据或授权码无效 401 `rejected`；平台没答、答复缺 uid 502 `upstream`；未配置 404。

## 实操事件回传

关卡「做」的判通：平台 `POST /api/events`（服务端密钥）回传事件，网页端与小程序每 10 秒问 `GET /api/events`。契约在 `docs/PLATFORM-EVENTS.md`，实现在 `api/academy/events.js`，事件清单由 `scripts/build-academy-events.mjs` 从课程包生成。`DEV_LOGIN=1` 时本人可给自己回传（演示按钮）。

## 园长看板

`GET /api/org/summary`（`api/academy/org.js`）：园长或管理员看本园各岗位汇总与补训建议，按 `academy.org` 圈人，不跨园；人员列表无测验分。网页 `/org`，小程序首页园长块。

## 区县看板

`GET /api/district/summary`（`api/academy/district.js`）：区县管理员（`academy.role === 'district'`，没有园所、有 `academy.district`）或管理员（`?district=`）看本区汇总：园所名单（无数字）、园所数、在学人数、认证人数、各领域覆盖率中位数（不足 3 园不给）、共同体活动、体检汇总的两个计数。一所园属于区县，当它的成员账号带同一个 `academy.district`（平台给），或区县管理员 `PUT /api/district/orgs` 手工挂接。不给任何一所园的数，不排名。网页 `/district`，小程序 `pages/district`。

跨园共同体（`api/academy/communities.js`）：区县管理员在本区园所里编组（`POST /api/district/communities`，2–6 园，一园一组）；组内共享案例库（`GET /api/cases?community=1`）与联合研讨题（区县管理员出题指定共同体，组内各园看得到作答）；任何成员 `GET /api/me/community` 只看到自己组的名单。点评仍按园，不跨园。共同体赛：区县管理员在 `POST /api/contests` 里带 `communityId`，组内各园教师应战、跨园互评，区县管理员只主持不打分。

## 证据提交与点评

实践关、研讨关的「做」不走平台事件，走提交（`api/academy/submissions.js`）：`POST /api/submissions` 交文字与照片引用（照片先 `PUT /api/media/{hash}` 存在本人名下），`GET /api/submissions?level=` 看本人的提交与点评，研讨关交过以后带同园他人的作答。
点评权是园长、管理员或 `academy.reviewer === true` 的账号（园长在网页 `/org` 本园人员里点「设为点评人」，走 `PUT /api/org/reviewer`，只能标本园的人、不能标自己）：`GET /api/review/queue` 本园待点评，`POST /api/submissions/review` 给 pass / revise 与 1–5 分量表，revise 必须写意见；只能点评本园、非本人的提交。带教教师（`api/academy/pairs.js`，园长在 `/org` 配对）不需要 reviewer 标记，也能看、能点评所带的人的提交。证据文件经 `GET /api/submissions/file?id=&hash=`，提交者本人或本园点评人可读。网页 `/review`，小程序首期只交文字。

案例库审核权（`api/academy/cases.js`）是管理员或 `academy.curator === true` 的账号，由管理员 `PUT /api/cases/curator` 指定，不限园所、可跨园审。园长只管「同意」本园老师的自荐（也可不同意），不能入库。已入库案例要登录才能看，全平台实名共享；本人、本园园长、管理员可删。
园长大讲堂（`api/academy/lectures.js`）：排场、改、删只有管理员（本地运营方）；场次谁都能看（不登录也行），预约要登录；讲义走链接或上传一张图，直播与回放都是第三方链接。网页 `/lectures`，小程序「大讲堂」页与首页卡。
每周一题（`api/academy/drills.js`）：出题是管理员（面向全平台）或园长（只面向本园）；作答要登录，一人一题一份；别人的作答同园可见、且自己先答了才看得到，园长、点评人、管理员与作答人的带教教师不用先答。点评只有一句意见和「精选」标记，没有分数与排名；作答被点评后走 `review` 模板发一条。网页 `/drills`，小程序「每周一题」页与首页卡。
荣誉与学分（`api/academy/honors.js`、`points.js`）：勋章不存、按记录算，本人经 `GET /api/me/honors` 看；称号由园长授本园的人、管理员授任何人，必须写理由，不能授自己；关卡以外的学分台账记案例入库 +2、作答精选 +2。学分兑积分只有本人能做、一次性不可逆；积分的查余额与扣减是工具服务端带 `TOOLS_API_KEY` 调（教研工坊、观察评价工具、贝果实验室），同一 (tool, ref) 只扣一次；管理员可查任何人的流水对账。
斗课园内赛（`api/academy/contests.js`）：出题、编组、对照点评、定入选、收官是主持人——本园园长、点评人或管理员；应战要登录、同园、应战期内，一人一份；应战期间别人的设计看不到，截止后同园都能看；互评只在互评期、同园、不评自己，一人一份可改。分数保密：作者看自己的分与每条一句话（实名），主持人看平均分定入选，其他人只看到评了几人。收官时全部作品以作者署名直接入案例库（视为园长同意＋入库），每份 +2 学分。
探针体检卡（`api/academy/checkup.js`）：平台带 `PLATFORM_EVENTS_KEY`（或管理员登录）回传园级数字 `POST /api/checkup`；体检卡只有本园园长与管理员能看（`GET /api/org/checkup`）；任何成员 `GET /api/me/checkup` 只拿到推给自己岗位的关，看不到整张卡。
## 证书与认证期次

`api/academy/certificates.js`：证书只给本人（`GET /api/me/certificates`）与本园园长（`GET /api/org/certificates`，只有人名、级别、日期）；核验接口公开但姓名脱敏。认证期次由管理员（本地运营方）开班与记答辩结果；报名要在窗口内且条件达到，服务端按记录判，不信客户端。

## 订阅消息

小程序订阅消息（`api/academy/notify.js`），只做三类、都是事件触发：实践关被点评了通知教师（`review`），本园有新的实践关提交通知园长与点评人（`queue`），本人预约的园长大讲堂开播前 30 分钟（`lecture`，`api/academy/lectures.js` 每分钟查一次，每人每场只发一条）。没有定时的「今日一关」提醒，守 ROADMAP 第九节「不催、不计在线时长」。
订阅消息是一次性的：小程序里用户每点一次「允许」，`POST /api/notify/subscribe` 记一次额度，发一条用一条；点「拒绝」或微信答 43101 清零。`GET /api/notify` 给模板 ID 与本人剩余额度。模板 ID 与字段映射走 `WX_TMPL_*`（见 `.env.example`），没配时路由不存在、提交与点评照常。
发送要 openid：微信登录的账号自带；平台账号在小程序里订阅时带 `wx.login()` 的 code，服务端换 openid 绑到该账号（`user.wx.openid`，只用于推送；已被别的账号占用的 openid 不抢）。

## 小程序侧

小程序工程在文档仓库 `deals/06 柳州-徐明/本地运营/学前大课堂/app/miniprogram/`，接口层三个文件：

| 文件 | 做什么 |
|---|---|
| `utils/api.js` | `wx.request` 封装：`API_BASE`（`utils/config.js`）＋ `Authorization: Bearer`；非 2xx reject 带 `{ status, data, code }`；401 清本地 token |
| `utils/auth.js` | `login(name)`：`wx.login()` 的 code → `POST /api/login/wechat` → 存 token 与 user；`me()`：`GET /api/me`，带回新 token 就替换；`logout()`；`setRole()` → `PUT /api/me/academy` |
| `utils/events.js` | 本人收到的平台事件：`load()`、`has(event)`、`demo(event)`；按账号缓存，退出清空 |
| `utils/sync.js` | 进度文档与网页端同一结构，`PUT /api/data` 条件写、409 并集再推、回前台查 `/api/data/rev`；登录接管：演示进度（`demo:true`）丢掉，本机真通过的关问一句再并入 |

`app.js` 启动时先看启动参数有没有平台票据（`referrerInfo.extraData.ticket` 或二维码 `query.ticket`）：有就 `auth.loginPlatform(ticket)` 换会话并接管本机进度，没有才 `auth.me()` → `sync.pull()`；`onShow` 查修订号；「我的」页有微信登录与退出。岗位：微信登录默认 `teacher`，本人在顶栏切换即 `PUT /api/me/academy`；平台账号 403，以平台为准。
服务端要设 `WX_APPID` / `WX_SECRET`，开发者工具勾掉「校验合法域名」。

## 同一个人两条路

微信登录和平台登录会是两个用户。合并靠平台方做 unionid 或手机号对账，首期不做；柳州正式环境建议只开平台登录，
小程序里也走平台的登录态（平台小程序内嵌或拉起时带 ticket），微信入口留给没有平台账号的试用。

## 测试

`api/test/auth.test.js`：真 server.js 子进程，微信与平台用本地桩顶替，9 项（含 `PUT /api/me/academy`、平台外包业务码＋字段点路径、oauth2 授权码）。
