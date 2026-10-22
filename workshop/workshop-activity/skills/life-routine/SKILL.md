---
name: life-routine
description: Design a thematic life-routine activity aligned with the active pipeline, weekly sub-theme, and client-style life-routine deliverables. Use when the thematic package needs one-day-life integration points.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Life Routine

Design a life-routine activity for a thematic curriculum project. The output should fit the client's life-routine structure: 预期经验 → 实施要点.

## Expert Discovery

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-activity/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-activity/agents/*.md`

## Pre-check

1. Verify `.workshop/projects/{workspace}/` exists
2. Read `.workshop/projects/{workspace}/config.yaml`
3. If available, read `.workshop/plans/{workspace}/week-*.md`
4. Read `workshop-activity/references/thematic-activity-formats.md`

## Step 1: Gather Context

Ask or infer:

- 周次与子主题
- 生活场景（入园 / 进餐 / 盥洗 / 整理 / 午睡前后）
- 希望渗透的主题经验
- 希望教师在哪个日常节点执行

## Step 2: Draft the Activity

Generate:

```markdown
# 生活渗透：{活动名称}

> 周次：{周次}
> 子主题：{子主题}
> 编码：{TC-LR-Wx-yy}

## 预期经验
- ...

## 实施要点
- ...

## 对应生活场景
- ...

## 观察重点
- ...

## 教师提示
- 介入时机：...
- 提醒语句：...
```

Rules:

- 生活渗透应短小、可嵌入日常流程
- 不要写成完整教学活动
- 实施要点必须具体到教师可执行动作

## Step 3: HIL and Write

Present the draft. Wait for approval. Then write:

`.workshop/projects/{workspace}/activities/life-routine-{slug}.md`

After writing, update status:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} life-routine \
  --phase designing \
  --notes "life-routine activity generated"
```

## Out of Scope

- Does NOT generate home-school tasks
- Does NOT replace classroom operational SOPs
