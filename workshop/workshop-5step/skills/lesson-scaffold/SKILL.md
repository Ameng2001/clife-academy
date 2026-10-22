---
name: lesson-scaffold
description: Design the five-step teaching structure (导入→探究→操作→总结→延伸) with time allocation and activity types for each step. Use after lesson objectives are set, when a teacher needs to structure a lesson, or when someone says "help me design the teaching flow".
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Lesson Scaffold

Design the five-step teaching structure for a single teaching activity. Each step gets a time allocation, activity type, key questions, expected child behaviors, and scaffold notes for the final client-facing lesson template.

## Expert Discovery

1. **Required expert**: Resolve `instructional-designer.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-5step/agents/`
2. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-5step/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Read `.workshop/projects/{workspace}/lesson-objective.md` — if present, use objectives as the design anchor
   - If not present, warn: "建议先运行 `/workshop-5step:lesson-objective` 设定教学目标" but proceed if user insists
3. Read the five-step methodology guide from `workshop-pipelines/references/templates/five-step/methodology-guide.md`
4. Read age-appropriate time allocation from the methodology guide
5. If `lesson-objective.md` contains `核心发展目标`, `活动重点`, or `活动难点`, carry them forward into the scaffold

## Step 1: Determine Parameters

From objectives file or user input, confirm:
- **课题**: Lesson topic
- **年龄段**: Age group (determines total duration and step time ratios)
- **教学目标**: The 3-4 objectives to address
- **主要领域**: Primary learning domain
- **核心发展目标**: Goal-code alignment that must stay visible through later assembly
- **活动重点 / 活动难点**: Instructional focus points that should shape the exploration and practice steps

Time allocation reference:

| 年龄段 | 总时长 | S1 导入 | S2 探究 | S3 操作 | S4 总结 | S5 延伸 |
|--------|--------|---------|---------|---------|---------|---------|
| 小班 | 15-20 min | 2-3 | 5-8 | 3-5 | 2-3 | 1-2 |
| 中班 | 20-25 min | 3-4 | 8-10 | 5-7 | 3-4 | 2 |
| 大班 | 25-30 min | 3-5 | 10-12 | 5-8 | 3-5 | 2-3 |

## Step 2: Design Five Steps

For each step, generate:

### S1 导入 / Introduction ({time} min)
- **方式**: {导入策略 — 实物/情境/问题/游戏/回顾}
- **核心问题**: {引导幼儿进入主题的开放性问题}
- **预期反应**: {幼儿可能的回应}
- **设计意图**: {为什么选择这种导入方式}
- **教师观察与支持要点（脚手架）**: {开场观察重点、注意力支持、参与提醒}

### S2 探究 / Exploration ({time} min)
- **方式**: {探究策略 — 观察/实验/讨论/调查}
- **核心问题**: {引导深入探究的关键问题，2-3 个}
- **预期反应**: {幼儿在探究中的典型行为}
- **目标对应**: {本环节主要达成哪个教学目标}
- **重点 / 难点对应**: {本环节如何承接活动重点或突破活动难点}
- **教师观察与支持要点（脚手架）**: {教师重点看什么、常见困难、支持方式}

### S3 操作 / Practice ({time} min)
- **方式**: {操作策略 — 创作/练习/游戏/合作}
- **任务描述**: {幼儿需要完成的具体操作}
- **分层设计**: 基础层 / 发展层 / 提高层
- **目标对应**: {本环节主要达成哪个教学目标}
- **重点 / 难点对应**: {本环节如何巩固重点或支持突破难点}
- **教师观察与支持要点（脚手架）**: {教师重点看什么、常见困难、支持方式}

### S4 总结 / Summary ({time} min)
- **方式**: {总结策略 — 作品分享/关键提问/经验梳理}
- **核心问题**: {帮助幼儿回顾关键发现的问题}
- **目标对应**: {检验哪个教学目标}
- **教师观察与支持要点（脚手架）**: {梳理共识、鼓励表达、纠偏方式}

### S5 延伸 / Extension ({time} min)
- **方式**: {延伸策略 — 区角/家园/生活/下课预告}
- **延伸内容**: {具体延伸活动或任务}
- **教师观察与支持要点（脚手架）**: {如何说明延伸任务、如何提示家园/区角承接}

## Step 3: Teaching Focus Alignment

Summarize the client-facing teaching focus block:

- **核心发展目标**: {goal codes and plain-language notes}
- **活动重点**: {one concise sentence}
- **活动难点**: {one concise sentence}

Confirm that these three items are consistent with the five-step structure.

## Step 4: Objective Coverage Check

Verify every learning objective is addressed by at least one step:

| 教学目标 | 对应环节 | 达成方式 |
|---------|---------|---------|
| {objective_1} | S2 探究 | 通过观察比较达成 |
| {objective_2} | S3 操作 | 通过动手实践达成 |
| ... | ... | ... |

If any objective is not covered, adjust the step design.

## Step 5: Expert Review

Invoke instructional designer to check:
- Time allocation reasonableness for the age group
- Smooth transitions between steps
- Activity variety (not all steps are "teacher talks")
- Differentiation adequacy in S3
- Core development goals are visible but not overloaded
- Key point / difficulty point are concretely reflected in S2 and S3
- Observation and support notes are specific enough for later detail writing

## Step 6: Write Draft and Request HIL

Write to `.workshop/projects/{workspace}/lesson-scaffold.md`.

The scaffold output should now contain:

- 课题、年龄段、总时长
- 核心发展目标
- 活动重点 / 活动难点
- 五步环节结构
- 每环节的教师观察与支持要点（脚手架级）
- 教学目标覆盖表

Then request the design scaffold checkpoint:

```bash
python3 workshop-core/scripts/workspace_status.py request-hil \
  {workspace} design-scaffold \
  --notes "lesson scaffold draft ready for review"
```

Present the scaffold overview. Wait for approval.

After approval, complete the stage review:

```bash
python3 workshop-core/scripts/workspace_status.py complete-stage-review \
  {workspace} design-scaffold lesson-scaffold \
  --phase designing \
  --approved-by curriculum-director \
  --notes "lesson scaffold draft ready for review"
```

Suggest next steps:
> **下一步:**
> - `/workshop-5step:lesson-detail` — 为每个环节编写具体话术、材料清单和教师支持细节

## Out of Scope

- This skill does NOT write detailed teacher scripts (use lesson-detail)
- This skill does NOT generate the final formatted lesson plan (use lesson-generate)
