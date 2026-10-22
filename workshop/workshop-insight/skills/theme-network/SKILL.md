---
name: theme-network
description: Generate a thematic curriculum theme network mapping core theme -> subthemes -> domain goals. Use when a customer package requires a "主题网络图", when month planning needs a structured thematic map, or when someone says "build the theme network".
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Theme Network

Generate a `主题网络图` artifact for a thematic curriculum package. This skill focuses on the core theme, weekly subthemes, and domain-linked goal clusters rather than PBL inquiry decomposition.

## Expert Discovery

1. **Required expert**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-insight/agents/`
2. **Required expert**: Resolve `instructional-designer.md` using the same scope order
3. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
4. **Optional shared experts**: Glob `experts/*.md`
5. **Optional plugin-local experts**: Glob `workshop-insight/agents/*.md`

## Pre-check

1. Verify `.workshop/` exists
2. Determine the workspace path
3. Read `.workshop/projects/{workspace}/theme-analysis.md` if present
4. Read `.workshop/projects/{workspace}/theme-narrative.md` if present
5. Read `workshop-kb/references/client-examples/hepu-future/theme-network-sample.md`
6. Read active pipeline from project config
   - If not `thematic-curriculum`, warn but continue

## Step 1: Confirm Network Inputs

Confirm or infer:
- 核心主题
- 4 个子主题（默认按月度四周）
- 主要覆盖领域
- 每个子主题的组织重点

Prefer the weekly progression from:
- `theme-analysis.md`
- `theme-narrative.md`

## Step 2: Build the Network Structure

Create a network with 3 layers:

### Layer 1: 核心主题
- one central monthly theme

### Layer 2: 子主题
- 4 weekly subthemes
- each subtheme should represent a clear developmental progression

### Layer 3: 领域目标簇
- for each subtheme, list 2-4 domain-linked goal clusters
- domains should use customer-facing language:
  - 健康
  - 语言
  - 社会
  - 科学
  - 艺术

## Step 3: Output Format

Write the network in two forms:

### A. Summary Table

| 子主题 | 递进定位 | 健康 | 语言 | 社会 | 科学 | 艺术 |
|--------|---------|------|------|------|------|------|
| {subtheme_1} | {position} | {goal cluster} | ... | ... | ... | ... |

### B. Structured Tree

```text
核心主题
├── 子主题 1
│   ├── 健康: ...
│   ├── 语言: ...
│   └── ...
├── 子主题 2
...
```

## Step 4: Quality Rules

- The four subthemes must show progression, not repetition
- Domain goals should be concise clusters, not full lesson objectives
- At least 3 domains should appear meaningfully across the whole network
- Avoid PBL inquiry wording unless the user explicitly wants hybrid structure

## Step 5: Expert Review

Ask experts to check:
- whether the subthemes are sufficiently distinct
- whether the domain goal clusters are age-appropriate
- whether the network can actually support later month/week planning

## Step 6: Write Output

Write to:

- `.workshop/projects/{workspace}/theme-network.md`

Then update status:

```bash
python3 workshop-core/scripts/workspace_status.py complete-project-skill \
  {workspace} theme-network \
  --phase planning
```

## Step 7: Report

Tell the user:
- `theme-network.md` has been prepared
- next recommended step is `/workshop-planner:month-plan {workspace}`

## Out of Scope

- Does NOT generate the final month matrix
- Does NOT design PBL driving questions
- Does NOT write single-activity drafts
