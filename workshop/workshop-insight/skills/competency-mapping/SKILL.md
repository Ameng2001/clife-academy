---
name: competency-mapping
description: Map 4C competencies (Creativity, Critical Thinking, Communication, Collaboration) to the monthly theme and generate age-appropriate learning goals. Use when setting project standards, when someone says "map the 4C skills", or when learning goals are needed. Produces a 4C mapping table and learning goals.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Competency Mapping

Map 4C competencies (Creativity, Critical Thinking, Communication, Collaboration) to a monthly theme and generate age-appropriate, observable learning goals. Ensures 4C skills are correctly defined — not superficially labeled — and that learning goal verbs match developmental stages. Feeds into the "02 项目标准 Project Standards" section of the PBL proposal.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required expert**: Resolve `child-development-psychologist.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-insight/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-insight/agents/*.md`
5. **Match by relevance**: Select experts relevant to the monthly theme
6. **Skip template**: Do not load `_domain-expert-template.md`

The required expert verifies that 4C definitions and learning goals are developmentally appropriate. Additional experts contribute theme-specific behavioral examples.

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Determine the workspace path:
   - If `$ARGUMENTS` contains a workspace name, use `.workshop/projects/$ARGUMENTS/`
   - Otherwise, derive from the theme name (lowercase, kebab-case, 2-3 words)
3. Check for enrichment files (read if present):
   - `.workshop/projects/{workspace}/prior-knowledge.md` — prior knowledge assessment
   - `.workshop/projects/{workspace}/theme-analysis.md` — theme background and domain coverage
   - If prior-knowledge.md exists, summarize: "已读取前期经验评估，将基于幼儿现有水平设计学习目标。"
   - If theme-analysis.md exists, summarize: "已读取主题分析，将参考《指南》领域覆盖设计能力映射。"
4. Check if `.workshop/projects/{workspace}/competency-mapping.md` already exists:
   - If yes, read it and ask: "已有4C能力映射文档，是否需要重新生成或在此基础上修改？"

## Step 1: Gather Context

Ask the user for:

> **请提供以下信息：**
> 1. **月度主题**：本月的项目主题是什么？（如"我周围的人"、"交通工具"、"春天来了"）
> 2. **年龄段**：PreK-3 (2-3岁) / PreK-4 (3-4岁) / K (5-6岁)
> 3. **补充信息**（可选）：是否有特定的4C侧重方向？项目是否有特别强调的能力目标？

If prior-knowledge.md and/or theme-analysis.md were read, skip redundant questions — extract theme and age group from those files.

Extract:
- **Theme**: the monthly theme (Chinese + English)
- **Age group**: determines verb selection and behavioral expectations
- **Prior knowledge baseline**: from prior-knowledge.md if available
- **Domain coverage**: from theme-analysis.md if available
- **4C emphasis**: any user-specified priority skills

## Step 2: Map 4C Skills to Theme

For each of the 4C skills, define **2-3 concrete behavioral manifestations** specific to THIS theme and THIS age group. These are NOT generic definitions — they describe what the 4C skill looks like when a child of this age explores this particular theme.

### 4C Skill Definitions for Early Childhood

| Skill | Chinese | Core Meaning for Ages 2-6 |
|-------|---------|--------------------------|
| Creativity | 创造力 | 用新颖的方式组合、表达、或解决问题；不是"做手工"本身，而是"用自己的方式做" |
| Critical Thinking | 批判性思维 | 观察、比较、质疑、做出有依据的判断；不是"回答问题"，而是"提出问题"和"想为什么" |
| Communication | 沟通力 | 用语言、肢体、符号表达自己的想法并倾听他人；不是"说话"本身，而是"让别人理解"和"理解别人" |
| Collaboration | 协作力 | 与他人共同完成一个目标，分工、轮流、协商；不是"在一起活动"，而是"一起做成一件事" |

### Behavioral Manifestation Table Format

For each 4C skill, write 2-3 concrete behaviors:

