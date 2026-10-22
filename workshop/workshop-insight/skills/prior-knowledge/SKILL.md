---
name: prior-knowledge
description: Assess children's prior knowledge for a given theme and age group, covering cognitive, skill, and emotional dimensions. Use when planning learning goals, evaluating readiness, or when someone says "what do the children already know". Produces a structured prior knowledge assessment.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Prior Knowledge

Assess what children of a given age group typically already know, can do, and have experienced in relation to a monthly theme. Produces a three-dimensional assessment (cognitive, skill, emotional) with age-band differentiation, feeding into the "02 项目标准 Project Standards" section of the PBL proposal.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required expert**: Resolve `child-development-psychologist.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-insight/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-insight/agents/*.md`
5. **Match by relevance**: Select experts relevant to the monthly theme
6. **Skip template**: Do not load `_domain-expert-template.md`

The required expert verifies that the prior knowledge entries match developmental norms. Additional experts contribute theme-specific knowledge about what children typically experience.

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Determine the workspace path:
   - If `$ARGUMENTS` contains a workspace name, use `.workshop/projects/$ARGUMENTS/`
   - Otherwise, derive from the theme name (lowercase, kebab-case, 2-3 words)
3. Check for optional enrichment files:
   - `.workshop/projects/{workspace}/theme-analysis.md` — if present, read it to extract domain coverage and theme context
   - If theme-analysis.md exists, summarize: "已读取主题分析，主题覆盖{N}个《指南》领域，将基于此分析评估前期经验。"
4. Check if `.workshop/projects/{workspace}/prior-knowledge.md` already exists:
   - If yes, read it and ask: "已有前期经验评估文档，是否需要重新生成或在此基础上修改？"

## Step 1: Gather Context

Ask the user for:

> **请提供以下信息：**
> 1. **月度主题**：本月的项目主题是什么？（如"我周围的人"、"交通工具"、"春天来了"）
> 2. **年龄段**：PreK-3 (2-3岁) / PreK-4 (3-4岁) / K (5-6岁)
> 3. **补充信息**（可选）：幼儿是否有特殊的已有经验？（如之前做过相关主题、所在地区有特殊资源等）

Extract:
- **Theme**: the monthly theme (Chinese + English)
- **Age group**: determines developmental baseline
- **Context**: any class-specific prior experiences or regional factors

## Step 2: Identify Key Concepts for the Theme

Before assessing prior knowledge, decompose the theme into **5-8 key concept clusters** that children might have prior experience with.

### Concept Decomposition Example

For theme "果汁 / Juice":
1. 水果种类 (types of fruit)
2. 味觉体验 (taste experience)
3. 液体变化 (liquid transformation)
4. 工具使用 (tool use — squeezing, pouring)
5. 健康饮食 (healthy eating habits)
6. 分享行为 (sharing behavior)

These concept clusters guide the three-dimensional assessment — each dimension draws from these clusters.

## Step 3: Assess Three Dimensions

For each dimension, generate **numbered entries** describing what children of the target age group typically already know/can do/feel. Each entry must be bilingual (Chinese primary, English secondary).

### Dimension 1: 认知 Cognitive

What concepts, facts, or understandings children typically have.

**Assessment questions to consider:**
- What direct experiences has a child of this age likely had with this topic?
- What vocabulary do they already have?
- What misconceptions are common at this age?
- What can they name, categorize, or describe?

**Entry format:**
```
1. 能认出并说出3-5种常见水果的名称
   Can recognize and name 3-5 common fruits
2. 知道水果可以吃，但不清楚水果还能"变成"其他东西
   Know that fruit can be eaten, but unclear that fruit can be "transformed" into other things
```

**Entry writing rules:**
- Start with a verb: 能/会/知道/认识/了解/有...概念
- Be specific: ❌ "对水果有一定的认知" → ✅ "能认出并说出3-5种常见水果的名称"
- Include common **misconceptions** or knowledge gaps as entries (framed as "不清楚/尚未理解/容易混淆")
- Target **5-8 entries** per dimension

### Dimension 2: 技能 Skills

What physical, social, or practical skills children can already perform.

**Assessment questions to consider:**
- What fine/gross motor skills relevant to this theme can they do?
- What social skills (sharing, turn-taking, cooperation) are established?
- What self-care or daily living skills are relevant?
- What tools can they already use?

