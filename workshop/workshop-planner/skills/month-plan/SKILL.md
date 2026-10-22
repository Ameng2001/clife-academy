---
name: month-plan
description: Break a monthly theme into 3-4 weekly sub-themes with methodology selection, learning focus, and a multi-activity monthly matrix. This produces a shared planning record that project workspaces can later reference.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Month Plan

Break a monthly theme from the semester calendar into weekly sub-themes, methodology assignments, and a month-level activity matrix. This is a global planning asset, but it should be detailed enough to guide a full thematic curriculum package.

## Expert Discovery

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-planner/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-planner/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Look for `.workshop/plans/{workspace}/semester-plan.md` — if present, read it to get the month's theme, age group, and allocated methodology
3. Check knowledge base for related materials: `.workshop/kb/lesson-plans/*.md` with matching theme tags
4. Read `references/monthly-activity-matrix-template.md` as the preferred output shape when designing a thematic curriculum package

## Step 1: Gather Context

If semester-plan exists, auto-populate from it. Otherwise ask:

> **请提供以下信息：**
> 1. **月度主题**: 本月的教学主题（如"春天的花"）
> 2. **年龄段**: 小班/中班/大班
> 3. **可用周数**: 通常 3-4 周
> 4. **教学法偏好**: PBL / 五步法 / 主题式课程 / 混合
> 5. **活动类型要求**（可选）: 是否需要覆盖教学活动、区域活动、户外游戏、生活渗透、家园互动？

## Step 2: Design Weekly Structure

For each week, generate:

```
Week {N}: {子主题名称}
  Focus: {本周教学重点}
  Methodology: {pbl-huamei / five-step / mixed}
  Domains: {核心领域}
  Key Activities:
    - {活动1概要}
    - {活动2概要}
    - {活动3概要}
  Materials Preview: {本周关键材料}
```

### 周次递进逻辑

- **第 1 周**: 感知导入 — 建立主题认知，激发兴趣（偏五步法）
- **第 2 周**: 深入探究 — 核心探究活动，多领域整合（偏 PBL 或五步法）
- **第 3 周**: 操作实践 — 巩固经验，动手创造（偏五步法或 PBL 线索 2-3）
- **第 4 周**: 展示总结 — 成果呈现，经验分享（可选，视主题复杂度）

## Step 3: Build Monthly Activity Matrix

Generate a month-level matrix following `references/monthly-activity-matrix-template.md`:

| 周次 | 教学活动 | 区域活动 | 户外游戏 | 生活渗透 | 家园互动 |
|------|---------|---------|---------|---------|---------|
| 第 1 周 | {3-5 项} | {4-6 项} | {1-2 项} | {1-2 项} | {1-2 项} |
| 第 2 周 | {3-5 项} | {4-6 项} | {1-2 项} | {1-2 项} | {1-2 项} |
| 第 3 周 | {3-5 项} | {4-6 项} | {1-2 项} | {1-2 项} | {1-2 项} |
| 第 4 周 | {3-5 项} | {4-6 项} | {1-2 项} | {1-2 项} | {1-2 项} |

Rules:

- Reflect weekly progression, not random accumulation
- Keep activity names concrete enough for later activity drafting
- If the selected pipeline is `thematic-curriculum`, prioritize balanced multi-activity coverage each week

## Step 4: Methodology Assignment

For each week, recommend a methodology and explain why:

| 周次 | 推荐教学法 | 理由 |
|------|-----------|------|
| Week 1 | five-step | 单课时导入适合快速建立认知 |
| Week 2-3 | pbl-huamei / five-step | 根据主题复杂度和探究深度选择 |
| Week 4 | five-step | 总结展示适合结构化教学 |

## Step 5: User Confirmation

Present the monthly plan. Wait for approval. If changes requested, adjust.

## Step 6: Write Output

Before writing the plan, initialize the planning workspace:

```bash
python3 workshop-core/scripts/runtime_setup.py prepare-plan \
  {workspace} \
  --plan-level month \
  --methodology {selected-methodology-if-any}
```

Write to `.workshop/plans/{workspace}/month-plan.md`.

The output should now include:

- 月度主题概览
- 周次递进结构
- 月度主题活动矩阵
- 每周材料预览

When the pipeline is `thematic-curriculum`, prefer the matrix template over a generic weekly summary.

Update `.workshop/plans/{workspace}/config.yaml` with the month's methodology setting if the user specifies a preference.
Update planning status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-planning \
  {workspace} \
  --plan-level month
```

Suggest next steps:
> **下一步:**
> - `/workshop-planner:week-plan {周次}` — 细化某周的每日安排
> - 为某个周主题创建或进入 project workspace
> - `/workshop-pbl:design {主题}` — 在项目中开始 PBL 周的设计
> - `/workshop-5step:lesson {主题}` — 在项目中开始五步法教案设计
> - 为主题式课程场景准备区域活动 / 户外游戏 / 生活渗透 / 家园互动活动稿

## Out of Scope

- This skill does NOT design individual lessons or PBL projects
- This skill does NOT generate daily schedules (use `week-plan` for that)
