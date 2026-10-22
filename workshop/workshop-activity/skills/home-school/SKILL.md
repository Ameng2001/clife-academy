---
name: home-school
description: Design a thematic home-school task aligned with the active pipeline, weekly sub-theme, and client-style home-school deliverables. Use when the thematic package needs a short family activity or notice.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Home-School

Design a home-school task for a thematic curriculum project. The output should fit the client's home-school structure: 实施要点.

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
- 面向家长的任务目标
- 完成方式（拍照 / 口头分享 / 带实物 / 简单记录）
- 期望回收时间

## Step 2: Draft the Activity

Generate:

```markdown
# 家园互动：{活动名称}

> 周次：{周次}
> 子主题：{子主题}
> 编码：{TC-HS-Wx-yy}

## 实施要点
- ...

## 家长支持建议
- ...

## 回收方式 / 反馈方式
- ...

## 教师发送提示
- 建议发送时间：...
- 建议说明语气：...
```

Rules:

- 家园互动应简短，不增加家庭负担
- 任务目标必须清楚，家长一看就能执行
- 回收方式必须明确，避免“做完即可”这种空泛结尾

## Step 3: HIL and Write

Present the draft. Wait for approval. Then write:

`.workshop/projects/{workspace}/activities/home-school-{slug}.md`

After writing, update status:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} home-school \
  --phase designing \
  --notes "home-school task generated"
```

## Out of Scope

- Does NOT generate parent-facing graphic notices
- Does NOT replace school-family communication policy
