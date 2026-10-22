---
name: lesson-generate
description: Compile all lesson design artifacts into a standard-format lesson plan document. Use after lesson details are complete, when a teacher needs the final formatted lesson plan, or when someone says "generate the lesson plan" or "compile the lesson".
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Lesson Generate

Assemble lesson objectives, scaffold, and details into a complete teaching activity document ready for submission or classroom use. The final output should read like a client-facing single activity plan, not just an internal assembly dump.

## Pre-check

1. Read required input files from the workspace:
   - `lesson-objective.md` — learning objectives
   - `lesson-scaffold.md` — five-step structure
   - `lesson-detail.md` — detailed scripts and materials
   - If any missing, list what's missing and suggest running the corresponding skill
2. Read the output format spec from `workshop-pipelines/references/templates/five-step/output-format.md`

## Step 1: Assemble Basic Info

Extract and compile the header section:

```markdown
# 主题教学活动: {活动名称}

| 项目 | 内容 |
|------|------|
| 活动名称 | {name_cn} ({name_en}) |
| 适用年龄 | {age_group} ({age_range}) |
| 活动领域 | {primary_domain} + {secondary_domains} |
| 活动时长 | {duration} 分钟 |
| 活动类型 | {type} |
| 所属主题/子主题 | {theme} / {subtheme} |
| 设计教师 | {teacher_name} |
| 设计日期 | {date} |
```

If no theme/subtheme exists, omit that row rather than fabricating one.

## Step 2: Compile Core Goals and Teaching Objectives

If core development goal codes exist, place them before the teaching objectives, because that matches the client-facing teaching activity template:

```markdown
## 核心发展目标
- {SE-code}: {goal note}
```

From `lesson-objective.md`, format as:

```markdown
## 教学目标

### 认知目标
1. {cognitive_1}
2. {cognitive_2}

### 技能目标
1. {skill_1}

### 情感目标
1. {affective_1}
```

## Step 3: Compile Preparation Section

From `lesson-detail.md`, aggregate the material checklist:

```markdown
## 教学准备

### 环境准备
- {space_setup}

### 材料准备
| 材料 | 数量 | 准备方式 |
|------|------|---------|
| {material_1} | {qty} | {source} |

### 经验准备
- {prior_experience_needed}
```

Also compile:

```markdown
## 重难点

- **活动重点**: {key_point}
- **活动难点**: {difficulty_point}
```

If `lesson-detail.md` contains explicit prior experience or media notes, preserve them under the same preparation block instead of dropping them.

## Step 4: Compile Teaching Process

From `lesson-scaffold.md` and `lesson-detail.md`, generate the main teaching table:

```markdown
## 教学过程

| 环节 | 时长 | 教师行为 | 幼儿行为 | 材料 | 设计意图 | 教师观察与支持要点 |
|------|------|---------|---------|------|---------|-------------------|
| **S1 导入** | {min} min | {teacher_actions} | {child_responses} | {materials} | {intent} | {observe_and_support} |
| **S2 探究** | {min} min | {teacher_actions} | {child_responses} | {materials} | {intent} | {observe_and_support} |
| **S3 操作** | {min} min | {teacher_actions} | {child_responses} | {materials} | {intent} | {observe_and_support} |
| **S4 总结** | {min} min | {teacher_actions} | {child_responses} | {materials} | {intent} | {observe_and_support} |
| **S5 延伸** | {min} min | {teacher_actions} | {child_responses} | {materials} | {intent} | {observe_and_support} |
```

For each step:

- Keep teacher actions close to classroom-usable wording
- Keep child behaviors concise and observable
- Keep observation/support notes action-oriented rather than evaluative
- Preserve the distinction between scaffold-level intent and detail-level scripts

If the final row content becomes too dense, allow short bullet-style line breaks inside cells rather than collapsing everything into one sentence.

## Step 5: Add Differentiation Section (if present)

```markdown
## 分层指导

| 层级 | 幼儿特征 | 指导策略 |
|------|---------|---------|
| 基础层 | {description} | {strategy} |
| 发展层 | {description} | {strategy} |
| 提高层 | {description} | {strategy} |
```

## Step 6: Add Activity Extension and Reflection Template

If S5 already contains only a short prompt, add a separate extension block:

```markdown
## 活动延伸

- 区角延伸: {extension_1}
- 家园延伸: {extension_2}
- 日常生活延伸: {extension_3}
```

Then add the reflection template:

```markdown
## 教学反思

> 课后填写

- **目标达成情况**:
- **幼儿表现亮点**:
- **需要改进的环节**:
- **后续跟进计划**:
```

## Step 7: Final Format Check

Before writing, verify:

- The section order is client-readable
- `核心发展目标` appears before `教学目标` when present
- `活动重点 / 活动难点` are explicit
- `教师观察与支持要点` remains visible in the main process table
- The output reads as one coherent activity plan rather than three stitched source files

## Step 8: Write Output and Request HIL

Write the complete lesson plan to `.workshop/projects/{workspace}/lesson-plan.md`.

Request the deliverable draft checkpoint:

```bash
python3 workshop-core/scripts/workspace_status.py request-hil \
  {workspace} deliverable-draft \
  --notes "lesson plan draft ready for review"
```

Present the compiled lesson plan summary and wait for approval. After approval, complete the stage review:

```bash
python3 workshop-core/scripts/workspace_status.py complete-stage-review \
  {workspace} deliverable-draft lesson-generate \
  --phase reviewing \
  --approved-by curriculum-director \
  --notes "lesson plan draft ready for review"
```

Present a summary to the user:

```
✅ 教案已生成: lesson-plan.md

📋 {活动名称} | {年龄段} | {时长}分钟
目标: {objectives_count} 条 | 环节: 5 步 | 材料: {materials_count} 项

下一步:
- /workshop-quality:standards-check — 自动质量检查
- /workshop-format:format-lesson — 格式标准化（如需要）
- /workshop-resource:resource-planner — 资源规划
```

## Out of Scope

- This skill is an assembly skill — it does NOT create new content
- It does NOT export to Word/PDF (future capability)
- It does NOT run quality checks (use workshop-quality for that)
