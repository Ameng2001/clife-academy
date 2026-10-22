---
name: resource-planner
description: Match and categorize resources for each activity in a PBL proposal — PBL Box, My Journal, Teacher's Supplies, and Media. Use after activities are designed, when planning material procurement, or when someone says "plan the resources". Produces categorized resource lists.
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Resource Planner

Match and categorize resources for each PBL activity into 4 categories. Ensures every activity has a complete, categorized resource list with specific item names and quantities. Produces a procurement-ready resource plan.

## Inputs

Accept one of:
- A workspace path via `$ARGUMENTS` (e.g., `.workshop/projects/spring-flowers/`)
- If no path given, scan the current working directory for `activities/`

Required artifacts:
- `activities/clue-1.md`, `activities/clue-2.md`, `activities/clue-3.md` -- activity content with resource annotations

Optional:
- `proposal.md` -- for project-level context (class size, age group)

## Outputs

Write `resource-plan.md` in the same workspace directory.
Also update `status.json` in the same workspace when present.

## Resource Categories

All resources must be classified into exactly one of these 4 categories:

### 1. PBL Box / 项目盒

Centrally supplied items ordered from the vendor 2-4 weeks before the project starts. These are specialty items that individual classrooms cannot easily source.

**Characteristics**:
- Specialized materials not commonly found in classrooms (e.g., magnifying glasses, specific craft kits, science experiment supplies)
- Items requiring quality control or consistency across classrooms
- Consumables in bulk (colored sand, special paper, clay)

**Examples**: 放大镜、磁铁套装、种子套装、特殊颜料、实验器材、手工材料包

### 2. My Journal / 探索足迹袋

Child's personal journal and worksheet materials. Each child gets their own set.

**Characteristics**:
- Pre-printed worksheets, observation logs, drawing templates
- Personal recording materials (stickers, stamps for self-assessment)
- Take-home reflection sheets

**Examples**: 观察记录表、绘画模板、贴纸、探索日记页、自评印章卡

### 3. Teacher's Supplies / 自备材料

Items the teacher prepares locally from classroom stock or easy local purchase.

**Characteristics**:
- Common classroom supplies (markers, paper, tape, scissors)
- Easily sourced natural materials (leaves, stones, water)
- Food items for sensory activities (fruits, vegetables -- must specify type)
- Classroom furniture/equipment already available

**Examples**: 白纸、彩笔、胶水、剪刀、树叶、石头、苹果(3个)、水盆

### 4. Media / 多媒体

Digital content including videos, songs, images, and interactive resources.

**Characteristics**:
- Must include: title/description, duration (for video/audio), source/platform
- Videos should be age-appropriate and under 5 minutes for PreK
- Songs should include lyrics reference

**Examples**: 《小蝌蚪找妈妈》视频(3分钟)、《春天在哪里》歌曲、昆虫生长过程图片集

## Workflow

1. **Read activities** -- parse all activity files
2. **Extract resources** -- find resource mentions in each activity
3. **Categorize** -- assign each resource to a category
4. **Estimate quantities** -- calculate based on class size
5. **Enforce specificity** -- reject vague resource names
6. **Generate PBL Box summary** -- aggregate order across all activities
7. **Write output** -- save resource-plan.md

After writing `resource-plan.md`, update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} resource-planner \
  --phase reviewing \
  --notes "resource-plan.md generated"
```

## Step 1: Read Activities

Use Glob to find activity files:
```
{workspace}/activities/clue-*.md
```

Read each file. Also read `proposal.md` if available to extract:
- **Class size**: Default to 20-25 children if not specified
- **Age group**: Affects quantity estimates (younger children need more individual sets)
- **Project duration**: Number of weeks

## Step 2: Extract Resources

For each activity (identified by `PBL-C{x}-{y}` code), scan for resource mentions:

1. **Explicit resource sections**: Look for headers containing "材料" "资源" "准备" "Materials" "Resources"
2. **Inline annotations**: Look for items in parentheses after activity steps, e.g., "用放大镜（每组1个）观察"
3. **Implied resources**: If an activity says "画一幅画" but lists no art supplies, flag as implied resource

Build a raw resource list per activity:
```
Activity PBL-C1-1:
  - 放大镜 (explicit, from materials section)
  - 白纸 (explicit, from materials section)
  - 彩笔 (implied, activity involves drawing)
