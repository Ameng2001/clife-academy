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

## 证据提交与点评

实践关、研讨关的「做」不走平台事件，走提交（`api/academy/submissions.js`）：`POST /api/submissions` 交文字与照片引用（照片先 `PUT /api/media/{hash}` 存在本人名下），`GET /api/submissions?level=` 看本人的提交与点评，研讨关交过以后带同园他人的作答。
点评权是园长、管理员或 `academy.reviewer === true` 的账号（园长在网页 `/org` 本园人员里点「设为点评人」，走 `PUT /api/org/reviewer`，只能标本园的人、不能标自己）：`GET /api/review/queue` 本园待点评，`POST /api/submissions/review` 给 pass / revise 与 1–5 分量表，revise 必须写意见；只能点评本园、非本人的提交。带教教师（`api/academy/pairs.js`，园长在 `/org` 配对）不需要 reviewer 标记，也能看、能点评所带的人的提交。证据文件经 `GET /api/submissions/file?id=&hash=`，提交者本人或本园点评人可读。网页 `/review`，小程序首期只交文字。

案例库审核权（`api/academy/cases.js`）是管理员或 `academy.curator === true` 的账号，由管理员 `PUT /api/cases/curator` 指定，不限园所、可跨园审。园长只管「同意」本园老师的自荐（也可不同意），不能入库。已入库案例要登录才能看，全平台实名共享；本人、本园园长、管理员可删。
园长大讲堂（`api/academy/lectures.js`）：排场、改、删只有管理员（本地运营方）；场次谁都能看（不登录也行），预约要登录；讲义走链接或上传一张图，直播与回放都是第三方链接。网页 `/lectures`，小程序「大讲堂」页与首页卡。
每周一题（`api/academy/drills.js`）：出题是管理员（面向全平台）或园长（只面向本园）；作答要登录，一人一题一份；别人的作答同园可见、且自己先答了才看得到，园长、点评人、管理员与作答人的带教教师不用先答。点评只有一句意见和「精选」标记，没有分数与排名；作答被点评后走 `review` 模板发一条。网页 `/drills`，小程序「每周一题」页与首页卡。
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
