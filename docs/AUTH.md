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
