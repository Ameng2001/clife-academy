---
name: activity-design
description: Design a complete activity sequence for one inquiry clue — activities with key questions, coded names (PBL-Cx-y), step-by-step content, teacher tips, and resource annotations. Use after inquiry clues are defined, when the curriculum director needs to flesh out activities, or when someone says "help me design the activities". Produces a structured activity table.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Activity Design

Design a complete activity sequence for one or all inquiry clues. Each activity is a 20-30 minute classroom session following the华美 PBL activity table format: Key Question × Activity Name (coded) × Content (numbered steps) × Resources.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required expert**: Resolve `instructional-designer.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-pbl/agents/`
2. **Required expert**: Resolve `child-development-psychologist.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-pbl/agents/*.md`
6. **Match by relevance**: Select additional experts relevant to the theme

## Pre-check

1. Verify `.workshop/` exists.
2. Parse `$ARGUMENTS`: expect `{workspace}` or `{workspace} {clue-number|all}`
   - If clue number specified (1, 2, or 3): design that single clue
   - If "all" or no clue number: design all 3 clues in sequence
3. Read `.workshop/projects/{workspace}/inquiry-clues.md` — required. If missing, tell the user to run `/workshop-pbl:inquiry-scaffold` first.
4. Read `.workshop/projects/{workspace}/network-map.md` — optional, for additional context.
5. Read `.workshop/projects/{workspace}/driving-question.md` — for overall project context.

## Step 1: Plan Activity Count

For each clue, determine the number of activities based on:
- **Duration budget**: clue duration (from inquiry-clues.md) × 1 activity per day = 3-5 activities
- **Sub-questions covered**: each sub-question may need 1-2 activities
- **Learning goals**: ensure every goal is addressed by at least 1 activity

Present the plan:

> **Clue {N} 活动规划：**
> - 建议时长：{N} 天
> - 建议活动数：{N} 个
> - 覆盖子问题：{list}
> - 覆盖学习目标：{list}

## Step 2: Design Each Activity

For each activity, produce a complete activity row following this structure:

