# Skill Map: workshop-resource

> Date: 2026-03-28

## Skills

### resource-planner
- **Description**: Match and categorize resources for each activity in a PBL proposal — PBL Box (统一配送), My Journal/探索足迹袋, Teacher's Supplies (自备材料), and Media Supplies (多媒体). Use after activities are designed, when planning material procurement, or when someone says "plan the resources". Produces categorized resource lists.
- **Inputs**: `activities/clue-{1,2,3}.md` (活动内容中的资源标注)
- **Outputs**: `resource-plan.md` — 按活动分组的资源清单 + 分类标注 + 数量估算 + PBL Box 订单汇总
- **Out of scope**: 不做采购下单（外部系统），不做活动设计
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob
- **Preconditions**: activities exist
- **References**: `pbl-box-catalog.md` (PBL Box 可供应物料目录), `resource-categories.md` (分类规则)

### resource-check
- **Description**: Validate resource lists for completeness, category accuracy, and procurement feasibility. Use before finalizing a proposal, when checking if all materials are available, or when someone says "check the resources". Produces a resource validation report.
- **Inputs**: `resource-plan.md`, `activities/clue-{1,2,3}.md`
- **Outputs**: `resource-check-report.md` — 遗漏项列表 + 分类建议修正 + PBL Box 可用性检查
- **Checks performed**:
  - 每个活动至少 1 项资源
  - 资源分类正确（PBL Box 中的物料不应标为自备）
  - 数量是否标注（不允许无数量的"水果"）
  - PBL Box 物料是否在目录中
- **Out of scope**: 不修改资源清单（只报告问题）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Grep
- **Preconditions**: resource-plan.md exists

## Data Flow

```
[resource-planner]
    │ produces: resource-plan.md
    ▼
[resource-check]
    │ produces: resource-check-report.md
```

Pipeline pattern — check runs after planner.

## Complexity Summary

| Skill | Tier | Scripts needed | Agent needed | MCP needed |
|-------|------|---------------|-------------|------------|
| resource-planner | Simple | — | — | — |
| resource-check | Simple | — | — | — |

## Implementation Order

1. **resource-planner** — 先建
2. **resource-check** — 依赖 resource-planner 输出