```markdown
| 4C能力 | 行为表现 Behavioral Manifestation | 主题情境举例 Theme Example |
|--------|--------------------------------|-------------------------|
| 创造力 Creativity | {what it looks like — Chinese} / {English} | {concrete scenario from this theme} |
| | {second behavior} | {scenario} |
| 批判性思维 Critical Thinking | {behavior} | {scenario} |
| | {second behavior} | {scenario} |
| 沟通力 Communication | {behavior} | {scenario} |
| | {second behavior} | {scenario} |
| 协作力 Collaboration | {behavior} | {scenario} |
| | {second behavior} | {scenario} |
```

### Age-Specific Behavioral Expectations

| 4C Skill | PreK-3 (2-3岁) | PreK-4 (3-4岁) | K (5-6岁) |
|----------|----------------|----------------|-----------|
| Creativity | 尝试用不同方式做同一件事 | 能想出"不一样的办法" | 能组合多种材料/想法创造新东西 |
| Critical Thinking | 注意到"不一样" | 能比较两个事物并说出区别 | 能提出"为什么"并尝试验证 |
| Communication | 用简单词语+手势表达 | 能用完整句子描述经历 | 能有逻辑地讲述过程，能倾听并回应他人 |
| Collaboration | 平行游戏中注意同伴 | 能轮流、简单分工 | 能协商角色分配、共同计划 |

### Common 4C Mapping Errors to Flag

These are frequent mistakes in PBL course design. If any appear in the mapping, flag and correct them:

| Misclassification | Why It's Wrong | Correct Classification |
|-------------------|---------------|----------------------|
| 制作手工 = Critical Thinking | 按步骤制作不涉及质疑或判断 | Usually **Creativity** (if child designs) or just a motor skill |
| 小组讨论 = Collaboration | 同时说话不等于协作完成任务 | Usually **Communication** (expressing and listening) |
| 回答教师提问 = Critical Thinking | 回忆性问答不是批判性思维 | Communication (at best); redesign question to require comparison/judgment |
| 一起唱歌 = Collaboration | 同步活动不是协作 | Not a 4C activity — it's group participation |
| 画画 = Creativity | 照教师范画画不是创造 | Creativity only if child chooses subject/style/materials independently |
| 分享玩具 = Collaboration | 分享是社交技能，不等于协作完成目标 | Social skill (related but not 4C Collaboration) |

When flagging an error, use this format:

> ⚠️ **映射提醒**: "{activity}" 被标记为 {incorrect 4C skill}，但更准确的分类是 {correct skill}。原因：{explanation}。

## Step 3: Generate Learning Goals

Generate **6-10 numbered learning goals** using age-appropriate verbs. Learning goals describe what children will be able to do/understand/feel BY THE END of the project that they could not do before.

### Age-Appropriate Verb Guide

| Age Group | Recommended Verbs | Avoid |
|-----------|------------------|-------|
| PreK-3 (2-3岁) | 感受、尝试、体验、认识、愿意、喜欢 | 理解、分析、比较、评价 |
| PreK-4 (3-4岁) | 认识、了解、能够、知道、学会、愿意 | 深入理解、系统分析、独立评价 |
| K (5-6岁) | 理解、比较、分析、能够、学会、尝试解释 | 掌握、精通、全面理解 |

### Learning Goal Format

Each goal must be:
- **Numbered** sequentially
- **Bilingual** (Chinese primary, English secondary)
- **Tagged** with the primary 4C skill it develops
- **Observable**: describes a behavior that can be seen or heard, not an internal state

```
1. [创造力] 能够用至少2种不同方式表达对主题的理解（如绘画、搭建、表演）
   [Creativity] Can express understanding of the theme in at least 2 different ways (e.g., drawing, building, acting)
2. [批判性思维] 能够比较两种{theme-related items}并说出它们的不同
   [Critical Thinking] Can compare two {theme-related items} and describe their differences
```

### Learning Goal Writing Rules

| Rule | Good Example (✅) | Bad Example (❌) |
|------|------------------|-----------------|
| Observable behavior | "能用完整句子描述果汁的制作过程" | "理解果汁制作" |
| Specific to theme | "能说出至少3种水果的名称和颜色" | "认识更多事物" |
| Age-appropriate verb | (PreK-4) "能够" / "了解" | (PreK-3) "分析" / "理解" |
| Bridges from prior knowledge | "从认出水果 → 能说出水果生长的地方" | Goals that repeat what children already know |
| Each goal tagged with 4C | "[沟通力] 能向同伴描述..." | No 4C tag |

### Goal Distribution Check

