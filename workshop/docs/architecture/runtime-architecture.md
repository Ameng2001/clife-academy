# Runtime Architecture

这篇文档定义当前运行时真正生效的架构规则。

它统一替代旧的分散文档：

- project workspace principles
- workspace status schema
- HIL checkpoint model
- release bundle model
- export layer model

## 1. 运行时边界

Course Workshop 当前有两个不同系统：

- `studio/`
  - Astra Studio 的插件研发目录
- `.workshop/`
  - 课程项目运行时目录

运行时只认 `.workshop/`，不再把 `studio/` 当作课程项目目录。

## 2. 根目录结构

```text
.workshop/
├── config.yaml
├── projects/
├── plans/
├── kb/
├── agents/custom/
├── archive/
└── exports/

courses/
```

目录职责：

- `.workshop/projects/`
  - 活跃的课程项目工作区
- `.workshop/plans/`
  - 学期 / 月 / 周共享规划记录
- `.workshop/kb/`
  - 运行时知识库内容
- `.workshop/archive/`
  - 完整历史归档
- `.workshop/exports/`
  - Word/PDF/远端导出包准备区
- `courses/`
  - 最终 release bundle

## 3. 主对象

### 3.1 project workspace

一个 project workspace 对应一个具体课程主题。

它可以包含多个交付物，例如：

- `proposal.md`
- `lesson-plan.md`
- `theme-analysis.md`
- `theme-narrative.md`
- `theme-network.md`
- `resource-plan.md`
- `quality-report.md`

### 3.2 planning workspace

planning workspace 是全局规划资产，不等于课程项目。

它通常表示：

- 学期计划
- 月计划
- 周计划

project 与 planning 的关系是“引用”，不是复制。

### 3.3 pipeline

pipeline 决定当前产物走哪条方法论管线，例如：

- `pbl-huamei`
- `five-step`
- `thematic-curriculum`

pipeline 是产物级选择，不锁定整个 project 的唯一方法论。

## 4. status.json

运行时只使用两种 workspace 类型：

- `project`
- `planning`

### 4.1 project 最小结构

```json
{
  "type": "project",
  "project": "spring-flowers",
  "theme": "春天的花 / Spring Flowers",
  "target_collection": "courses",
  "target": {
    "kind": "local",
    "path": "courses/spring-flowers"
  },
  "phase": "planning",
  "created_at": "2026-03-29T10:00:00+08:00",
  "hil": {
    "checkpoint": "project-framing",
    "status": "not_started",
    "requested_at": null,
    "approved_at": null,
    "approved_by": null,
    "notes": ""
  },
  "plan_refs": {
    "semester": null,
    "month": null,
    "week": null
  },
  "skills": {}
}
```

### 4.2 planning 最小结构

```json
{
  "type": "planning",
  "plan_level": "semester",
  "plan_name": "2026-spring",
  "phase": "planning",
  "created_at": "2026-03-29T10:00:00+08:00",
  "linked_projects": []
}
```

### 4.3 phase 生命周期

统一使用：

- `planning`
- `designing`
- `reviewing`
- `approved`
- `shipped`

推荐推进：

- 创建 project / 选择 pipeline
  - `planning`
- 核心骨架形成
  - `designing`
- 最终交付物初稿形成
  - `reviewing`
- 最终审批通过
  - `approved`
- promote 完成
  - `shipped`

## 5. HIL 模型

运行时把大阶段衔接点建模成显式 HIL。

统一 checkpoint：

- `project-framing`
- `design-scaffold`
- `deliverable-draft`
- `approval-gate`

统一状态：

- `not_started`
- `awaiting_review`
- `changes_requested`
- `approved`

### 5.1 HIL 和 phase 的关系

| Phase | 常见 HIL checkpoint |
|------|------|
| `planning` | `project-framing` |
| `designing` | `design-scaffold` |
| `reviewing` | `deliverable-draft` 或 `approval-gate` |
| `approved` | `approval-gate = approved` |

### 5.2 原则

- 没有通过关键 HIL，不应默认自动推进到下一个大阶段
- `approve` 是最终 `approval-gate` 的显式动作
- `promote` 之前必须同时满足：
  - `phase = approved`
  - `hil.checkpoint = approval-gate`
  - `hil.status = approved`

## 6. release bundle

`courses/` 是最终交付目录，不是完整工作区镜像。

### 6.1 可以进入 `courses/` 的

主交付物：

- `proposal.md`
- `lesson-plan.md`

可选辅助交付物：

- `resource-plan.md`
- `quality-report.md`
- `review-comments.md`
- `resource-check-report.md`

条件附件：

- `activities/`
  - 仅在 PBL proposal 场景下作为 release bundle 一部分进入

### 6.2 不应进入 `courses/` 的

这些设计过程文件保留在 archive：

- `theme-analysis.md`
- `theme-narrative.md`
- `theme-network.md`
- `prior-knowledge.md`
- `competency-mapping.md`
- `driving-question.md`
- `network-map.md`
- `inquiry-clues.md`
- `lesson-objective.md`
- `lesson-scaffold.md`
- `lesson-detail.md`

## 7. export layer

导出层和 release bundle 是两回事。

### 7.1 三层模型

- Runtime source
  - `.workshop/projects/`, `.workshop/archive/`
  - Markdown 语义源
- Release bundle
  - `courses/`
  - 最终课程交付物
- Export bundle
  - `.workshop/exports/`
  - Word/PDF/远端渲染输入

### 7.2 原则

- 设计技能产出的是结构化 Markdown 语义源
- `workshop-format` 负责把它整理成导出协议
- 真实 `.docx` / `.pdf` 可交给外部 harness 或后续渲染器

export bundle manifest 至少应声明：

- `workspace`
- `export_target`
- `source`
- `deliverables`
- `profile.layout_profile`
- `profile.renderer`
- `profile.naming`

## 8. 当前生效结论

可以用一句话概括当前运行时：

**用户在 `.workshop/projects/` 中围绕一个主题协作，规划资产在 `.workshop/plans/` 中独立维护，关键阶段经过 HIL，最终经 `approve -> promote` 形成 `courses/` release bundle，并将完整历史归入 `.workshop/archive/`。**
