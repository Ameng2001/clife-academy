---
name: lesson-objective
description: Generate observable learning objectives for a single lesson aligned with Guidelines 3-6 and the active methodology pipeline. Use when a teacher starts planning a lesson, when someone says "help me write objectives for a lesson about spring flowers", or when starting the five-step design pipeline.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Lesson Objective

Generate clear, observable learning objectives for a single lesson, aligned with the 《3-6 岁儿童学习与发展指南》 and appropriate for the target age group.

## Expert Discovery

1. **Required expert**: Resolve `child-development-psychologist.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-5step/agents/`
2. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-5step/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Read active pipeline from workspace config (`.workshop/projects/{workspace}/config.yaml`)
   - If no pipeline set, default to `five-step`
3. Check knowledge base for related lesson plans:
   - Glob `.workshop/kb/lesson-plans/*.md` — read frontmatter for matching themes
   - If found, use past objectives as reference (not copy)
4. If client goal-code references exist in KB or pipeline context, preserve them as `local_goal_system` + `goal_codes`

## Step 1: Gather Context

Ask the user for:

> **请提供以下信息：**
> 1. **课题**: 本节课的主题（如"认识春天的花"）
> 2. **年龄段**: 小班 (3-4岁) / 中班 (4-5岁) / 大班 (5-6岁)
> 3. **主要领域**: 健康 / 语言 / 社会 / 科学 / 艺术
> 4. **活动类型**: 集体教学 / 小组活动 / 区角活动

If knowledge base has relevant past lessons, present them:
> **📚 参考**: 找到 {N} 个相关历年教案，已提取其教学目标作为参考。

## Step 2: Generate Objectives

Generate **3-4 learning objectives** in three dimensions, and optionally map them to client-defined core development goals.

### 认知目标 (Cognitive)
- What knowledge or understanding will children gain?
- Use age-appropriate verbs:
  - 小班: 感知、认识、知道、发现
  - 中班: 了解、观察、比较、分辨
  - 大班: 理解、分析、归纳、推理

### 技能目标 (Skill)
- What abilities will children practice or develop?
- Use action verbs: 能够、学会、尝试、练习

### 情感目标 (Affective)
- What attitudes or dispositions will be fostered?
- Use disposition verbs: 愿意、喜欢、乐于、主动

### Objective Quality Rules

Each objective must:
1. Be **observable**: A teacher can see/hear whether the child achieved it
2. Be **age-appropriate**: Verb complexity matches the age group (reference `guidelines-3-6.md`)
3. Be **specific**: Not vague ("了解花" → "能说出 2-3 种春天常见花的名称和颜色特征")
4. **Align with《指南》**: Map to at least one specific development goal

## Step 3: Standards Mapping

For each objective, identify the matching《指南》development goal:

| 目标 | 领域 | 《指南》对应目标 | 年龄段要求 |
|------|------|----------------|-----------|
| {objective_1} | 科学 | "在探究中认识周围事物和现象" | 4-5岁: 能对事物进行观察比较 |
| ... | ... | ... | ... |

If the client or school uses a local coding system, also add:

| 目标 | 客户发展目标编码 |
|------|----------------|
| {objective_1} | {SE-8 / local-code / TBD} |

When possible, also record:

```yaml
local_goal_system: HEPU-SE
goal_codes:
  - SE-4
  - SE-8
```

If the customer only provides partial codes, preserve the known ones and mark the rest as `TBD` rather than inventing new codes.

## Step 4: Expert Review

Invoke child development psychologist to validate:
- Verb appropriateness for the age band
- Cognitive load (not too many objectives for a single lesson)
- Development progression (objectives build on prior knowledge)

## Step 5: User Confirmation and Write

Present the objectives. Wait for approval.

Write to `.workshop/projects/{workspace}/lesson-objective.md`.

The output should include:

- 三维教学目标
- 《指南》对应关系
- 可选的核心发展目标编码
- 可选的 `local_goal_system` / `goal_codes` 字段

Update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-project-skill \
  {workspace} lesson-objective \
  --theme "{lesson topic}" \
  --phase planning
```

Suggest next steps:
> **下一步:**
> - `/workshop-5step:lesson-scaffold` — 设计五步教学环节结构

## Out of Scope

- This skill does NOT design the full lesson (use the full pipeline for that)
- This skill does NOT generate PBL learning goals (use `workshop-insight:competency-mapping` for PBL)
