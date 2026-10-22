---
name: proposal-generate
description: Compile all design artifacts into a complete PBL proposal document following the Huamei 5-section format (项目概览→项目标准→项目启动→项目探究→项目展示). Use when all design work is done and the curriculum director needs the final output, or when someone says "generate the proposal". Produces a ready-to-use PBL pre-proposal.
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Proposal Generate

Compile all PBL design artifacts into a complete proposal document following the华美 PBL 5-section format. This is an assembly skill — it reads existing artifacts and composes them into the final deliverable.

## Pre-check

1. Verify `.workshop/` exists.
2. Read from `.workshop/projects/$ARGUMENTS/`:
   - **Required**: `driving-question.md`, `network-map.md`, `inquiry-clues.md`, `activities/clue-1.md`, `activities/clue-2.md`, `activities/clue-3.md`
   - **Optional**: `theme-analysis.md` (from workshop-insight), `prior-knowledge.md`, `competency-mapping.md`, `resource-plan.md` (from workshop-resource)
3. If required files are missing, tell the user which skills to run first.

## Workflow

### Step 1: Assemble Section 01 — 项目概览 Project Overview

**Source**: `theme-analysis.md` (if available) or generate from `driving-question.md`

Content:
- Section header with description: "此部分为项目主题总述，帮助教师快速了解开展此项目的背景、原因和必要性等，为教师构建主题网络图提供参考。"
- Theme background narrative (中英双语, 2-3 paragraphs)
- Educational value: why this theme matters for children's development

### Step 2: Assemble Section 02 — 项目标准 Project Standard

**Source**: `competency-mapping.md` + `prior-knowledge.md` (if available) or extract from `inquiry-clues.md`

Content:
- Section header: "此部分为项目支架，帮助教师确定幼儿已有经验、制定项目目标，以实现 PBL 学习成果、推动各项技能发展提供指导方向。"
- **Prior Knowledge 先前经验**: 3 bullet points of what children already know
- **4C's of 21st Century Learning Skills 4C能力**:

| 4C Skill | Specific manifestation for this project |
|----------|----------------------------------------|
| Creativity and Innovation 创造和革新能力 | {from competency-mapping or inquiry-clues} |
| Critical Thinking and Problem Solving 思辨能力和问题解决能力 | {mapping} |
| Communication 沟通能力 | {mapping} |
| Collaboration 合作能力 | {mapping} |

- **Learning Goals 学习目标**: numbered list from inquiry-clues.md

### Step 3: Assemble Section 03 — 项目启动 Project Launch

**Source**: `driving-question.md` + `network-map.md`

Content:
- Section header: "此部分为驱动性问题的确定，教师需要结合幼儿兴趣及本月主题，罗列并选择探究问题，推动项目课程的开展。"
- Contextual narrative connecting the theme to children's daily life (2 paragraphs, bilingual)
- The driving question (prominent display, bilingual)
- Note about flexibility: "根据{主题}，幼儿可能还会提出其他问题，教师可参考开展活动..."
- Network map diagram (from network-map.md)

### Step 4: Assemble Section 04 — 项目探究 Project Inquiry

**Source**: `inquiry-clues.md` + `activities/clue-{1,2,3}.md`

Content:
- Section header: "此部分为项目发展的过程，教师需要协助幼儿进行探究，开展一系列的探究活动。"
- Driving question → 3 clues overview diagram:

```
{Driving Question}  →  Clue 1: {question} (3-5 days)
                    →  Clue 2: {question} (3-5 days)
                    →  Clue 3: {question} (3-5 days)
```

- For each clue:
  - Clue header: 探究线索 {N}: {question}
  - Success Skills: ① {skill1} ② {skill2}
  - Learning Goals: ① {goal1} ② {goal2}
  - Keywords: {keyword list}
  - Activity table (bilingual):

| 关键问题 Key Questions | 活动名称 Activities | 活动内容 Contents | 活动资源 Resources |
|---------------------|-------------------|----------------|-----------------|
| {question} | PBL-C{N}-01 {name CN} / {name EN} | 1. {step} 2. {step} ... | • {resource list} |

### Step 5: Assemble Section 05 — 项目展示 Project Products

**Source**: Generate from activities (especially Clue 3 which is typically the presentation phase)

Content:
- Section header: "此部分为项目展示环节，记录和展示幼儿在项目中的学习成果。"
- Exhibition plan: what children will present/display
- Suggested formats: 记录书制作、成果展示墙、家长开放日、角色扮演展示
- Reflection prompts for teachers

### Step 6: Final Formatting

- Ensure all content is bilingual (Chinese primary, English secondary)
- Ensure consistent formatting across all sections
- Add proposal metadata at the top:

```markdown
# {Theme Chinese} PBL 项目活动预案
# {Theme English} PBL Project Pre-proposal

> Age Group: {PreK-3 / PreK-4 / K}
> Month: {month}
> Date: {YYYY-MM-DD}
```

### Step 7: Write Output and Request HIL

Write `.workshop/projects/{workspace}/proposal.md` with the complete 5-section document.

Request the deliverable draft checkpoint:

```bash
python3 workshop-core/scripts/workspace_status.py request-hil \
  {workspace} deliverable-draft \
  --notes "proposal draft ready for review"
```

After the user confirms the assembled proposal draft, complete the stage review:

```bash
python3 workshop-core/scripts/workspace_status.py complete-stage-review \
  {workspace} deliverable-draft proposal-generate \
  --phase reviewing \
  --approved-by curriculum-director \
  --notes "proposal draft ready for review"
```

Present summary to user:

> **预案已生成：** `proposal.md`
>
> | Section | Status | Source |
> |---------|--------|-------|
> | 01 项目概览 | ✅ | {theme-analysis.md / auto-generated} |
> | 02 项目标准 | ✅ | {competency-mapping.md / inquiry-clues} |
> | 03 项目启动 | ✅ | {driving-question.md + network-map.md} |
> | 04 项目探究 | ✅ | {inquiry-clues.md + activities/} |
> | 05 项目展示 | ✅ | {auto-generated from Clue 3} |
>
> 共 {N} 个探究线索，{M} 个活动。
>
> 建议下一步：
> - 运行 `/workshop-quality:standards-check` 检查质量
> - 运行 `/workshop-resource:resource-planner` 完善资源清单

## Out of Scope
- Does NOT do PDF formatting or visual styling
- Does NOT validate quality (workshop-quality's responsibility)
- Does NOT design new activities — only assembles existing artifacts
