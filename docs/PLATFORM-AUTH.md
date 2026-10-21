# 大课堂 × 柳州市学前教育数智服务平台：登录对接契约

给平台（数智民生基座「统一身份与权限」子系统）的技术接口人看，大课堂这边照此实现。
双方确认后，把本文「待对齐」一节的答案填进去，再按「配置」一节把参数发给大课堂运维。

## 1. 边界

- 平台账号是「手机号＋验证码」，电脑端、「柳州智投」小程序、教育云 PAD 三端共用。**大课堂不碰手机号与验证码**，也不存平台口令。
- 大课堂只接「平台已经登录过的人」：平台把身份交过来，大课堂按平台用户标识找到或建立自己的用户记录。
- 岗位与园所以平台为准：每次从平台登录都刷新，大课堂用户不能自己改。
- 大课堂需要的字段只有五个：用户标识、姓名、园所编码、园所名称、岗位。平台多给的字段不入库。

## 2. 两种对接方式（选其一）

### 方式 A：一次性票据（ticket）

适合平台已有「跳转第三方应用带票据」的现成能力。

```
1. 用户在大课堂点「平台账号登录」
   → 302  {PLATFORM_LOGIN_URL}?redirect={大课堂回跳地址}
2. 平台确认登录态（没登录就走手机号＋验证码），签发一次性票据
   → 302  {大课堂回跳地址}?ticket=…
3. 大课堂服务端拿票据向平台核验
   POST {PLATFORM_AUTH_URL}
   Authorization: Bearer {PLATFORM_AUTH_KEY}      ← 平台给大课堂的服务端密钥
   Content-Type: application/json
   { "ticket": "…" }
4. 平台答复用户档案（见第 3 节），大课堂据此发自己的会话
```

票据要求：一次性、有效期不超过 5 分钟、与签发时的 redirect 绑定（防止被转到别的站）。
核验接口只接受带正确密钥的调用；非 200 或业务码非成功均视为票据无效。

### 方式 B：OAuth2 授权码（标准）

适合基座已经有 OAuth2 / OIDC 能力。大课堂作为一个 client 注册。

```
1. 用户点「平台账号登录」
   → 302  {authorize_url}?response_type=code&client_id=…&redirect_uri={大课堂回跳地址}&state=…[&scope=…]
2. 平台确认登录态，回跳
   → 302  {redirect_uri}?code=…&state=…
3. 大课堂服务端换 token
   POST {token_url}   application/x-www-form-urlencoded
   grant_type=authorization_code&code=…&client_id=…&client_secret=…&redirect_uri=…
   ← 200 { "access_token": "…", "token_type": "Bearer", "expires_in": … }
4. 大课堂服务端取用户信息
   GET {userinfo_url}   Authorization: Bearer {access_token}
   ← 200 用户档案（见第 3 节）
```

大课堂需要平台提供：authorize / token / userinfo 三个地址、client_id、client_secret，并把大课堂的 redirect_uri 加入白名单。
`state` 由大课堂生成并校验。只用授权码一步换 token，大课堂不保存 access_token，也不需要 refresh_token。

## 3. 用户档案

无论哪种方式，最后一步平台答复的 JSON 里要能读出前五个字段；区县两个字段可选。字段名与层级不要求与下表一致，大课堂配置点路径即可。

| 大课堂字段 | 含义 | 要求 | 默认点路径 |
|---|---|---|---|
| `uid` | 平台用户唯一标识 | **必填**，稳定不变（换手机号也不变），≤64 字符，字符串或数字 | `uid` |
| `name` | 姓名 | 可缺，缺则显示「平台用户」 | `name` |
| `orgId` | 园所编码 | 建议给；用于按园统计 | `org.id` |
| `orgName` | 园所名称 | 建议给 | `org.name` |
| `role` | 岗位 | 可缺，缺则按「班级教师」；可给数组（多岗位取第一个认识的） | `role` |
| `districtId` | 区县编码 | 可缺；区县管理员账号必给其一；园所账号给了则区县看板按它圈园 | `district.id` |
| `districtName` | 区县名称 | 可缺 | `district.name` |

成功判定：HTTP 200；若平台习惯「200 外包业务码」（如 `{ code: 0, data: {…} }`），告知成功码字段与取值，大课堂配置 `PLATFORM_OK=code=0`。

岗位取值对照（平台给中文名或英文键都认，认不出按班级教师）：

| 大课堂岗位 | 平台可能的叫法 |
|---|---|
| nurse 保健医 | 保健医、保健员、保健老师、卫生保健、园医、医务 |
| teacher 班级教师 | 班级教师、教师、老师、主班、配班、班主任 |
| care 保育员 | 保育员、保育、保育老师 |
| it 信息接口人 | 信息接口人、信息员、信息管理员、管理员 |
| director 园长 | 园长、副园长、业务园长、保教主任、教学园长 |
| district 区县管理员 | 区县管理员、区县、教育局、区县教育局、教研员、学前科、教师发展中心（没有园所，只有区县） |

