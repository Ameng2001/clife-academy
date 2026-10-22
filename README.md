# clife-academy · C-Life 学前大课堂

幼儿园教职工的岗位能力训练平台，配套柳州数智幼教平台交付：按岗位（保健医、班级教师、保育员、信息接口人、园长）
走关卡路径，每关「讲、看、做、测」，「做」由平台实操事件回传判定；园所应用体检 12 项探针；
教师 Coach 按学习记录给出路径调整建议（AI 提议、人确认）。

以 [openGym](https://github.com/DuarteSantos8/openGym) 为基底改造（见 [NOTICE.md](NOTICE.md)）。
为什么是它、哪些模块保留、哪些重写、排期：[docs/MIGRATION.md](docs/MIGRATION.md)。

## 结构

```
api/        Node 原生 http 服务，无框架。session、GET/PUT /api/data 全量同步、字段级合并、Coach 流水线、提醒
frontend/   React 19 + Vite + Zustand 单页应用（PC 网页；小程序另见平台仓库）。src/academy 视图与壳，store 同步引擎，lib 纯函数
miniprogram/ 微信小程序（原生，16 页；根目录 project.config.json 给微信开发者工具；版式用 scripts/mp-render.mjs 渲成 html 看）
workshop/   教研工坊引擎（Claude Code 插件形态：workshop-core / 5step / pbl / activity 管线、studio、apps 原型；线上版 jiaoyan.clife.cn 照它做）
prototype/  早期可点通 H5 原型与课程数据源（src/academy.body.html → gen_mp_data.py 生成 miniprogram/utils/data.js）
mcp/        只读 MCP 桥：园长、教育局用自己的 LLM 客户端查进度，拿「设置」里建的只读令牌调 GET 接口（见 mcp/README.md）
web/        nginx：托前端、反代 /api
docs/       HANDOVER.md 移交文档（接手先读）；MIGRATION.md 迁移方案；WORKSHOP-TODO.md 工坊线上版待办；WALLET-TODO.md 钱包功能点待办（钱包页在工坊，学坊只给接口）；proposal/ 方案正文、三份对客契约、继续教育学时说明、移交文档的 Word/PDF 与导出脚本；upstream/ 上游原文档
scripts/    mp-render.mjs 小程序页渲 html；import-lessons.py 从大课堂原型导入课程数据；workshop-spend-check.mjs 教研工坊接积分、钱包页与改编来源的联调脚本、workshop-share-check.mjs 工坊分享到学坊的联调脚本（都给工坊服务端的同学；根目录 `npm run check:share` / `check:spend` / `check:workshop` / `price`，用法见 docs/WORKSHOP-TODO.md 第五节；CI 见 .github/workflows/api.yml）
```

## 开发

```bash
cd api && npm ci --omit=optional && npm test && DATA_DIR=../data node server.js
cd frontend && npm ci && npm test && npm run dev
```

课程数据：`frontend/src/lib/lessons-data.js` 由 `python3 scripts/import-lessons.py prototype/src/academy.body.html` 生成，小程序的 `miniprogram/utils/data.js` 由 `cd prototype && python3 gen_mp_data.py` 生成，都不手改；课程数据源只有 `prototype/src/academy.body.html` 一份。

## 状态

改造进行中，第 1 周。能跑：`sh scripts/dev.sh` 前台起 api（:3000）＋前端（:5173），或 `sh scripts/local.sh start|stop|restart|status|log` 后台启停，开发桩登录（姓名＋岗位）或访客进入后，保健医路径第 1 关可讲看做测到通关；进度随账号同步，访客通过的关卡登录时可并入账号。上游健身视图、lib、动作库已全部移除。登录三条入口见 `docs/AUTH.md`。
进度与待办见 `docs/MIGRATION.md` 第八节。
