# Opportunity Brief: Course Workshop

> Date: 2026-03-28

## Plugin Candidate Assessment

### Impact × Feasibility Matrix

| Plugin Candidate | Impact (1-5) | Feasibility (1-5) | Priority Score | Rationale |
|-----------------|-------------|-------------------|---------------|-----------|
| workshop-pbl | 5 | 4 | **20** | 覆盖 HS-1(驱动问题) + HS-2(活动设计) — 两个最大痛点。AI 擅长结构化生成 |
| workshop-quality | 4 | 5 | **20** | 覆盖 HS-4(4C映射) + HS-7(课标对齐)。规则明确，自动化程度高 |
| workshop-insight | 4 | 4 | **16** | 覆盖 HS-5(新人上手)。标准化前期准备流程，降低经验门槛 |
| workshop-resource | 5 | 3 | **15** | 覆盖 HS-3(资源遗漏)。高影响但需要维护 PBL Box 物料数据库 |
| workshop-core | 3 | 5 | **15** | 基础设施 — 工作区管理和状态追踪。必须有但影响感知低 |

### Priority Ranking

| Rank | Plugin | Phase | Effort Estimate | Dependencies |
|------|--------|-------|-----------------|--------------|
| 1 | **workshop-core** | 先建 | 小（3 skills） | 无 |
| 2 | **workshop-pbl** | 紧跟 | 大（5-6 skills） | workshop-core |
| 3 | **workshop-insight** | 同步 | 中（3-4 skills） | 无 |
| 4 | **workshop-quality** | 并行 | 中（2-3 skills） | 无 |
| 5 | **workshop-resource** | 后续 | 中（2 skills）+ 数据维护 | workshop-core |

> **Note**: workshop-core 虽然 Priority Score 不是最高，但作为基础设施必须首先建设。
> workshop-pbl 和 workshop-insight 可以并行开发（insight 无依赖）。

### Effort & Risk Notes

| Plugin | Key Risk | Mitigation |
|--------|----------|------------|
| workshop-pbl | 驱动问题生成质量 — AI 可能生成看似开放但实际封闭的问题 | 内置开放性评分 + 课程专家 agent 自动审核 |
| workshop-pbl | 活动内容生成可能过于模板化 | 生成骨架(结构+关键问题)而非完整内容，让课研主任填充创意部分 |
| workshop-resource | PBL Box 物料数据库需要持续维护 | 先用参考文档(references/)，后续可接 MCP 对接供应链系统 |
| workshop-quality | 课标数据库需要定期更新 | 作为 references/ 内置，版本化管理 |

### Build Roadmap

```
Phase 1 (MVP):
  workshop-core (init, status, promote)
  workshop-pbl (driving-question, inquiry-scaffold, activity-design, proposal-generate)

Phase 2 (Enhancement):
  workshop-insight (theme-analysis, prior-knowledge, competency-mapping)
  workshop-quality (standards-check, proposal-review)

Phase 3 (Advanced):
  workshop-resource (resource-planner, resource-check)
  workshop-pbl += network-map (网络图自动生成)
```