### Activity Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Activity Code: PBL-C{clue}-{seq}                                │
│ Activity Name: {Chinese name} / {English name}                  │
├──────────────────────────────────────────────────────────────────┤
│ Key Question: {the question this activity addresses}            │
├──────────────────────────────────────────────────────────────────┤
│ Content:                                                        │
│ 1. {Step 1 — concrete teacher action + expected child response} │
│ 2. {Step 2}                                                     │
│ 3. {Step 3}                                                     │
│ 4. {Step 4 — usually wrap-up/reflection}                        │
│                                                                 │
│ Tips: {practical advice for the teacher}                        │
├──────────────────────────────────────────────────────────────────┤
│ Resources:                                                      │
│ • PBL Box: {items from centralized supply}                      │
│ • My Journal: {worksheet/journal pages}                         │
│ • Teacher's Supplies: {items teacher prepares locally}          │
│ • Media: {videos, songs, images}                                │
└──────────────────────────────────────────────────────────────────┘
```

### Activity Coding Convention

- Format: `PBL-C{clue_number}-{sequence_number}`
- Clue number: 1, 2, or 3
- Sequence: 01, 02, 03... (two digits, zero-padded)
- Example: PBL-C1-01, PBL-C1-02, PBL-C2-01
- **No gaps** in sequence within a clue
- Numbering **resets** with each new clue

### Content Writing Rules

Each activity must have **3-4 numbered steps**. Each step includes:
- **Teacher action**: what the teacher does or says (具体的话术或动作)
- **Child response**: what children are expected to do

**Step patterns by activity type:**

| Activity Type | Step 1 | Step 2 | Step 3 | Step 4 |
|--------------|--------|--------|--------|--------|
| 讨论型 | 教师提问引导 | 幼儿自由讨论 | 教师总结归纳 | 延伸活动 |
| 调查型 | 教师介绍调查方法 | 幼儿实施调查 | 幼儿分享结果 | 讨论发现 |
| 制作型 | 教师展示材料/示范 | 幼儿动手制作 | 作品展示 | 同伴互评 |
| 实验型 | 教师提出问题 | 幼儿操作实验 | 记录结果 | 讨论原因 |
| 扮演型 | 情境设定 | 角色分配 | 扮演活动 | 反思讨论 |

### Teacher Tips Rules

Every activity must have **at least 1 tip**. Tips should address:
- 最常见的失败场景 (e.g., "如果孩子注意力分散，可以...")
- 材料替代方案 (e.g., "如果不能邀请厨师，可以播放视频替代")
- 差异化建议 (e.g., "对于较小的孩子，可以由教师协助完成")
- 安全提醒 (if applicable, e.g., "注意防烫")

Format: `提示：{tip content}` or `Tips: {tip content}`

### Resource Annotation Rules

For each activity, list resources in 4 categories:
- **PBL Box (项目盒)**: centrally supplied materials — list specific items
- **My Journal / 探索足迹袋**: child's personal journal pages — name the specific worksheet
- **Teacher's Supplies / 自备材料**: locally prepared — list with quantities
- **Media / 多媒体**: videos, songs, images — name specific titles if possible

**Resource specificity rules:**
- ❌ "水果" → ✅ "苹果 × 5个、橙子 × 5个（按班级人数调整）"
- ❌ "材料" → ✅ "彩色皱纹纸、剪刀、胶水"
- ❌ "视频" → ✅ "12 Healthy Smoothies 视频"

## Step 3: Duration Check

Estimate each activity's duration:
- Count the steps
- Assess complexity of each step for the target age
- Apply rough formula: `steps × 5-8 minutes` (for PreK-4)

| Age Group | Minutes per Step | Target Total |
|-----------|-----------------|-------------|
| PreK-3 | 5-6 min | 15-20 min |
| PreK-4 | 6-8 min | 20-30 min |
| K | 7-10 min | 25-35 min |

If an activity exceeds the target:
- Split into 2 activities (e.g., "果汁保温实验" → "探索保温材料" + "保温测试与记录")
- Or remove a step if it's not essential

## Step 4: Sequence Check

Verify the activity sequence within each clue:
- **Logical progression**: each activity builds on the previous
- **Knowledge dependency**: later activities assume knowledge from earlier ones
- **Variety**: mix activity types (讨论→调查→制作→实验) to maintain engagement
- **End on a high**: the last activity in each clue should be a satisfying culmination

## Step 5: Goal Coverage Check

Cross-check: every learning goal from `inquiry-clues.md` must be addressed by at least 1 activity.

> **Goal Coverage:**
> | Learning Goal | Covered By | Status |
> |--------------|-----------|--------|
> | {goal 1} | PBL-C{N}-{M} | ✅ |
> | {goal 2} | PBL-C{N}-{M}, PBL-C{N}-{M} | ✅ |
> | {goal 3} | — | ❌ need to add |

If a goal is uncovered, add an activity or modify an existing one.

## Step 6: Expert Review

Use the Agent tool to run two expert reviews:

**Expert 1: instructional-designer**
- Instruction: "Review these activities for classroom feasibility. Check: (1) Is each activity completable in 20-30 min? (2) Are the content steps specific enough for a teacher to follow? (3) Are resource lists complete and categorized? (4) Are teacher tips addressing real failure modes? (5) Is the activity sequence logical?"

**Expert 2: child-development-psychologist**
- Instruction: "Review these activities for age-appropriateness. Check: (1) Can children of this age actually do what's described? (2) Are there fine motor, cognitive, or social demands that exceed developmental norms? (3) Is there enough variety to maintain engagement?"

Incorporate corrections before presenting to the user.

## Step 7: Present and Validate

Present the complete activity table for the clue(s). Ask:
- "活动数量和内容是否合适？"
- "是否有需要增减或调整的活动？"
- "教师提示是否覆盖了你知道的常见问题？"

## Step 8: Write Output

For each clue, write `.workshop/projects/{workspace}/activities/clue-{N}.md`:

```markdown
# Clue {N}: {Key Question Chinese}
{Key Question English}

> Success Skills: {4C skills}
> Learning Goals:
> 1. {goal 1}
> 2. {goal 2}
> Keywords: {keyword list}

## Activities

| Key Question | Activity | Content | Resources |
|-------------|----------|---------|-----------|
| {question} | PBL-C{N}-01 {name CN} / {name EN} | 1. {step1} 2. {step2} 3. {step3} | • PBL Box: {items} • My Journal: {items} |
| | PBL-C{N}-02 {name} | 1. ... | ... |
| ... | ... | ... | ... |

## Goal Coverage

| Learning Goal | Covered By |
|--------------|-----------|
| {goal} | PBL-C{N}-{M} |

## Expert Review Notes
- Instructional designer: {feedback}
- Psychologist: {feedback}
```

Create the `activities/` directory if it doesn't exist.

Update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py complete-project-skill \
  {workspace} activity-design \
  --phase designing
```

If all 3 clues are designed, tell the user: "All activities designed. Run `/workshop-pbl:proposal-generate {workspace}` to compile the complete PBL proposal."

## Out of Scope
- Does NOT validate resource availability (workshop-resource's responsibility)
- Does NOT check curriculum standards (workshop-quality's responsibility)
- Does NOT generate the full proposal document (proposal-generate's responsibility)