**Entry format:**
```
1. 能用手剥开橘子皮（大块撕扯，非精细剥离）
   Can peel an orange by hand (rough tearing, not fine peeling)
2. 能用简单语言表达自己喜欢或不喜欢某种食物
   Can use simple language to express food preferences
```

**Entry writing rules:**
- Start with a skill verb: 能/会/可以/已经学会
- Specify the **quality level** in parentheses when relevant: (大块撕扯，非精细剥离)
- Distinguish between "can do independently" and "can do with help"
- Target **5-8 entries** per dimension

### Dimension 3: 情感 Emotional

What feelings, attitudes, interests, and dispositions children already have.

**Assessment questions to consider:**
- What intrinsic interest or curiosity does this theme naturally evoke?
- What positive or negative associations might children have?
- What social-emotional experiences are relevant (empathy, pride, frustration)?
- What attitudes toward learning/exploration are typical?

**Entry format:**
```
1. 对甜味食物有天然的偏好和积极情感
   Have a natural preference and positive feelings toward sweet foods
2. 对"做给别人吃"有分享的愿望，但实际操作中容易因为"舍不得"而犹豫
   Want to share food with others, but may hesitate in practice due to reluctance to give things away
```

**Entry writing rules:**
- Start with an emotional/attitudinal phrase: 对...有兴趣/感到好奇/喜欢/愿意/倾向于
- Include **mixed feelings** — children's emotions are rarely uniformly positive
- Note **typical frustration points** relevant to the theme
- Target **4-6 entries** per dimension

## Step 4: Age-Band Differentiation

After completing the assessment for the target age group, add a **comparative table** showing how prior knowledge differs across age bands. This helps the curriculum director understand the developmental progression and calibrate expectations.

### Age-Band Comparison Format

```markdown
## Age-Band Differences / 年龄段差异

| 维度 Dimension | PreK-3 (2-3岁) | PreK-4 (3-4岁) | K (5-6岁) |
|---------------|----------------|----------------|-----------|
| 认知 Cognitive | {brief summary} | {brief summary} | {brief summary} |
| 技能 Skills | {brief summary} | {brief summary} | {brief summary} |
| 情感 Emotional | {brief summary} | {brief summary} | {brief summary} |
```

### Age-Band Differentiation Rules

| Dimension | Younger (PreK-3) Typical | Middle (PreK-4) Typical | Older (K) Typical |
|-----------|-------------------------|------------------------|-------------------|
| Cognitive | Sensory-based recognition; names things | Begins categorization; asks "why" | Compares, reasons about cause-effect |
| Skills | Gross motor dominant; needs help | Fine motor emerging; semi-independent | Fine motor competent; can plan steps |
| Emotional | Self-centered; immediate feelings | Begins empathy; can wait briefly | Can articulate feelings; considers others |

**Important**: Only elaborate on the target age group's entries. The comparison table provides brief summaries for the other age bands — 1-2 sentences per cell, not full entry lists.

## Step 5: Expert Review

Use the Agent tool to have the `child-development-psychologist` review the complete assessment.

Give the expert subagent:
- The agent definition from `experts/child-development-psychologist.md`
- The full three-dimensional assessment with all entries
- The age-band comparison table
- The monthly theme and target age group
- The instruction: "Review this prior knowledge assessment for developmental accuracy. Check: (1) Are the cognitive entries realistic for this age — not over- or under-estimating? (2) Are the skill entries specific enough about quality levels? (3) Do the emotional entries reflect real child psychology, not adult projections? (4) Are the age-band differences accurately characterized? (5) Are there important prior experiences that were missed? (6) Are any common misconceptions omitted? Suggest specific corrections."

If additional domain experts were loaded, also ask them to verify domain-specific entries. For example, a nutrition expert could verify whether "children know that fruit is healthy" is a realistic expectation for the target age.

### Common Expert Corrections

- "3-year-olds cannot categorize fruits by color — they can recognize colors but don't spontaneously sort by them"
- "This skill entry assumes fine motor ability beyond the norm — 3-year-olds cannot use scissors along a line"
- "The emotional entry projects adult attitudes — children don't 'value healthy eating', they just like or dislike specific foods"
- "Missing: children at this age often have fear/anxiety about [X] — this is a relevant emotional baseline"
- "The misconception about [X] is actually more common in older children, not this age group"

Incorporate expert feedback before presenting to the user.

## Step 6: Present to User

Present the complete assessment:

