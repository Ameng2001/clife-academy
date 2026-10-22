# Course Workshop Plugins

Multi-methodology course design toolkit for kindergarten curriculum directors (课研主任) and classroom teachers (一线教师). Supports PBL proposals, Five-Step lesson plans, semester/month/week planning, and school knowledge base management.

## Working Principles

- The primary user-facing object is a `project workspace`, centered on one course theme.
- A single project may contain multiple deliverables, including a PBL proposal, one or more lesson plans, resource plans, and review artifacts.
- Templates are output-scoped defaults, not project-wide locks.
- Semester/month/week planning is a global asset layer; projects should reference relevant plan slices instead of copying full plans.
- `workshop-*` directories are the source of truth for implementation.
- `.workshop/` is the course runtime root for projects, plans, knowledge assets, and archives.
- `studio/` remains the Astra Studio plugin-development workspace.
- `experts/` is the single source of truth for reusable domain experts.
- Runtime agent scope is layered:
  - `.workshop/agents/custom/`
  - `experts/`
  - `workshop-*/agents/`

## Repository Structure

```
├── workshop-core/         # Workspace management (init, config, onboarding, status, link-plan, approve, promote, share) — 8 skills
├── workshop-pbl/          # PBL course design pipeline (driving-question → proposal) — 5 skills
├── workshop-insight/      # Pre-analysis toolkit (theme, narrative, network, prior-knowledge, 4C) — 5 skills
├── workshop-quality/      # Quality assurance (standards-check, proposal-review) — 2 skills
├── workshop-resource/     # Resource management (resource-planner, resource-check) — 2 skills
├── workshop-5step/        # Five-Step themed session pipeline (objective → scaffold → detail → generate) — 4 skills
├── workshop-activity/     # Thematic activity drafting (region, outdoor, life-routine, home-school) — 4 skills
├── workshop-planner/      # Hierarchical curriculum planning (semester → month → week) — 3 skills
├── workshop-kb/           # School knowledge base (import, index, query) — 3 skills
├── workshop-pipelines/    # Teaching methodology pipeline registry (list, select) — 2 skills
├── workshop-format/       # Export formatting layer (format-lesson, export-bundle) — 2 skills
├── experts/               # Shared domain experts
├── studio/                # Astra Studio plugin-development workspace
└── .workshop/             # Course runtime workspaces (projects, plans, kb, archive)
```

## Plugin Dependencies

```
workshop-core       (zero deps)
workshop-insight    (zero deps)
workshop-quality    (zero deps)
workshop-pipelines  (zero deps)
workshop-format     (depends on workshop-core, workshop-pipelines)
workshop-kb         (depends on workshop-core)
workshop-pbl        (depends on workshop-core, workshop-pipelines)
workshop-5step      (depends on workshop-core, workshop-pipelines)
workshop-activity   (depends on workshop-core, workshop-pipelines)
workshop-planner    (depends on workshop-core, workshop-pipelines)
workshop-resource   (depends on workshop-core)
```

## User Entry Model

Users should enter through a project, not through a plugin list:

1. Create or enter a course-theme project workspace
2. Optionally choose a pipeline for the next deliverable
3. Produce one or more outputs inside that project:
   - PBL proposal
   - Five-Step lesson plan
   - Thematic activity drafts
   - Resource plan
   - Quality review
4. Link the project to global semester/month/week planning context when relevant
5. Prepare client-facing layout or export bundle when needed

## Design Pipelines

### PBL Pipeline: `/workshop-pbl:design`

```
driving-question → network-map → inquiry-scaffold → activity-design ×3 → proposal-generate
      ↑                                                    ↑                      ↑
  (workshop-insight                                   (workshop-resource     (workshop-insight
   optional input)                                     optional input)       optional input)
```

### Five-Step Lesson Pipeline: `/workshop-5step:lesson`

```
lesson-objective → lesson-scaffold → lesson-detail → lesson-generate
      ↑                  ↑                                  ↑
  (workshop-kb      (workshop-pipelines              (workshop-quality
   optional)         five-step pipeline)              optional check)
```

### Curriculum Planning Pipeline: `/workshop-planner:plan`

```
semester-plan → month-plan → week-plan
     ↑              ↑            ↓
 (workshop-kb   (workshop-kb   (feeds into workshop-5step
  calendars)     textbooks)     or workshop-pbl)
```

### Thematic Activity Drafting: `/workshop-activity:*`

```
week-plan / month-plan → region-activity / outdoor-game / life-routine / home-school
            ↑
       (workshop-kb client examples)
```

### Thematic Curriculum Framing: `/workshop-insight:*`

```
theme-analysis → theme-narrative → theme-network
      ↓                ↓                ↓
        (feeds into workshop-planner month/week outputs)
```

## Domain Experts

Runtime expert sources are layered:
- `.workshop/agents/custom/` — highest priority, school/project-specific experts
- `experts/` — reusable domain experts shared across studio and runtime
- `workshop-*/agents/` — plugin-local experts for specialized behavior

Shared runtime experts typically include:
- **early-childhood-curriculum-expert** — PBL methodology, curriculum standards, age-appropriateness
- **child-development-psychologist** — developmental stages, 4C mapping, prior knowledge
- **instructional-designer** — activity feasibility, resource planning, teacher instructions

## Planning vs Project Workspaces

- Project workspaces are the default unit of collaboration and delivery.
- Planning records are shared assets under `.workshop/plans/`.
- Do not treat planner outputs as the canonical home for course deliverables.
- Do not duplicate runtime content into `studio/`; edit plugin files under `workshop-*` and store course runtime state under `.workshop/`.

## Development Workflow

1. Edit SKILL.md files directly — changes take effect immediately
2. Test with: `claude --plugin-dir ./workshop-core --plugin-dir ./workshop-pbl --plugin-dir ./workshop-insight --plugin-dir ./workshop-quality --plugin-dir ./workshop-resource --plugin-dir ./workshop-5step --plugin-dir ./workshop-activity --plugin-dir ./workshop-planner --plugin-dir ./workshop-kb --plugin-dir ./workshop-pipelines`
3. Key test flows:
   - PBL: `/workshop-pbl:design 我周围的人`
   - Five-Step: `/workshop-5step:lesson 认识春天的花`
   - Thematic Activities: `/workshop-activity:region-activity 多样的服饰`
   - Planning: `/workshop-planner:plan 2026春季学期`
   - Theme Package Framing: `/workshop-insight:theme-narrative 多样的服饰`
   - Formatting: `/workshop-format:format-lesson spring-flowers`

## Key References

| File | Plugin | Purpose |
|------|--------|---------|
| pbl-methodology-guide.md | designer | PBL 方法论 + 三阶段九要素 |
| activity-coding-spec.md | designer | PBL-Cx-y 编码规范 |
| guidelines-3-6.md | insight, quality, lesson | 《指南》五大领域摘要 |
| 4c-framework.md | insight | 4C 能力矩阵 + 误分类表 |
| age-ability-matrix.md | quality | 年龄×能力查询表 |
| pbl-box-catalog.md | resource | PBL Box 物料目录 |
| resource-categories.md | resource | 资源分类规则 + 决策树 |
| methodology-guide.md | pipelines/five-step | 五步法方法论指南 |
| coding-spec.md | pipelines/five-step | FS-Sx-yy 编码规范 |
| output-format.md | pipelines/five-step | 五步法教案输出格式 |
| semester-calendar-template.md | planner | 学期日历模板 |
| weekly-schedule-template.md | planner | 周日程模板 |
| kb-schema.md | kb | 知识库文档结构定义 |
