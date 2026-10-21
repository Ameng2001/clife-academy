# CLAUDE.md

clife-academy：幼儿园教职工岗位能力训练平台（C-Life 学前大课堂），以 openGym 为基底改造。
上游的架构说明在 `docs/upstream/CLAUDE-openGym.md`，对 `api/`（server.js、sync-stamps、coach）仍然准确；
`frontend/src` 已换成大课堂自己的：`academy/` 视图与壳、`store/useStore.js` 精简同步引擎（与上游 GET/PUT /api/data 协议一致）、
`lib/academy-merge.js` 合并规则、`lib/level-draft.js` 草稿。业务映射与改造清单在 `docs/MIGRATION.md`，动手前先读第二、三节。

## 硬约束（沿用上游）

- 前端只有 React + Router + Zustand；api 依赖个位数。新增依赖要有理由。
- 任何「决定下一关是什么」或「读回一次学习记录」的逻辑都是 `frontend/src/lib/` 的纯函数，旁边带同目录 `*.test.js`。
- 前后端各一份的规则用表驱动 parity 测试钉住。
- 课程数据 `frontend/src/lib/lessons-data.js` 是生成物，改原型后重跑 `scripts/import-lessons.py`。

## 业务红线

- 不得用 AI 生成观察记录或评价幼儿；Coach 的 payload 不含任何幼儿字段，按名复制，不 spread。
- cohort 只给 ≥3 园的中位数，不排名、不点名。
- debrief 评「这一关的学习」，不评价人。
- 产品话术不写「留痕」「迎检」。

## 命名

关卡 id：`<pathKey>-<index>`，如 `nurse-5`。路径键：nurse / teacher / care / it / director。

## 命令

```bash
cd api && npm test            # node --test
cd frontend && npm test       # vitest
python3 scripts/import-lessons.py <academy.body.html>
```
