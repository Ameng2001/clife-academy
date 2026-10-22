---
name: theme-narrative
description: Generate a client-facing monthly theme narrative for a thematic curriculum package. Use when the curriculum director needs a polished "主题解读" section, when a customer package requires a month-theme overview, or when someone says "write the theme narrative".
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Theme Narrative

Generate a polished `主题解读` artifact for a thematic curriculum package. This skill is narrower than `theme-analysis`: it turns the analytical groundwork into a client-facing monthly theme narrative.

## Expert Discovery

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-insight/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-insight/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Determine the workspace:
   - If `$ARGUMENTS` looks like a workspace, use `.workshop/projects/{workspace}/`
   - Otherwise derive a workspace from the theme
3. Read `.workshop/projects/{workspace}/theme-analysis.md` if present
4. Read `workshop-kb/references/client-examples/hepu-future/theme-narrative-sample.md`
5. Read active pipeline from `.workshop/projects/{workspace}/config.yaml`
   - If active pipeline is not `thematic-curriculum`, warn but allow continuation

## Step 1: Gather Inputs

Confirm or infer:
- 月主题
- 年龄段
- 月主题周期（默认 4 周）
- 园本特色 / 季节关联 / 地域文化（如有）

If `theme-analysis.md` exists, reuse:
- 主题价值
- 多领域联动
- 周递进建议

## Step 2: Draft the Theme Narrative

Write a client-facing `主题解读` with these blocks:

### 1. 主题定位
- Why this theme matters for this age group
- Connection to children's lived experience

### 2. 主题价值
- Developmental value across 3-5 domains
- Concrete learning opportunities, not abstract slogans

### 3. 递进逻辑
- Week 1: 感知导入
- Week 2: 体验探索
- Week 3: 表现创造
- Week 4: 延展分享

### 4. 活动组织建议
- How teaching activities, region activities, outdoor games, life routines, and home-school tasks work together

## Step 3: Client-Facing Writing Rules

- Chinese first; English optional and brief
- Read like a package introduction, not an internal analysis memo
- Keep the progression logic explicit
- Use customer-friendly wording such as “主题解读” and “递进逻辑”
- Do not dump the full standards table here

## Step 4: Expert Review

Ask the curriculum expert to check:
- narrative coherence
- age appropriateness
- whether the weekly progression is realistic for a month package
- whether the tone is suitable for client delivery

## Step 5: Write Output

Write to:

- `.workshop/projects/{workspace}/theme-narrative.md`

Then update status:

```bash
python3 workshop-core/scripts/workspace_status.py complete-project-skill \
  {workspace} theme-narrative \
  --phase planning
```

## Step 6: Report

Tell the user:
- `theme-narrative.md` has been prepared
- next recommended step is `/workshop-insight:theme-network {workspace}` or `/workshop-planner:month-plan {workspace}`

## Out of Scope

- Does NOT produce the detailed month matrix
- Does NOT replace the full analytical artifact in `theme-analysis.md`
- Does NOT create single-activity drafts
