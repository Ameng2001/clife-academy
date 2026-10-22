# Domain Map: Course Workshop (幼儿园 PBL 课程研发)

> Date: 2026-03-28

## Artifacts
- Domain Canvas: see `domain-canvas.md`
- Behavior Matrix: see `behavior-matrix.md`
- Opportunity Brief: see `opportunity-brief.md`

## Plugin Candidates

| Plugin | Domain | Role | Description | Dependencies | Priority |
|--------|--------|------|-------------|-------------|----------|
| workshop-core | 工作台管理 | core | 课研工作区初始化、状态管理、预案归档 | — | 1 |
| workshop-pbl | 问题设计 + 活动设计 | core | 驱动性问题生成、网络图构建、探究线索拆分、活动序列编排、预案文档生成 | workshop-core | 2 |
| workshop-insight | 主题分析 + 标准制定 | add-on | 主题教育价值分析、先前经验评估、4C能力映射、学习目标生成 | — | 3 |
| workshop-quality | 质量保障 | add-on | 课标覆盖度检查、年龄适配检查、4C映射验证、预案完整性审核 | — | 4 |
| workshop-resource | 资源管理 | add-on | 资源自动匹配(PBL Box/足迹袋/自备)、资源完整性校验 | workshop-core | 5 |

## Generic Capabilities (no custom plugin needed)
- **双语翻译** → Claude 内置翻译能力
- **文档排版** → Markdown → PDF 通用工具
- **文本润色** → Claude 内置写作能力

## Collection Structure
- **Pattern**: Core + Add-ons
- **Rationale**: workshop-core 管理共享工作区状态，workshop-pbl 是核心创作流水线，其余 3 个插件可选安装。课研主任至少需要 core + pbl，insight/quality/resource 按需添加。

## Plugin Architecture

```
course-workshop-plugins/               ← marketplace collection
├── .claude-plugin/
│   ├── marketplace.json               ← 注册 5 个插件
│   └── plugin.json                    ← marketplace 元数据
├── workshop-core/                     ← 工作台管理 (zero deps)
│   ├── skills: init, status, promote
│   ├── templates: proposal.md.tmpl, status.json.tmpl
│   └── hooks: post-promote archiving
├── workshop-pbl/                 ← 课程设计流水线 (depends: core)
│   ├── skills: driving-question, network-map, inquiry-scaffold,
│   │          activity-design, proposal-generate
│   ├── commands: design (chains all skills)
│   ├── agents: (reuse studio/agents/)
│   └── references: pbl-methodology-guide.md, activity-coding-spec.md
├── workshop-insight/                  ← 前期分析 (zero deps)
│   ├── skills: theme-analysis, prior-knowledge, competency-mapping
│   └── references: guidelines-3-6.md, 4c-framework.md
├── workshop-quality/                  ← 质量保障 (zero deps)
│   ├── skills: standards-check, proposal-review
│   ├── scripts: check_standards.py, check_age_fit.py
│   └── references: guidelines-3-6.md, age-ability-matrix.md
└── workshop-resource/                 ← 资源管理 (depends: core)
    ├── skills: resource-planner, resource-check
    └── references: pbl-box-catalog.md, resource-categories.md
```

## Dependency Graph

```
workshop-core (zero deps)
    ↑
    ├── workshop-pbl (depends: core)
    └── workshop-resource (depends: core)

workshop-insight  (zero deps)
workshop-quality  (zero deps)
```

## Design Pipeline (workshop-pbl)

类似 astra-studio 的 `/studio-planner:plan`，workshop-pbl 的 `/workshop-pbl:design` 命令串联：

```
driving-question → network-map → inquiry-scaffold → activity-design × 3 → proposal-generate
      ↑                                                      ↑
  (workshop-insight                                  (workshop-resource
   提供主题分析和标准)                                  提供资源匹配)
```
