# Skill Map: workshop-5step

> Date: 2026-03-29

## Skills

### lesson-objective
- **Description**: Generate observable learning objectives aligned with 《指南》for a single lesson
- **Inputs**: 课题, 年龄段, 主要领域, 活动类型
- **Outputs**: `studio/changes/{workspace}/lesson-objective.md`
- **Out of scope**: 不做 PBL 目标（使用 workshop-insight:competency-mapping）
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: studio/ exists

### lesson-scaffold
- **Description**: Design the five-step teaching structure with time allocation and activity types
- **Inputs**: lesson-objective.md (optional)
- **Outputs**: `studio/changes/{workspace}/lesson-scaffold.md`
- **Out of scope**: 不写具体话术（lesson-detail 的职责）
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: lesson-objective.md recommended

### lesson-detail
- **Description**: Write detailed teacher scripts, materials, and differentiation for each step
- **Inputs**: lesson-scaffold.md (required)
- **Outputs**: `studio/changes/{workspace}/lesson-detail.md`
- **Out of scope**: 不做最终排版（lesson-generate 的职责）
- **Complexity**: High
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: lesson-scaffold.md exists

### lesson-generate
- **Description**: Compile all artifacts into a standard lesson plan document
- **Inputs**: lesson-objective.md, lesson-scaffold.md, lesson-detail.md
- **Outputs**: `studio/changes/{workspace}/lesson-plan.md`
- **Out of scope**: 不创建新内容（纯编译），不导出 Word/PDF
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob
- **Preconditions**: all 3 input files exist

## Data Flow

```
lesson-objective → lesson-scaffold → lesson-detail → lesson-generate
      ↑                   ↑                                ↑
  (workshop-kb         (workshop-pipelines             (workshop-quality
   optional)            five-step pipeline)             optional check)
```

## Complexity Summary

| Skill | Tier | Agent needed |
|-------|------|-------------|
| lesson-objective | Medium | child-development-psychologist, early-childhood-curriculum-expert |
| lesson-scaffold | Medium | instructional-designer, early-childhood-curriculum-expert |
| lesson-detail | High | instructional-designer, child-development-psychologist |
| lesson-generate | Simple | — |

## Implementation Order

1. **lesson-objective** — pipeline entry point
2. **lesson-scaffold** — depends on objectives
3. **lesson-detail** — depends on scaffold
4. **lesson-generate** — final assembly
