# 教研工坊 × 幼师学坊：增量（分享、钱包）

这是教研工坊与幼师学坊之间的增量，只放这几份，工坊引擎本身不进本仓库。线上版 jiaoyan.clife.cn 照这里做，不必照搬代码；学坊这头的接口总表见 `docs/WORKSHOP-SHARE.md`、`docs/WORKSHOP-TODO.md`。两件事：**分享到学坊**（工坊侧已有参考实现）和**钱包页**（工坊侧还没做，学坊接口已齐）。

| 文件 | 是什么 |
|---|---|
| `教研工坊-分享到幼师学坊.md` | 工坊侧的功能设计：用过再分享的门槛、四栏预填、「改了什么」只能教师写、两开关、署名一句、草稿 |
| `share_academy.py` | 可运行的参考实现：读工坊导出物，调学坊 `POST /api/works/draft` 或 `POST /api/works`，提交后回写 `status.json` |
| `SKILL.md`、`share.md` | 插件里的 `/workshop-core:share` skill 与命令，教师在 Claude Code 里用 |
| `config.template.yaml` | 工坊运行时配置模板，`academy` 段放学坊地址与投稿令牌；令牌只在本机，不进仓库 |
| `ui-v3-share-button.patch` | V3 原型交付页「分享到幼师学坊」按钮与四栏弹层的改动（app.js、styles.css、export-bundle.html） |
| `教研工坊-钱包接口增量.md` | 钱包页要用的六条学坊接口：握手、余额、报价、扣减、钱包整包、来源核对，带应答样例、14 个功能点对应字段、一次起草的调用顺序、验收脚本 |
| `wallet-openapi.yaml` | 上面六条接口的 OpenAPI 定义，从学坊 `api/openapi.yaml` 抽出 |
