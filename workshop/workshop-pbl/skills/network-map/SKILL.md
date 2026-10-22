---
name: network-map
description: Build a thematic network diagram (mind map) from a driving question, showing sub-questions, exploration angles, and connections across learning domains. Use after a driving question is set, when planning the scope of a PBL project, or when someone says "help me build a topic web". Produces a structured network diagram.
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Network Map

Build a structured thematic network diagram that expands a driving question into sub-questions, exploration angles, and activity directions. The network map ensures the project covers multiple learning domains from《3-6岁儿童学习与发展指南》.

## Pre-check

1. Verify `.workshop/` exists.
2. Read `.workshop/projects/$ARGUMENTS/driving-question.md`. If missing, tell the user to run `/workshop-pbl:driving-question` first.
3. Read the driving question, age group, and exploration dimensions from the file.

## Step 1: Extract Exploration Dimensions

From `driving-question.md`, extract:
- The driving question (Chinese + English)
- The 3-4 exploration dimensions identified during question scoring
- The age group

These dimensions become the **primary branches** of the network map.

## Step 2: Generate Sub-Questions

For each exploration dimension, generate **2-4 sub-questions** that children might ask. Sub-questions must:

- Be phrased in language children of the target age would use
- Be answerable through hands-on exploration (not just discussion)
- Each cover a different facet of the dimension
- Be bilingual (Chinese + English)

**Example** (driving question: "如何开一家果汁店？"):

| Dimension | Sub-Questions |
|-----------|--------------|
| 口味选择 | 果汁店要做什么口味的果汁？/ What flavor does the juice store make? |
| | 大家最喜欢喝什么果汁？/ What juice do you like? |
| 制作方法 | 如何制作果汁？/ How to make juice? |
| | 怎样让果汁保持温暖？/ How to keep juice warm? |
| 经营管理 | 如何经营果汁店？/ How to run a juice shop? |
| | 怎样让果汁店赚钱？/ How to make a juice store profitable? |

## Step 3: Generate Leaf Nodes

For each sub-question, list **2-4 concrete exploration directions** (leaf nodes). These are specific activities or investigations children could do:

**Example** (sub-question: "大家最喜欢喝什么果汁？"):
- 问卷调查 / Questionnaire survey
- 品尝测试 / Taste test
- 投票统计 / Voting and counting

Leaf nodes should be:
- Action-oriented (verbs: 调查/制作/观察/比较/记录)
- Age-appropriate
- Feasible in a classroom setting

## Step 4: Annotate Learning Domains

Map each branch to《指南》五大领域:

| Domain | Icon | Examples of Coverage |
|--------|------|---------------------|
| 健康 Health | 🏥 | 营养知识、食品安全、卫生习惯 |
| 语言 Language | 📖 | 采访、讨论、分享、双语词汇 |
| 社会 Social | 👥 | 合作、分工、交易、社区角色 |
| 科学 Science | 🔬 | 实验、观察、测量、比较 |
| 艺术 Art | 🎨 | 海报设计、手工制作、歌曲、表演 |

Annotate each sub-question with its primary domain(s). Then check **coverage**:
- **Must cover**: ≥ 3 of 5 domains
- **Ideal**: 4-5 domains
- If coverage is insufficient, suggest additional sub-questions to fill gaps

## Step 5: Produce Network Diagram

Generate a text-based mind map:

```
                                    ┌─ {leaf 1}
                        ┌─ {sub-Q1} ┤
                        │           └─ {leaf 2}
            ┌─ {dim 1} ┤
            │           │           ┌─ {leaf 3}
            │           └─ {sub-Q2} ┤
            │                       └─ {leaf 4}
            │
{Driving Q} ┼─ {dim 2} ┬─ {sub-Q3} ── ...
            │           └─ {sub-Q4} ── ...
            │
            └─ {dim 3} ┬─ {sub-Q5} ── ...
                        └─ {sub-Q6} ── ...
```

Each node includes both Chinese and English labels where space permits.

## Step 6: Present and Validate

Present the network map to the user:

> **主题网络图：{Theme}**
>
> {text-based mind map}
>
> **《指南》领域覆盖：**
> - 健康: {✅ covered / ⚠️ weak / ❌ missing}
> - 语言: {✅ / ⚠️ / ❌}
> - 社会: {✅ / ⚠️ / ❌}
> - 科学: {✅ / ⚠️ / ❌}
> - 艺术: {✅ / ⚠️ / ❌}
>
> 共 {N} 个子问题，{M} 个探究方向。
> 是否需要增减分支？

## Step 7: Write Output

Write `.workshop/projects/{workspace}/network-map.md`:

```markdown
# Network Map: {Theme}

> Date: {YYYY-MM-DD}
> Driving Question: {question}
> Age Group: {age group}

## Network Diagram

{text-based mind map from Step 5}

## Sub-Questions by Dimension

### {Dimension 1}
| Sub-Question | Leaf Nodes | Domain |
|-------------|------------|--------|
| {sub-Q1, bilingual} | {leaf1}, {leaf2} | {domains} |
| {sub-Q2, bilingual} | {leaf3}, {leaf4} | {domains} |

### {Dimension 2}
...

## Domain Coverage

| Domain | Coverage | Sub-Questions |
|--------|----------|--------------|
| 健康 | {✅/⚠️/❌} | {list} |
| 语言 | {✅/⚠️/❌} | {list} |
| 社会 | {✅/⚠️/❌} | {list} |
| 科学 | {✅/⚠️/❌} | {list} |
| 艺术 | {✅/⚠️/❌} | {list} |

## Statistics
- Dimensions: {N}
- Sub-questions: {N}
- Leaf nodes: {N}
- Domain coverage: {N}/5
```

Update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-project-skill \
  {workspace} network-map \
  --phase planning
```

Tell the user: "Network map complete. Run `/workshop-pbl:inquiry-scaffold {workspace}` to split into 3 inquiry clues."

## Out of Scope
- Does NOT decide which sub-questions become inquiry clues (inquiry-scaffold's responsibility)
- Does NOT design activities
- Does NOT do graphical rendering (text diagram only)
