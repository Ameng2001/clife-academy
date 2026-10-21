# 登录：三条入口

上游的 passkey 与密码路由原样保留但不在界面上出现。大课堂自己的入口在 `api/auth/`，三条路落到同一件事：
找到或建立 `db.users` 里的一个用户，发一张 session（网页用 cookie，小程序用返回的 `token` 作 `Authorization: Bearer`，
两者是同一个 `makeSession`），岗位与园所记在 `user.academy = { role, org, source, linkedAt }`。

| 入口 | 路由 | 开关 | 身份键 | 岗位来源 |
|---|---|---|---|---|
| 微信小程序 | `POST /api/login/wechat` `{ code, name? }` | `WX_APPID` ＋ `WX_SECRET` | `user.wx.openid` | 默认 `teacher`，园长改 |
| 平台账号 | `POST /api/login/platform` `{ ticket }` | `PLATFORM_AUTH_URL`（可选 `PLATFORM_AUTH_KEY`、`PLATFORM_LOGIN_URL`） | `user.platform.uid` | 平台每次登录刷新，权威 |
| 开发桩 | `POST /api/login/dev` `{ name, role, org }` | `DEV_LOGIN=1` | `user.dev && user.name` | 表单给什么是什么 |

没开的入口是 404，`GET /api/config` 的 `auth` 块说哪几条开着，登录页按它渲染。`GET /api/me` 带回 `academy`。
三条路由只花地址预算、不按账号计失败：code 与 ticket 都是外部签发，猜不出来。

## 平台契约（待与平台团队对齐）

```
POST {PLATFORM_AUTH_URL}
Authorization: Bearer {PLATFORM_AUTH_KEY}
{ "ticket": "..." }

200 { "uid": "p-123", "name": "李老师", "org": { "id": "o-1", "name": "柳北区示例幼儿园" }, "role": "nurse" }
非 200 = 票据无效
```

`role` 认英文键（nurse / teacher / care / it / director）也认中文岗位名（保健医、班级教师、保育员、信息接口人、园长、副园长……），
对照表在 `api/auth/platform.js` 的 `ROLE_ALIASES`；认不出落到 `teacher`。字段按名取，平台多给的不入库。
网页端「平台账号登录」按钮跳 `PLATFORM_LOGIN_URL?redirect={ORIGIN}/#/login/platform`，平台登录完带 `?ticket=` 跳回，前端换会话。

## 小程序侧

小程序 `wx.login()` 拿 code，`POST /api/login/wechat`，把返回的 `token` 存起来，之后每个请求带 `Authorization: Bearer`。
`GET /api/me` 在 token 过半有效期时会带回新 token，收到就替换。小程序工程现在还在文档仓库的原型里，接口接入是第 1 周待办。

## 同一个人两条路

微信登录和平台登录会是两个用户。合并靠平台方做 unionid 或手机号对账，首期不做；柳州正式环境建议只开平台登录，
小程序里也走平台的登录态（平台小程序内嵌或拉起时带 ticket），微信入口留给没有平台账号的试用。

## 测试

`api/test/auth.test.js`：真 server.js 子进程，微信与平台用本地桩顶替，6 项。
