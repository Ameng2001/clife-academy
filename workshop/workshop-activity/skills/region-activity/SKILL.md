---
name: region-activity
description: Design a thematic region activity aligned with the active pipeline, weekly sub-theme, and client-style deliverables. Use when a curriculum team needs a reading/arts/science/building/drama corner activity inside a monthly thematic package.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Region Activity

Design a region activity for a thematic curriculum project. The output should fit the client's region-activity structure: 预期经验 → 材料投放 → 指导策略.

## Expert Discovery

1. **Required expert**: Resolve `instructional-designer.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-activity/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-activity/agents/*.md`

## Pre-check

1. Verify `.workshop/projects/{workspace}/` exists
2. Read `.workshop/projects/{workspace}/config.yaml`
3. If available, read:
   - `.workshop/plans/{workspace}/week-*.md`
   - `.workshop/plans/{workspace}/month-plan.md`
   - `workshop-kb/references/client-examples/hepu-future/activity-type-samples.md`
4. Read `workshop-activity/references/thematic-activity-formats.md`

## Step 1: Gather Context

Ask or infer:

- 区域类型（阅读区 / 建构区 / 美工区 / 科学区 / 表演区 / 益智区）
- 周次与子主题
- 活动名称
- 年龄段
- 对应主题经验
- 是否需要与某个教学活动联动

## Step 2: Draft the Activity

Generate:

```markdown
# 区域活动：{活动名称}

> 区域：{区域类型}
> 周次：{周次}
> 子主题：{子主题}
> 编码：{TC-RA-Wx-yy}

## 预期经验
- ...

## 材料投放
- ...

## 指导策略
- ...

## 观察重点
- ...

## 与周计划的关联
- 对应教学活动：{optional}
- 建议投放日：{day_or_slot}
```

Rules:

- 区域活动应能独立执行，也能与教学活动呼应
- 材料投放必须具体，不写“材料若干”
- 指导策略必须包含教师介入时机，而不只是理念表述

## Step 3: HIL and Write

Present the draft. Wait for approval. Then write:

`.workshop/projects/{workspace}/activities/region-{slug}.md`

After writing, update status:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} region-activity \
  --phase designing \
  --notes "region activity generated"
```

## Out of Scope

- Does NOT generate the full week plan
- Does NOT format Word/PDF exports
