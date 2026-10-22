# Skill Map: workshop-quality

> Date: 2026-03-28

## Skills

### standards-check
- **Description**: Check a PBL proposal against curriculum standards (《3-6岁儿童学习与发展指南》), age-appropriateness rules, 4C mapping accuracy, and activity design constraints. Use after proposal is drafted, when reviewing quality, or when someone says "check the proposal". Produces a quality report with pass/fail items.
- **Inputs**: `proposal.md` or individual artifacts (activities, inquiry-clues, competency-mapping)
- **Outputs**: `quality-report.md` — 检查项列表（通过/警告/失败）+ 修改建议
- **Checks performed**:
  - 课标覆盖度（五大领域至少覆盖 3 个）
  - 学习目标动词适切性（年龄段×动词矩阵）
  - 4C 映射准确性（每个活动声称的 4C 是否与内容匹配）
  - 活动时长合理性（20-30 分钟）
  - 探究线索递进性
  - 活动编码连续性（PBL-C{x}-{y} 无跳号）
  - 资源清单完整性（每个活动至少 1 项资源）
- **Out of scope**: 不修改预案（只报告问题）
- **Complexity**: Moderate
- **allowed-tools**: Read, Write, Glob, Grep, Agent
- **Preconditions**: 至少有 activities 或 proposal 存在

### proposal-review
- **Description**: Perform a comprehensive peer review of a PBL proposal from multiple expert perspectives — curriculum alignment, developmental appropriateness, and classroom feasibility. Use before submitting to the principal for approval, when a second opinion is needed, or when someone says "review the proposal". Produces expert review comments.
- **Inputs**: `proposal.md` or full artifact set
- **Outputs**: `review-comments.md` — 多角色评审意见（课程专家+心理学家+教学设计师）+ 综合评分
- **Out of scope**: 不做自动修复（只提供建议）
- **Complexity**: Moderate
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: proposal or artifacts exist
- **Expert review**: 3 个专家 agent 并行评审

## Data Flow

```
[standards-check]                     [proposal-review]
    │ produces: quality-report.md         │ produces: review-comments.md
    │                                     │
    └──── both independent, can run in parallel ────┘
```

## Complexity Summary

| Skill | Tier | Scripts needed | Agent needed | MCP needed |
|-------|------|---------------|-------------|------------|
| standards-check | Moderate | — (规则内置于 SKILL.md + references) | Yes (年龄适配检查) | — |
| proposal-review | Moderate | — | Yes (3 专家并行) | — |

## Implementation Order

1. **standards-check** — 规则明确，可先建
2. **proposal-review** — 依赖专家 agents 已就位
