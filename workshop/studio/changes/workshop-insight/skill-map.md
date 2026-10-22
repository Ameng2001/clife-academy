# Skill Map: workshop-insight

> Date: 2026-03-28

## Skills

### theme-analysis
- **Description**: Analyze a monthly theme's educational value, background context, and curriculum standards alignment. Use when starting a new PBL project, when the curriculum director needs a project overview, or when someone says "analyze this theme". Produces a project overview with standards references.
- **Inputs**: 月度主题, 年龄段
- **Outputs**: `theme-analysis.md` — 主题背景(中英文)、教育价值阐述、《指南》五大领域覆盖分析、关联课标条目
- **Out of scope**: 不设计驱动问题（workshop-pbl 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: studio/ exists
- **Expert review**: 课程专家验证课标对齐

### prior-knowledge
- **Description**: Assess children's prior knowledge for a given theme and age group, covering cognitive, skill, and emotional dimensions. Use when planning learning goals, evaluating readiness, or when someone says "what do the children already know". Produces a structured prior knowledge assessment.
- **Inputs**: 月度主题, 年龄段(PreK-3/PreK-4/K)
- **Outputs**: `prior-knowledge.md` — 三维度先前经验（认知/技能/情感）× 年龄段差异
- **Out of scope**: 不制定学习目标（competency-mapping 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: studio/ exists
- **Expert review**: 心理学家验证发展阶段准确性

### competency-mapping
- **Description**: Map 4C competencies (Creativity, Critical Thinking, Communication, Collaboration) to the monthly theme and generate age-appropriate learning goals. Use when setting project standards, when someone says "map the 4C skills", or when learning goals are needed. Produces a 4C mapping table and learning goals.
- **Inputs**: 月度主题, 年龄段, `prior-knowledge.md`(optional), `theme-analysis.md`(optional)
- **Outputs**: `competency-mapping.md` — 4C能力×具体表现映射 + 学习目标列表（动词与年龄匹配）
- **Out of scope**: 不检查映射准确性（workshop-quality 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob, Agent
- **Preconditions**: studio/ exists
- **Expert review**: 心理学家验证 4C 能力定义的年龄适切性

## Data Flow

```
[theme-analysis]
    │ produces: theme-analysis.md
    │ (independent, can run standalone)
    ▼
[prior-knowledge]
    │ produces: prior-knowledge.md
    │ (independent, can run standalone)
    ▼
[competency-mapping]
    │ produces: competency-mapping.md
    │ (optional inputs from above two)
```

theme-analysis 和 prior-knowledge **可并行**。competency-mapping 可独立运行，但有前两者的输出质量更高。

## Complexity Summary

| Skill | Tier | Scripts needed | Agent needed | MCP needed |
|-------|------|---------------|-------------|------------|
| theme-analysis | Simple | — | Yes (课程专家) | — |
| prior-knowledge | Simple | — | Yes (心理学家) | — |
| competency-mapping | Simple | — | Yes (心理学家) | — |

## Implementation Order

1. **theme-analysis** + **prior-knowledge** — 可并行开发
2. **competency-mapping** — 最后，可选依赖前两者