Ensure learning goals cover all 4 skills:
- Each 4C skill should have **at least 1 goal** tagged to it
- No single 4C skill should have more than **40%** of all goals
- If prior-knowledge.md is available, ensure goals bridge FROM prior knowledge TO new understanding

## Step 4: Build the Bridging Analysis

If prior-knowledge.md was read, create a bridging table showing how learning goals connect to prior knowledge:

```markdown
## Prior Knowledge → Learning Goal Bridge / 前期经验到学习目标的桥接

| 前期经验 Prior Knowledge | 学习目标 Learning Goal | 发展跨度 Development Span |
|-------------------------|----------------------|------------------------|
| 能认出3-5种水果 | → 能说出水果生长的地方 | 从识别到因果理解 |
| 能用手剥橘子 | → 能使用简单工具榨果汁 | 从徒手到工具使用 |
| 对甜味有偏好 | → 愿意尝试不同口味的果汁 | 从偏好固化到开放体验 |
```

This table is optional (only generated when prior-knowledge.md exists) but highly valuable — it shows the curriculum director that goals are grounded in children's actual starting point.

## Step 5: Expert Review

Use the Agent tool to have the `child-development-psychologist` review the complete mapping.

Give the expert subagent:
- The agent definition from `experts/child-development-psychologist.md`
- The 4C behavioral manifestation table
- The learning goals list with 4C tags
- The bridging table (if generated)
- The monthly theme and target age group
- The instruction: "Review this 4C competency mapping and learning goals for a PBL project. Check: (1) Are the 4C behavioral manifestations correctly classified — flag any misclassifications per the common error list? (2) Are the learning goals observable and age-appropriate? (3) Are the verb choices correct for this age group? (4) Does each 4C skill have adequate goal coverage? (5) If a bridging table is present, is the development span realistic — not too small (trivial) or too large (unreachable in one project)? (6) Are there important competency dimensions missing for this theme? Suggest specific corrections."

### Common Expert Corrections

- "Goal 3 uses '理解' but the target is PreK-3 — change to '感受' or '体验'"
- "The Collaboration manifestation describes parallel play, not true collaboration — children need a shared goal"
- "Goal 7 is not observable — 'appreciate' is internal. Rephrase to an observable behavior: 'voluntarily choose to...'"
- "The bridging span for entry 4 is too large — a PreK-3 child cannot go from 'no concept of X' to 'can explain X' in one month"
- "Missing: no Communication goal addresses listening — only speaking goals are listed"

Incorporate expert feedback before presenting to the user.

## Step 6: Present to User

Present the complete competency mapping:

> **4C能力映射与学习目标：{Theme Chinese} / {Theme English}**
> **年龄段：{Age Group}**
>
> ---
>
> **4C行为表现映射 4C Behavioral Manifestation Table**
>
> | 4C能力 | 行为表现 | 主题情境举例 |
> |--------|---------|------------|
> | 创造力 | ... | ... |
> | ... | ... | ... |
>
> ---
>
> **学习目标 Learning Goals**
>
> 1. [{4C tag}] {Chinese goal}
>    {English goal}
> 2. [{4C tag}] {Chinese goal}
>    {English goal}
> {... 6-10 goals ...}
>
> **目标分布 Goal Distribution**:
> - 创造力: {N} 个目标
> - 批判性思维: {N} 个目标
> - 沟通力: {N} 个目标
> - 协作力: {N} 个目标
>
> ---
>
> **前期经验桥接 Prior Knowledge Bridge** (if available)
>
> | 前期经验 | 学习目标 | 发展跨度 |
> |---------|---------|---------|
> | ... | ... | ... |
>
> ---
>
> ⚠️ **映射提醒** (if any flags):
> {list of flagged misclassifications}
>
> ---
>
> **专家评价**: {expert feedback summary}
>
> 请确认能力映射和学习目标，或指出需要修改的部分。

Wait for user confirmation. If the user wants changes, iterate.

## Step 7: Write Output

Once confirmed, create the workspace (if not exists) and write:

```
.workshop/projects/{workspace}/
└── competency-mapping.md
```

Write `competency-mapping.md`:

