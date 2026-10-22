---
name: format-lesson
description: Reformat a generated lesson-plan into a client-facing teaching activity layout profile without changing the underlying instructional content. Use when a deliverable must align with a school template before final export or when someone asks "format this lesson for the client template".
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Format Lesson

Normalize `.workshop/projects/{workspace}/lesson-plan.md` into a client-facing teaching activity layout profile.

This skill does **not** generate new pedagogy. It reorganizes the existing lesson into a delivery-oriented structure, such as a dual-column teaching activity layout.

## Pre-check

1. Read `.workshop/projects/{workspace}/lesson-plan.md`
   - If missing, suggest `/workshop-5step:lesson-generate`
2. Read `.workshop/projects/{workspace}/config.yaml`
3. Read `workshop-format/references/layout-profiles.md`
4. Read the active pipeline output format if relevant:
   - `workshop-pipelines/references/templates/five-step/output-format.md`

## Step 1: Select Layout Profile

Choose one layout profile:

- `standard-markdown`
- `teaching-activity-dual-column`
- `compact-school-handout`

Default for current client delivery work:
- `teaching-activity-dual-column`

## Step 2: Normalize Section Order

Ensure the output appears in this order:

1. 基本信息
2. 核心发展目标
3. 教学目标
4. 教学准备
5. 重难点
6. 教学过程
7. 活动延伸
8. 教学反思

## Step 3: Prepare Dual-Column Semantics

For `teaching-activity-dual-column`:

- Keep `教师观察与支持要点` as a distinct column in the process table
- Keep teacher actions concise enough for later Word/PDF column layout
- Split dense cell content into short bullet-style lines when needed

## Step 4: Write Formatted Source

Run:

```bash
python3 workshop-format/scripts/export_tools.py format-lesson \
  {workspace} \
  --profile teaching-activity-dual-column
```

Write to:

- `.workshop/projects/{workspace}/lesson-plan.formatted.md`

Also add a short frontmatter block:

```yaml
---
layout_profile: teaching-activity-dual-column
export_ready: true
source_file: lesson-plan.md
---
```

## Step 5: Report

Report:
- chosen layout profile
- output path
- whether the file is ready for later Word/PDF export

## Out of Scope

- This skill does NOT export Word/PDF binaries
- It does NOT redesign the teaching content
- It does NOT change approval or shipped status
