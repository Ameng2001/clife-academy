# Skill Map: workshop-pbl

> Date: 2026-03-28

## Capabilities (User Stories)

- As 课研主任, I want to generate a driving question from a monthly theme so that the project has a clear investigable direction
- As 课研主任, I want to build a thematic network diagram so that I can see all sub-questions and exploration angles
- As 课研主任, I want to split the driving question into 3 progressive inquiry clues so that children's exploration has scaffolded progression
- As 课研主任, I want to design activity sequences for each inquiry clue so that each clue has 3-5 concrete, executable activities
- As 课研主任, I want to compile everything into a complete PBL proposal document so that teachers can receive a ready-to-use plan

## Skills

### driving-question
- **Description**: Generate and validate a driving question for a PBL project based on the monthly theme, target age group, and learning goals. Use when starting a new PBL course design, when the curriculum director needs a driving question, or when someone says "help me design a project question". Produces a validated driving question with openness scoring.
- **Inputs**: 月度主题, 年龄段(PreK-3/PreK-4/K), 学习目标(optional, from workshop-insight)
- **Outputs**: `driving-question.md` — 驱动性问题 + 开放性评分 + 可探究性评估 + 备选问题
- **Out of scope**: 不拆分线索（inquiry-scaffold 的职责），不设计活动
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: studio/ exists, 月度主题已确定

### network-map
- **Description**: Build a thematic network diagram (mind map) from a driving question, showing sub-questions, exploration angles, and connections across learning domains. Use after a driving question is set, when planning the scope of a PBL project, or when someone says "help me build a topic web". Produces a structured network diagram.
- **Inputs**: `driving-question.md`, 月度主题
- **Outputs**: `network-map.md` — 主题网络图（中心问题 → 子问题分支 → 叶节点活动方向），覆盖《指南》五大领域标注
- **Out of scope**: 不判断哪些子问题要做成探究线索（inquiry-scaffold 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob
- **Preconditions**: driving-question.md exists

### inquiry-scaffold
- **Description**: Split a driving question into 3 progressive inquiry clues, each with key question, success skills (4C), learning goals, keywords, and estimated duration. Use after network-map is built, when planning the exploration structure, or when someone says "help me break down the project". Produces 3 stepped inquiry clues.
- **Inputs**: `driving-question.md`, `network-map.md`, 学习目标, 年龄段
- **Outputs**: `inquiry-clues.md` — 3 条探究线索，每条含：关键问题、成功素养、学习目标、关键词、建议时长(3-5天)
- **Out of scope**: 不设计具体活动（activity-design 的职责），不匹配资源
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: driving-question.md + network-map.md exist
- **Expert review**: 课程专家验证递进性，心理学家验证 4C 映射准确性

### activity-design
- **Description**: Design a complete activity sequence for one inquiry clue — activities with key questions, coded names (PBL-Cx-y), step-by-step content, teacher tips, and resource annotations. Use after inquiry clues are defined, when the curriculum director needs to flesh out activities, or when someone says "help me design the activities". Produces a structured activity table.
- **Inputs**: `inquiry-clues.md` (specific clue), 年龄段, `network-map.md`(optional)
- **Outputs**: `activities/clue-{N}.md` — 活动表：关键问题 × 活动名称(PBL-C{N}-{序号}) × 活动内容(分步骤) × 教师提示 × 资源标注
- **Out of scope**: 不做资源分类和完整性校验（resource-planner 的职责），不做课标检查
- **Complexity**: Moderate
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: inquiry-clues.md exists
- **Expert review**: 教学设计师验证时长和可执行性，心理学家验证年龄适配
- **Notes**: 此 skill 运行 3 次（每条线索 1 次），或可一次性为所有 3 条线索生成。每个活动约 20-30 分钟课时。

### proposal-generate
- **Description**: Compile all design artifacts into a complete PBL proposal document following the Huamei 5-section format (项目概览→项目标准→项目启动→项目探究→项目展示). Use when all design work is done and the curriculum director needs the final output, or when someone says "generate the proposal". Produces a ready-to-use PBL pre-proposal.
- **Inputs**: `driving-question.md`, `network-map.md`, `inquiry-clues.md`, `activities/clue-{1,2,3}.md`, 项目概览(from workshop-insight, optional), 标准(from workshop-insight, optional)
- **Outputs**: `proposal.md` — 完整预案文档（华美 5 段式格式），含中英双语
- **Out of scope**: 不做 PDF 排版（通用工具），不做质量检查（workshop-quality 的职责）
- **Complexity**: Moderate
- **allowed-tools**: Read, Write, Glob
- **Preconditions**: 至少 driving-question + inquiry-clues + activities 存在

## Data Flow

```
[driving-question]
    │ produces: driving-question.md
    ▼
[network-map]
    │ produces: network-map.md
    ▼
[inquiry-scaffold]
    │ produces: inquiry-clues.md
    ▼
[activity-design] ×3 (one per clue)
    │ produces: activities/clue-1.md, clue-2.md, clue-3.md
    ▼
[proposal-generate]
    │ produces: proposal.md
    │
    ├── optional input ←── workshop-insight (theme-analysis, competency-mapping)
    └── optional input ←── workshop-resource (resource-planner)
```

All connections are **required** in the pipeline (each skill needs the previous skill's output), except:
- workshop-insight outputs are **optional** — proposal-generate can work without them (just with less context)
- workshop-resource outputs are **optional** — activities will have resource annotations but without formal validation

## Complexity Summary

| Skill | Tier | Scripts needed | Agent needed | MCP needed |
|-------|------|---------------|-------------|------------|
| driving-question | Simple | — | Yes (课程专家验证开放性) | — |
| network-map | Simple | — | — | — |
| inquiry-scaffold | Simple | — | Yes (课程专家+心理学家) | — |
| activity-design | Moderate | — | Yes (教学设计师+心理学家) | — |
| proposal-generate | Moderate | — | — | — |

## Implementation Order

1. **driving-question** — 入口 skill，无依赖，可立即开始
2. **network-map** — 依赖 driving-question 的输出格式
3. **inquiry-scaffold** — 依赖 network-map
4. **activity-design** — 依赖 inquiry-scaffold，最复杂的 skill
5. **proposal-generate** — 依赖所有前序 skill，组装型 skill

## Command

`/workshop-pbl:design` — 串联 5 个 skills 的完整设计流水线，每步暂停确认。