平台如果有别的岗位名（例如「后勤」「厨师」「家长」），请列出来；不在大课堂六个岗位内的岗位先按班级教师进入，或由平台侧不开放入口。

## 4. 回跳地址

| 端 | 回跳地址 | 说明 |
|---|---|---|
| 网页端（电脑、PAD 浏览器） | `https://{大课堂域名}/login/platform` | 方式 B 的 redirect_uri 不能带 `#`，用这个路径；方式 A 也可用 `https://{大课堂域名}/#/login/platform` |
| 小程序（平台小程序拉起大课堂小程序） | `wx.navigateToMiniProgram({ appId, path: 'pages/home/home', extraData: { ticket } })` | 大课堂小程序 `onLaunch/onShow` 读 `referrerInfo.extraData.ticket`，走方式 A 第 3 步 |
| 小程序（场景二维码） | 二维码参数 `ticket=…` | `options.query.ticket`，同上 |

小程序里只能走方式 A（一次性票据）；方式 B 的授权页跳转在小程序内不可用。若平台选方式 B，网页端走 B，小程序仍需平台提供「签发票据＋核验票据」两个接口。

## 5. 失败处理

| 情形 | 大课堂行为 |
|---|---|
| 票据/授权码无效、过期、已用 | 401 `code: rejected`，提示「请从平台重新进入」 |
| 平台无响应（8 秒超时）、答复不是 JSON、缺 uid | 502 `code: upstream`，提示「平台登录失败」，本机进度不丢 |
| 平台未配置 | 404，登录页不出现「平台账号登录」按钮 |
| 平台账号想自己改岗位 | 403 `code: platform` |

退出登录只清大课堂自己的会话，不通知平台（大课堂不持有平台会话）。平台侧注销不会同步到大课堂，大课堂会话 30 天到期；如需平台注销联动，请平台提供回调接口，大课堂另加。

## 6. 配置（大课堂运维填）

```
# 方式 A
PLATFORM_AUTH_MODE=ticket
PLATFORM_AUTH_URL=https://…/verify          # 第 2 节第 3 步的核验地址
PLATFORM_AUTH_KEY=…                          # 平台给的服务端密钥
PLATFORM_LOGIN_URL=https://…/login           # 平台登录页（带 redirect 参数）

# 方式 B
PLATFORM_AUTH_MODE=oauth2
PLATFORM_OAUTH_AUTHORIZE_URL=https://…/oauth/authorize
PLATFORM_OAUTH_TOKEN_URL=https://…/oauth/token
PLATFORM_OAUTH_USERINFO_URL=https://…/oauth/userinfo
PLATFORM_CLIENT_ID=…
PLATFORM_CLIENT_SECRET=…
PLATFORM_OAUTH_SCOPE=                        # 平台要求才填
PLATFORM_REDIRECT_URI=https://{大课堂域名}/login/platform   # 省略取 {ORIGIN}/login/platform
PLATFORM_TOKEN_PATH=access_token             # token 答复里 access_token 的点路径，默认即可

# 两种方式共用：字段位置与成功判定
PLATFORM_FIELDS={"uid":"data.userId","name":"data.realName","orgId":"data.orgCode","orgName":"data.orgName","role":"data.roleName"}
PLATFORM_OK=code=0
```

## 7. 待对齐（请平台接口人回答）

1. 基座「统一身份与权限」对第三方应用开放的是哪种能力：OAuth2/OIDC、CAS、自有票据，还是别的？有没有现成接口文档？
2. 用户唯一标识用哪个字段？换手机号后是否不变？
3. 园所编码用哪套（教育部门机构代码、平台内部 id）？一个人挂多个园所时如何给？
4. 岗位字段的取值全集是什么？多岗位如何表示？
5. 测试环境地址、测试账号（每个岗位至少一个）、密钥或 client 凭据的发放方式。
6. 大课堂域名加入回跳白名单的流程；小程序侧，平台小程序是否接受加一个「进入大课堂」入口并用 `navigateToMiniProgram` 带票据。
7. 平台侧注销是否需要联动大课堂；是否需要大课堂把学习记录回传平台（另一份接口，与登录无关）。

## 8. 大课堂侧实现位置

`api/auth/platform.js`（两种方式、字段点路径、岗位对照）、`api/auth/routes.js`（`POST /api/login/platform`）、
`frontend/src/academy/views/Login.jsx`（跳转与回跳）、小程序 `utils/auth.js` `loginPlatform/ticketFrom` 与 `app.js` `fromPlatform`。
测试：`api/test/auth.test.js` 用本地桩演示方式 A（含外包业务码）与方式 B。
