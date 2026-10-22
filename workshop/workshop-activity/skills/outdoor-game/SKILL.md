---
name: outdoor-game
description: Design a thematic outdoor game aligned with the active pipeline, weekly sub-theme, and client-style outdoor game deliverables. Use when the weekly package needs a playable themed outdoor activity.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Outdoor Game

Design an outdoor game for a thematic curriculum project. The output should fit the client's outdoor-game structure: 预期经验 → 游戏准备 → 游戏玩法.

## Expert Discovery

1. **Required expert**: Resolve `instructional-designer.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-activity/agents/`
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
- 户外活动目标
- 场地条件
- 安全边界
- 游戏组织方式（全班 / 小组 / 接力 / 自由探索）

## Step 2: Draft the Activity

Generate:

```markdown
# 户外游戏：{活动名称}

> 周次：{周次}
> 子主题：{子主题}
> 编码：{TC-OG-Wx-yy}

## 预期经验
- ...

## 游戏准备
- ...

## 游戏玩法
1. ...
2. ...
3. ...

## 安全提示
- ...

## 观察重点
- ...

## 场地与组织
- 场地要求：...
- 组织方式：...
```

Rules:

- 游戏规则必须能被教师直接执行
- 安全提示必须具体到场地或材料
- 优先使用幼儿可理解的动作与规则说明

## Step 3: HIL and Write

Present the draft. Wait for approval. Then write:

`.workshop/projects/{workspace}/activities/outdoor-{slug}.md`

After writing, update status:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} outdoor-game \
  --phase designing \
  --notes "outdoor game generated"
```

## Out of Scope

- Does NOT generate visual playground diagrams
- Does NOT replace full safety review