> **前期经验评估：{Theme Chinese} / {Theme English}**
> **年龄段：{Age Group}**
>
> ---
>
> **认知维度 Cognitive Dimension**
>
> 1. {entry 1 — Chinese}
>    {entry 1 — English}
> 2. {entry 2 — Chinese}
>    {entry 2 — English}
> {... more entries ...}
>
> ---
>
> **技能维度 Skills Dimension**
>
> 1. {entry 1 — Chinese}
>    {entry 1 — English}
> {... more entries ...}
>
> ---
>
> **情感维度 Emotional Dimension**
>
> 1. {entry 1 — Chinese}
>    {entry 1 — English}
> {... more entries ...}
>
> ---
>
> **年龄段差异 Age-Band Differences**
>
> | 维度 | PreK-3 | PreK-4 | K |
> |------|--------|--------|---|
> | 认知 | ... | ... | ... |
> | 技能 | ... | ... | ... |
> | 情感 | ... | ... | ... |
>
> ---
>
> **专家评价**: {expert feedback summary}
>
> 请确认评估内容，或指出需要修改的部分。

Wait for user confirmation. If the user wants changes, iterate.

## Step 7: Write Output

Once confirmed, create the workspace (if not exists) and write:

```
.workshop/projects/{workspace}/
└── prior-knowledge.md
```

Write `prior-knowledge.md`:

```markdown
# Prior Knowledge: {Theme Chinese} / {Theme English}

> Date: {YYYY-MM-DD}
> Age Group: {PreK-3 / PreK-4 / K}
> Theme: {Theme Chinese} / {Theme English}

## Key Concepts / 关键概念

1. {concept cluster 1}
2. {concept cluster 2}
{... 5-8 clusters ...}

## Cognitive Dimension / 认知维度

1. {Chinese entry}
   {English entry}
2. {Chinese entry}
   {English entry}
{... 5-8 entries ...}

## Skills Dimension / 技能维度

1. {Chinese entry}
   {English entry}
2. {Chinese entry}
   {English entry}
{... 5-8 entries ...}

## Emotional Dimension / 情感维度

1. {Chinese entry}
   {English entry}
2. {Chinese entry}
   {English entry}
{... 4-6 entries ...}

## Age-Band Differences / 年龄段差异

| 维度 Dimension | PreK-3 (2-3岁) | PreK-4 (3-4岁) | K (5-6岁) |
|---------------|----------------|----------------|-----------|
| 认知 Cognitive | {summary} | {summary} | {summary} |
| 技能 Skills | {summary} | {summary} | {summary} |
| 情感 Emotional | {summary} | {summary} | {summary} |

## Expert Review / 专家评审

- **{Expert name}**: {feedback summary and any adjustments made}

## Notes

- This assessment feeds into the "02 项目标准 Project Standards" section of the PBL proposal
- Entries inform learning goal design — goals should bridge FROM prior knowledge TO new understanding
- Misconceptions flagged here should be addressed in activity design
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
    "prior-knowledge": "done"
  }
}
```

If `theme-analysis` is already marked "done" in status.json, preserve it:
```json
{
  "skills": {
    "theme-analysis": "done",
    "prior-knowledge": "done"
  }
}
```

Tell the user: "前期经验评估完成。建议接下来运行 `/workshop-insight:competency-mapping {workspace}` 进行4C能力映射和学习目标设计。"

## Validation Rules

Before finalizing output, verify:

1. **Entry count**: Cognitive 5-8, Skills 5-8, Emotional 4-6 entries
2. **Bilingual completeness**: Every Chinese entry has an English counterpart
3. **Numbered format**: All entries are sequentially numbered within each dimension
4. **Specificity**: No vague entries like "对主题有一定了解" — every entry describes a concrete, observable knowledge/skill/feeling
5. **Includes misconceptions**: At least 1-2 entries per dimension note what children do NOT yet know or commonly misunderstand
6. **Age-appropriate**: Entries match developmental norms for the target age group
7. **Age-band table filled**: All 9 cells in the comparison table have content
8. **Verb starters**: Cognitive entries start with 能/会/知道/认识; Skill entries start with 能/会/可以; Emotional entries start with 对...有/感到/喜欢/愿意

## Out of Scope

- Does NOT set learning goals (competency-mapping's responsibility)
- Does NOT design driving questions (workshop-pbl's responsibility)
- Does NOT validate against curriculum standards (theme-analysis handles standards)
- Does NOT design assessment methods (workshop-quality's responsibility)
