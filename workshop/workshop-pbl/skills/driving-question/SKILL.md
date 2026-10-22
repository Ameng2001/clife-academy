---
name: driving-question
description: Generate and validate a driving question for a PBL project based on the monthly theme, target age group, and learning goals. Use when starting a new PBL course design, when the curriculum director needs a driving question, or when someone says "help me design a project question". Produces a validated driving question with openness scoring.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Driving Question

Generate an investigable, age-appropriate driving question for a PBL project. The driving question is the anchor of the entire project — it must be open-ended, meaningful to children, and allow multi-dimensional exploration.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-pbl/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-pbl/agents/*.md`
5. **Match by relevance**: Select additional experts relevant to the monthly theme
6. **Skip template**: Do not load `_domain-expert-template.md`

The required expert validates the driving question. Other domain experts review if the theme touches their area.

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Determine the workspace path:
   - If `$ARGUMENTS` contains a workspace name, use `.workshop/projects/$ARGUMENTS/`
   - Otherwise create a new workspace from the theme name
3. Check for optional enrichment files:
   - `.workshop/projects/{workspace}/theme-analysis.md` — from workshop-insight
   - `.workshop/projects/{workspace}/competency-mapping.md` — from workshop-insight
   - If present, read them for context. If absent, proceed without them.

## Step 1: Gather Context

Ask the user for:

> **请提供以下信息：**
> 1. **月度主题**：本月的项目主题是什么？（如"我周围的人"、"交通工具"、"动物"）
> 2. **年龄段**：PreK-3 (2-3岁) / PreK-4 (3-4岁) / K (5-6岁)
> 3. **补充信息**（可选）：是否有特定的关注方向、园本特色、或已有的主题网络图？

If theme-analysis.md exists, summarize it: "已读取主题分析，主题覆盖{N}个《指南》领域..."

Extract:
- **Theme**: the monthly theme
- **Age group**: determines language complexity and concept scope
- **Context**: any additional constraints or focus areas

## Step 2: Generate Candidate Questions

Generate **5 个候选驱动性问题**. Each must follow these rules:

### Driving Question Rules

| Rule | Description | Example (✅) | Counter-example (❌) |
|------|-------------|-------------|---------------------|
| 开放性 | 允许多种答案，没有唯一正确答案 | "如何开一家果汁店？" | "果汁是怎么做的？"（有标准答案） |
| 可探究性 | 儿童可以通过动手操作来探索 | "我们怎样让社区变得更好？" | "为什么要保护环境？"（太抽象） |
| 年龄适切 | 语言和概念匹配目标年龄段 | PreK-4: "我们怎么照顾小动物？" | PreK-3: "如何建立生态平衡？" |
| 多维度 | 能从多个角度展开探究 | "如何开一家果汁店？"（口味+制作+经营） | "怎么榨果汁？"（只有一个维度） |
| 与生活关联 | 连接儿童的日常经验 | "我的家人都做什么工作？" | "古代人如何生活？" |
| 行动导向 | 以"如何"、"怎样"、"我们能"开头 | "我们怎样帮助社区里的人？" | "社区有哪些人？"（信息收集型） |

### Age-Specific Language Guide

| Age Group | Question Complexity | Concept Scope | Example |
|-----------|-------------------|---------------|---------|
| PreK-3 (2-3岁) | 简单直接，5-8个字 | 围绕自身感受和体验 | "我喜欢吃什么？" |
| PreK-4 (3-4岁) | 中等，含"如何/怎样" | 可延伸到家庭和幼儿园 | "如何开一家果汁店？" |
| K (5-6岁) | 可稍复杂，含因果 | 可延伸到社区和社会 | "我们怎样让社区变得更好？" |

For each candidate, write in bilingual format:
- Chinese: 如何开一家果汁店？
- English: How to open a juice shop?

## Step 3: Score Candidates

For each of the 5 candidates, score on a 4-dimension matrix:

| Candidate | 开放性 (1-5) | 可探究性 (1-5) | 年龄适切 (1-5) | 多维度 (1-5) | Total |
|-----------|-----------|-----------|-----------|----------|-------|
| Q1: ... | | | | | /20 |
| Q2: ... | | | | | /20 |
| ... | | | | | |

**Scoring rubric:**

**开放性 (Openness)**:
- 5: 完全开放，可以有 10+ 种不同的探究方向
- 4: 比较开放，有 5-10 种探究方向
- 3: 中等，有 3-5 种探究方向
- 2: 较封闭，有 1-2 种主要路径
- 1: 封闭，基本只有一个正确答案

**可探究性 (Investigability)**:
- 5: 儿童可以通过多种方式动手探索（实验、调查、制作、扮演）
- 4: 有 2-3 种动手探索方式
- 3: 有 1-2 种动手方式，部分需要抽象讨论
- 2: 主要靠讨论和观察，动手机会少
- 1: 纯抽象讨论，无法动手探索

**年龄适切 (Age-Appropriateness)**:
- 5: 语言简洁，概念在该年龄段经验范围内
- 4: 语言合适，概念略需引导即可理解
- 3: 需要较多前置解释
- 2: 概念超出该年龄段日常经验
- 1: 概念过于抽象，不适合该年龄段

**多维度 (Multi-dimensionality)**:
- 5: 可展开 4+ 个独立探究维度
- 4: 可展开 3 个独立探究维度
- 3: 可展开 2 个探究维度
- 2: 只有 1 个主要维度
- 1: 单一维度，无法扩展

Select the candidate with the highest total score as the **recommended question**.

## Step 4: Expert Review

Use the Agent tool to have the `early-childhood-curriculum-expert` review the recommended question.

Give the expert subagent:
- The agent definition from `experts/early-childhood-curriculum-expert.md`
- The recommended driving question with its scores
- The monthly theme and age group
- The instruction: "Review this driving question for a PBL project. Evaluate: (1) Does it genuinely allow multi-dimensional inquiry, or is it superficially open? (2) Can children of this age actually investigate it through hands-on activities? (3) Does it connect naturally to the monthly theme? (4) Are there methodology concerns? Suggest improvements if needed."

Incorporate the expert's feedback. Common corrections:
- "This question looks open but actually constrains to one path — try rephrasing..."
- "The concept of 'X' is too abstract for this age — ground it in a concrete scenario"
- "Add a scenario frame to make it more tangible: instead of '如何...' try '如果我们要...'"

If the expert suggests significant changes, re-score the revised question.

## Step 5: Present to User

Present the recommended driving question with full context:

> **推荐的驱动性问题：**
>
> **{Chinese question}**
> **{English question}**
>
> | 维度 | 得分 | 说明 |
> |------|------|------|
> | 开放性 | {N}/5 | {rationale} |
> | 可探究性 | {N}/5 | {rationale} |
> | 年龄适切 | {N}/5 | {rationale} |
> | 多维度 | {N}/5 | {rationale} |
> | **总分** | **{N}/20** | |
>
> **专家评价**：{expert feedback summary}
>
> **可展开的探究维度**：
> 1. {dimension 1} — {brief description}
> 2. {dimension 2} — {brief description}
> 3. {dimension 3} — {brief description}
>
> **备选问题：**
> 1. {alternative 1} (得分 {N}/20)
> 2. {alternative 2} (得分 {N}/20)
>
> 确认使用推荐问题，还是选择备选问题，或者需要调整？

Wait for user confirmation. If the user wants changes, iterate on the question design.

## Step 6: Write Output

Once confirmed, create the workspace (if not exists) and write the output:

```
.workshop/projects/{workspace}/
└── driving-question.md
```

**Derive `{workspace}`** from the theme: lowercase, kebab-case, 2-3 words (e.g., "people-around-me", "juice-shop").

Write `driving-question.md`:

```markdown
# Driving Question: {Theme}

> Date: {YYYY-MM-DD}
> Age Group: {PreK-3 / PreK-4 / K}
> Theme: {monthly theme}

## Driving Question

**{Chinese question}**
**{English question}**

## Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| 开放性 | {N}/5 | {reason} |
| 可探究性 | {N}/5 | {reason} |
| 年龄适切 | {N}/5 | {reason} |
| 多维度 | {N}/5 | {reason} |
| **Total** | **{N}/20** | |

## Exploration Dimensions

1. **{Dimension 1}**: {description — what children can explore in this direction}
2. **{Dimension 2}**: {description}
3. **{Dimension 3}**: {description}
4. **{Dimension 4}** (if applicable): {description}

## Expert Review

{Expert name}: {feedback summary}

## Alternative Questions

1. {Alternative 1} — Score: {N}/20
2. {Alternative 2} — Score: {N}/20

## Connection to Theme

{How this driving question connects to the monthly theme and why it's meaningful for children}
```

Create or update `status.json`:

```json
{
  "type": "project",
  "project": "{workspace}",
  "theme": "{monthly theme}",
  "target_collection": "courses",
  "phase": "planning",
  "created_at": "{ISO-8601}",
  "plan_refs": {
    "semester": null,
    "month": null,
    "week": null
  },
  "skills": {
    "driving-question": "done"
  }
}
```

Tell the user: "Driving question confirmed. Run `/workshop-pbl:network-map {workspace}` to build the thematic network diagram."

## Out of Scope
- Does NOT split the driving question into inquiry clues (inquiry-scaffold's responsibility)
- Does NOT design activities
- Does NOT build the network map (network-map's responsibility)
