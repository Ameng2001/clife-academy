---
name: inquiry-scaffold
description: Split a driving question into 3 progressive inquiry clues, each with key question, success skills (4C), learning goals, keywords, and estimated duration. Use after network-map is built, when planning the exploration structure, or when someone says "help me break down the project". Produces 3 stepped inquiry clues.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Inquiry Scaffold

Split a driving question into 3 progressive inquiry clues that form the backbone of PBL exploration. Each clue represents a phase with increasing depth — from concrete experience to abstract understanding.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-pbl/agents/`
2. **Required expert**: Resolve `child-development-psychologist.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-pbl/agents/*.md`
6. **Match by relevance**: Select additional experts relevant to the theme

## Pre-check

1. Verify `.workshop/` exists.
2. Read `.workshop/projects/$ARGUMENTS/driving-question.md` — required.
3. Read `.workshop/projects/$ARGUMENTS/network-map.md` — required. If missing, tell the user to run `/workshop-pbl:network-map` first.
4. Read `.workshop/projects/$ARGUMENTS/competency-mapping.md` — optional, enriches 4C mapping.

## Step 1: Analyze Network Map

From `network-map.md`, identify:
- All sub-questions grouped by dimension
- Domain coverage annotations
- The natural **exploration arc**: which sub-questions are more concrete/experiential? Which are more abstract/analytical?

Sort sub-questions on a **concrete → abstract** spectrum:
- **Concrete end**: sensory experience, personal preference, hands-on making
- **Middle**: problem-solving, investigation, comparison
- **Abstract end**: planning, evaluation, integration, presentation

## Step 2: Design 3 Clues

Group sub-questions into 3 clues following the **progression principle**:

| Clue | Phase | Focus | Typical Sub-Question Types |
|------|-------|-------|---------------------------|
| Clue 1 | 具象体验 | 感受和发现 | 个人偏好、感官体验、初步认识 |
| Clue 2 | 问题解决 | 探索和创造 | 动手制作、实验、调查研究 |
| Clue 3 | 整合展示 | 应用和分享 | 计划、准备、展示、反思 |

**Progression is NOT "simple → complex"**, it is "concrete experience → abstract understanding":
- Clue 1: Children **experience** — taste, touch, observe, express preferences
- Clue 2: Children **investigate** — experiment, research, make, solve problems
- Clue 3: Children **integrate** — plan a real event, prepare, present to others

### Design Rules

- Each clue should have **1 key question** (中英双语)
- Each clue covers **2-4 sub-questions** from the network map
- No sub-question appears in more than one clue
- Each clue should take **3-5 days** (each day = 1 activity session of 20-30 min)
- The 3 clues should be roughly balanced in duration

## Step 3: Assign 4C Skills

For each clue, assign **2 primary 4C skills** (not all 4 — be honest about what the clue actually develops):

### Age-Appropriate 4C Definitions

| 4C Skill | PreK-3 (2-3岁) | PreK-4 (3-4岁) | K (5-6岁) |
|----------|---------------|---------------|-----------|
| Creativity 创造力 | 涂鸦、随意拼搭 | 有目的地制作、改编 | 设计、发明、解决方案 |
| Critical Thinking 思辨力 | 分类、配对 | 比较、预测、提问 | 分析原因、提出假设、验证 |
| Communication 沟通力 | 表达需求、命名 | 描述观察、简单采访 | 展示、说服、辩论 |
| Collaboration 合作力 | 并行活动(旁边做) | 轮流、分享材料 | 分工合作、共同计划 |

**Common 4C Mapping Errors to Avoid:**
- 制作手工 ≠ Critical Thinking (通常是 Creativity)
- 小组讨论 ≠ Collaboration (通常是 Communication)
- 投票选择 ≠ Critical Thinking (通常是 Communication + simple decision)

## Step 4: Write Learning Goals

For each clue, write **2-3 learning goals** using age-appropriate verbs:

| Age Group | Appropriate Verbs | Avoid Verbs |
|-----------|------------------|-------------|
| PreK-3 | 感受、尝试、体验、认识 | 理解、分析、评估 |
| PreK-4 | 认识、了解、能够、知道 | 分析、比较（复杂）、设计 |
| K | 理解、比较、分析、能够 | 评估、批判、建构（学术语） |

Each goal must be **observable** — "能够通过问卷调查了解大家喜欢的果汁" rather than "理解市场需求".

## Step 5: Extract Keywords

For each clue, list **5-8 English keywords** that capture the clue's core concepts. These keywords appear in the final proposal and help with cross-referencing.

## Step 6: Expert Review

Use the Agent tool to run two expert reviews in parallel:

**Expert 1: early-childhood-curriculum-expert**
- Instruction: "Review these 3 inquiry clues. Check: (1) Is the progression truly from concrete→abstract, or just simple→complex? (2) Do the 3 clues collectively cover the driving question's exploration dimensions? (3) Is each clue's duration balanced (3-5 days)? (4) Are there gaps — sub-questions from the network map that are dropped without justification?"

**Expert 2: child-development-psychologist**
- Instruction: "Review the 4C skill assignments and learning goals. Check: (1) Are the 4C skills correctly mapped to actual activities (not aspirational)? (2) Are the learning goal verbs appropriate for the age group? (3) Are there developmental concerns with any clue's expectations?"

Incorporate corrections before presenting to the user.

## Step 7: Present and Validate

> **3 条递进探究线索：**
>
> | | Clue 1 | Clue 2 | Clue 3 |
> |---|--------|--------|--------|
> | **关键问题** | {Q1 中英} | {Q2 中英} | {Q3 中英} |
> | **成功素养** | {4C skills} | {4C skills} | {4C skills} |
> | **学习目标** | {goals} | {goals} | {goals} |
> | **关键词** | {keywords} | {keywords} | {keywords} |
> | **建议时长** | {N} 天 | {N} 天 | {N} 天 |
> | **递进关系** | 具象体验 → | 问题解决 → | 整合展示 |
>
> **专家反馈**：{summary of expert corrections}
>
> 确认还是需要调整？

## Step 8: Write Output and Request HIL

Write `.workshop/projects/{workspace}/inquiry-clues.md`:

```markdown
# Inquiry Clues: {Theme}

> Date: {YYYY-MM-DD}
> Driving Question: {question}
> Age Group: {age group}

## Clue 1: {Key Question Chinese}
{Key Question English}

- **Success Skills**: {4C skill 1}, {4C skill 2}
- **Learning Goals**:
  1. {goal 1}
  2. {goal 2}
- **Keywords**: {keyword1}, {keyword2}, ...
- **Duration**: {N} days (3-5 activities)
- **Sub-Questions Covered**: {from network-map}

## Clue 2: {Key Question Chinese}
{Key Question English}

...

## Clue 3: {Key Question Chinese}
{Key Question English}

...

## Progression Rationale

Clue 1 → Clue 2 → Clue 3:
{explanation of why this order makes sense — concrete→abstract}

## Expert Review Summary

- Curriculum expert: {feedback}
- Psychologist: {feedback}
```

Request the design scaffold checkpoint:

```bash
python3 workshop-core/scripts/workspace_status.py request-hil \
  {workspace} design-scaffold \
  --notes "inquiry scaffold draft ready for review"
```

After the user confirms the 3-clue structure, complete the stage review:

```bash
python3 workshop-core/scripts/workspace_status.py complete-stage-review \
  {workspace} design-scaffold inquiry-scaffold \
  --phase designing \
  --approved-by curriculum-director \
  --notes "inquiry scaffold draft ready for review"
```

Tell the user: "Inquiry scaffold complete. Run `/workshop-pbl:activity-design {workspace}` to design activities for each clue."

## Out of Scope
- Does NOT design specific activities (activity-design's responsibility)
- Does NOT match resources
- Does NOT generate the full proposal