```markdown
# Competency Mapping: {Theme Chinese} / {Theme English}

> Date: {YYYY-MM-DD}
> Age Group: {PreK-3 / PreK-4 / K}
> Theme: {Theme Chinese} / {Theme English}

## 4C Behavioral Manifestation / 4C行为表现映射

| 4C能力 Competency | 行为表现 Behavioral Manifestation | 主题情境举例 Theme Example |
|-------------------|--------------------------------|-------------------------|
| 创造力 Creativity | {behavior CN} / {behavior EN} | {scenario} |
| | {behavior 2} | {scenario} |
| 批判性思维 Critical Thinking | {behavior} | {scenario} |
| | {behavior 2} | {scenario} |
| 沟通力 Communication | {behavior} | {scenario} |
| | {behavior 2} | {scenario} |
| 协作力 Collaboration | {behavior} | {scenario} |
| | {behavior 2} | {scenario} |

## Learning Goals / 学习目标

1. [{4C tag}] {Chinese goal}
   {English goal}
2. [{4C tag}] {Chinese goal}
   {English goal}
{... 6-10 goals ...}

### Goal Distribution / 目标分布

| 4C Competency | Goal Count | Goal Numbers |
|--------------|------------|-------------|
| 创造力 Creativity | {N} | #{list} |
| 批判性思维 Critical Thinking | {N} | #{list} |
| 沟通力 Communication | {N} | #{list} |
| 协作力 Collaboration | {N} | #{list} |

## Age-Appropriate Verb Reference / 年龄适切动词参考

| Verb Used | Age Appropriateness | Notes |
|-----------|-------------------|-------|
| {verb} | ✅ appropriate for {age group} | |
| {verb} | ✅ | |

## Prior Knowledge Bridge / 前期经验桥接

{Include this section only if prior-knowledge.md was available}

| 前期经验 Prior Knowledge | 学习目标 Learning Goal | 发展跨度 Development Span |
|-------------------------|----------------------|------------------------|
| {prior entry} | → {goal} | {span description} |

## Mapping Alerts / 映射提醒

{List any flagged misclassification warnings, or "No alerts — all mappings verified."}

## Expert Review / 专家评审

- **{Expert name}**: {feedback summary and any adjustments made}

## Notes

- This mapping feeds into the "02 项目标准 Project Standards" section of the PBL proposal
- Learning goals tagged with 4C skills guide activity design — each activity should develop at least one tagged goal
- The behavioral manifestation table helps teachers observe and assess 4C development during activities
```

Create or update `status.json`:

```json
{
  "type": "project",
  "project": "{workspace}",
  "theme": "{Theme Chinese} / {Theme English}",
  "target_collection": "courses",
  "phase": "planning",
  "created_at": "{ISO-8601}",
  "plan_refs": {
    "semester": null,
    "month": null,
    "week": null
  },
  "skills": {
    "competency-mapping": "done"
  }
}
```

If other insight skills are already marked "done" in status.json, preserve them:
```json
{
  "skills": {
    "theme-analysis": "done",
    "prior-knowledge": "done",
    "competency-mapping": "done"
  }
}
```

Tell the user: "4C能力映射和学习目标设计完成。所有 workshop-insight 分析已完成。建议接下来运行 `/workshop-pbl:driving-question {workspace}` 设计驱动性问题。"

## Validation Rules

Before finalizing output, verify:

1. **4C completeness**: All 4 skills have 2-3 behavioral manifestations each
2. **No misclassifications**: Cross-check against the common error list — flag any matches
3. **Goal count**: 6-10 learning goals total
4. **Goal distribution**: Each 4C skill has at least 1 goal; no skill exceeds 40% of total
5. **Verb appropriateness**: All verbs match the age-appropriate verb guide
6. **Observable goals**: Every goal describes a behavior that can be seen or heard
7. **Bilingual completeness**: Every entry and goal has Chinese + English
8. **Numbered format**: Goals are sequentially numbered
9. **4C tags present**: Every goal is tagged with its primary 4C skill in square brackets
10. **Bridging coherence**: If bridging table exists, every bridge shows a realistic development span

## Out of Scope

- Does NOT design driving questions (workshop-pbl's responsibility)
- Does NOT design activities (activity-design's responsibility)
- Does NOT validate resource availability (workshop-resource's responsibility)
- Does NOT check overall proposal quality (workshop-quality's responsibility)
