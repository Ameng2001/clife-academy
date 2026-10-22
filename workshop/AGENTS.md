# Course Workshop Plugins

PBL (Project-Based Learning) course design toolkit for kindergarten curriculum directors (课研主任). Helps systematically design monthly PBL proposals from theme analysis to classroom-ready activity plans.

## Repository Structure

```
├── workshop-core/         # Workspace management (init, status, promote) — 3 skills
├── workshop-designer/     # Course design pipeline (driving-question → proposal) — 5 skills
├── workshop-insight/      # Pre-analysis toolkit (theme, prior-knowledge, 4C) — 3 skills
├── workshop-quality/      # Quality assurance (standards-check, proposal-review) — 2 skills
├── workshop-resource/     # Resource management (resource-planner, resource-check) — 2 skills
└── studio/                # Design workspace (planning artifacts, git-tracked)
```

## Plugin Dependencies

```
workshop-core      (zero deps)
workshop-insight   (zero deps)
workshop-quality   (zero deps)
workshop-designer  (depends on workshop-core)
workshop-resource  (depends on workshop-core)
```

## Design Pipeline

`/workshop-designer:design` chains 5 skills:

```
driving-question → network-map → inquiry-scaffold → activity-design ×3 → proposal-generate
      ↑                                                    ↑                      ↑
  (workshop-insight                                   (workshop-resource     (workshop-insight
   optional input)                                     optional input)       optional input)
```

## Domain Experts

3 built-in agents in each plugin's `agents/` directory:
- **early-childhood-curriculum-expert** — PBL methodology, curriculum standards, age-appropriateness
- **child-development-psychologist** — developmental stages, 4C mapping, prior knowledge
- **instructional-designer** — activity feasibility, resource planning, teacher instructions

## Development Workflow

1. Edit SKILL.md files directly — changes take effect immediately
2. Test with: `Codex --plugin-dir ./workshop-core --plugin-dir ./workshop-designer --plugin-dir ./workshop-insight --plugin-dir ./workshop-quality --plugin-dir ./workshop-resource`
3. Key test flow: `/workshop-designer:design 我周围的人`

## Key References

| File | Plugin | Purpose |
|------|--------|---------|
| pbl-methodology-guide.md | designer | PBL 方法论 + 三阶段九要素 |
| activity-coding-spec.md | designer | PBL-Cx-y 编码规范 |
| guidelines-3-6.md | insight, quality | 《指南》五大领域摘要 |
| 4c-framework.md | insight | 4C 能力矩阵 + 误分类表 |
| age-ability-matrix.md | quality | 年龄×能力查询表 |
| pbl-box-catalog.md | resource | PBL Box 物料目录 |
| resource-categories.md | resource | 资源分类规则 + 决策树 |