```

## Step 3: Categorize

Apply categorization rules in this priority order:

1. **Media check first**: If the resource is a video, song, image set, or digital content -> Media
2. **Journal check**: If the resource is a worksheet, template, recording sheet, or personal log -> My Journal
3. **PBL Box check**: If the resource is a specialty item not commonly found in classrooms -> PBL Box
4. **Default**: Everything else -> Teacher's Supplies

When uncertain between PBL Box and Teacher's Supplies, use these heuristics:
- If the item requires vendor ordering (not available at a local store within a day) -> PBL Box
- If the item must be consistent/standardized across classrooms -> PBL Box
- If the item is a common craft/office supply -> Teacher's Supplies
- If the item is a natural/food item -> Teacher's Supplies

## Step 4: Estimate Quantities

Use the following quantity formulas (based on class size `N`, default N=25):

| Usage pattern | Formula | Example |
|--------------|---------|---------|
| One per child | N | 观察记录表 x 25 |
| One per small group (4-5 children) | ceil(N/4) | 放大镜 x 7 |
| One per table (6 children) | ceil(N/6) | 水盆 x 5 |
| Shared class resource | 1-2 | 地球仪 x 1 |
| Consumable per child | N * 1.2 (20% buffer) | 手工纸 x 30 |
| Teacher demonstration | 1 | 教师示范用大图 x 1 |

If the activity specifies quantities, use those instead of estimates.

For Media resources, quantity is always 1 (it's digital content shared on screen).

## Step 5: Enforce Specificity

Reject and flag vague resource names. Every resource must have:
- **Specific item name** (not just a category)
- **Quantity** (a number, not "若干" or "some")

Vague items to flag and request clarification:

| Vague | Specific alternative needed |
|-------|---------------------------|
| 水果 | 苹果(3个)、香蕉(5根) -- specify type and count |
| 材料 | Too generic -- what material specifically? |
| 图片 | {主题}图片(X张) -- specify subject and count |
| 视频 | {标题}视频({时长}) -- specify title and duration |
| 纸 | 白色A4纸 / 彩色卡纸 / 水彩纸 -- specify type |
| 笔 | 彩色水彩笔 / 铅笔 / 蜡笔 -- specify type |

If vague items are found, list them in a "Needs Clarification" section rather than guessing.

## Step 6: Generate PBL Box Summary

Aggregate all PBL Box items across all activities:

1. Combine duplicate items (same item in multiple activities -> sum quantities)
2. Add 10% buffer for breakage/loss on physical items
3. Sort by category within the box (science supplies, art supplies, tools)
4. Note the lead time: "Order 2-4 weeks before project start"

## Step 7: Write Output

Write `{workspace}/resource-plan.md` with this structure:

```markdown
# Resource Plan / 资源计划

> Generated: {date}
> Project: {project title}
> Class size: {N} children
> Activities: {total count}

---

## Per-Activity Resources

### Clue 1 / 线索一

#### PBL-C1-1: {activity name}

| Item | Category | Quantity | Notes |
|------|----------|----------|-------|
| {item} | PBL Box | {n} | {notes} |
| {item} | My Journal | {n} | {notes} |
| {item} | Teacher's Supplies | {n} | {notes} |
| {item} | Media | 1 | {title, duration, source} |

#### PBL-C1-2: {activity name}

{same table format}

### Clue 2 / 线索二

{same structure}

### Clue 3 / 线索三

{same structure}

---

## PBL Box Order Summary / 项目盒订单汇总

> Lead time: 2-4 weeks before project start
> Quantities include 10% buffer

| Item | Total Qty | Used in Activities | Unit |
|------|----------|-------------------|------|
| {item} | {total + buffer} | PBL-C1-1, PBL-C2-3 | {个/套/张} |

---

## My Journal Contents / 探索足迹袋内容

| Item | Qty per child | Used in Activity |
|------|--------------|-----------------|
| {worksheet name} | 1 | PBL-C1-1 |

---

## Teacher's Supplies Checklist / 自备材料清单

| Item | Total Qty | Used in Activities | Likely on hand? |
|------|----------|-------------------|----------------|
| {item} | {n} | PBL-C1-1 | Yes/No |

---

## Media Resources / 多媒体资源

| Title | Type | Duration | Source | Used in Activity |
|-------|------|----------|--------|-----------------|
| {title} | Video/Song/Image | {duration} | {source} | PBL-C1-1 |

---

## Needs Clarification / 待确认

{List of vague items that need the user to specify details}

| Activity | Vague Item | What's needed |
|----------|-----------|--------------|
| PBL-C1-2 | 水果 | Specify fruit type and quantity |
```

After writing the file:
- Display a summary: "{n} resources across {m} activities. {PBL Box items count} items to order, {clarification count} items need clarification."
- If there are items needing clarification, prompt the user to resolve them

## Out of Scope

- Does NOT validate resource availability or catalog membership -- that is resource-check's responsibility
- Does NOT place actual procurement orders
- Does NOT design activities -- only plans resources for existing activities
