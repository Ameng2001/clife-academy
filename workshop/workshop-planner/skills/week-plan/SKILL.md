---
name: week-plan
description: Generate a detailed weekly arrangement with 15-17 mixed activity slots, sequencing, and material lists. This produces a shared weekly planning record that project workspaces can reference.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Week Plan

Generate a detailed weekly arrangement for one week, mixing teaching activities, region activities, outdoor games, life routines, and home-school tasks. This is a planning asset that can guide later project and lesson work.

## Expert Discovery

1. **Required expert**: Resolve `instructional-designer.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-planner/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-planner/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Look for `.workshop/plans/{workspace}/month-plan.md` — read the target week's sub-theme and methodology
3. Read `references/weekly-arrangement-template.md` as the preferred output shape
3. Look for existing activity files:
   - PBL activities: `.workshop/projects/{workspace}/activities/clue-*.md`
   - Lesson plans: `.workshop/projects/{workspace}/lesson-plan*.md`
   - If activities already designed, map them to daily slots
   - If not yet designed, create placeholder slots with suggested topics

## Step 1: Gather Context

Auto-populate from month-plan if available. Otherwise ask:

> **请提供以下信息：**
> 1. **周次**: 第几周？（如"第2周"）
> 2. **子主题**: 本周的教学重点（如"花的颜色和形状"）
> 3. **日期范围**: 起止日期
> 4. **教学法**: 本周使用什么教学法？
> 5. **特殊安排**: 是否有节假日、园所活动等占用？

## Step 2: Generate Weekly Arrangement

Following `references/weekly-arrangement-template.md`, generate:

### 一周活动安排表

Prefer a linear weekly arrangement that can hold 15-17 items:

| 序号 | 类型 | 活动编码 | 活动名称 | 对应日次/时段 | 备注 |
|------|------|---------|---------|--------------|------|
| 1 | 家园互动 | {code} | {activity} | {day/slot} | {note} |
| 2 | 教学活动 | {code} | {activity} | {day/slot} | {note} |
| 3 | 区域活动 | {code} | {activity} | {day/slot} | {note} |
| ... | ... | ... | ... | ... | ... |

### 编排原则

- 教学活动承担新经验建构
- 区域活动和教学活动呼应
- 户外活动融入主题元素但不强行概念化
- 生活渗透应嵌入真实生活场景
- 家园互动保持简短可执行
- 如为主题式课程场景，总项数优先控制在 15-17 项
- 活动编码优先使用所选 pipeline 的编码约定

If the user explicitly asks for a classic day-slot table, you may append a compact daily grid as a secondary view, but the primary output should remain the linear arrangement.

## Step 3: Material Preparation List

Compile a daily material checklist:

| 日期 | 活动 | 所需材料 | 数量 | 来源 |
|------|------|---------|------|------|
| 周一 | {activity} | {material} | {qty} | PBL Box / 自备 / 班级常备 |

## Step 4: Teacher Notes

Generate practical reminders:
- 提前准备事项（需要提前一天准备的材料或布置）
- 关注要点（本周需要重点观察记录的幼儿行为）
- 家园互动（需要发给家长的通知或亲子任务）

If the week uses `thematic-curriculum`, explicitly include:

- 区域材料投放要点
- 户外游戏安全提示
- 生活渗透执行节点
- 家园互动发送时机

## Step 5: User Confirmation and Write

Before writing the plan, initialize the planning workspace:

```bash
python3 workshop-core/scripts/runtime_setup.py prepare-plan \
  {workspace} \
  --plan-level week \
  --methodology {selected-methodology-if-any}
```

Present the week plan. Wait for approval. Write to `.workshop/plans/{workspace}/week-{N}-plan.md`.

Update planning status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-planning \
  {workspace} \
  --plan-level week
```

Suggest next steps:
> **下一步:**
> - 为某天或某个主题创建 / 进入 project workspace
> - `/workshop-5step:lesson {主题}` — 在项目中为某天的集体教学编写教案
> - `/workshop-resource:resource-planner` — 在项目中统一规划本周资源
> - 为区域活动、户外游戏、生活渗透、家园互动准备后续活动稿

## Out of Scope

- This skill does NOT write individual lesson plans (use workshop-5step)
- This skill does NOT design PBL activities (use workshop-pbl)
