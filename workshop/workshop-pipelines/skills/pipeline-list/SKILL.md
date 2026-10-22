---
name: pipeline-list
description: List all available teaching methodology pipelines with their stages and target audience. Preferred entrypoint for seeing what course design pipelines are available.
allowed-tools: Read, Glob
user-invocable: true
---

# Pipeline List

Display all available teaching methodology pipelines registered in the system. Each pipeline defines a complete design flow, output format, and coding convention for a single deliverable inside a project workspace.

## Step 1: Scan Registered Pipelines

1. Glob `workshop-pipelines/references/templates/*/manifest.yaml`
2. For each manifest found, read and parse the YAML content

## Step 2: Build Pipeline Overview

For each pipeline, extract and display:

- **ID**: The pipeline identifier
- **名称**: Chinese name
- **Name**: English name
- **描述**: One-line description
- **目标角色**: Target user roles
- **适用年龄**: Target age groups
- **时间跨度**: Time scope (lesson / week / month)
- **设计流水线**: Pipeline stages (ordered list)
- **输出类型**: Document type (proposal / lesson-plan)

## Step 3: Display

Present as a formatted comparison table:

```
┌─────────────────────────────────────────────────────────┐
│  📋 可用教学法管线 / Available Methodology Pipelines    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [1] pbl-huamei — 华美 PBL 五步法                       │
│      角色: 课研主任 | 周期: 月度 | 5 个设计阶段          │
│      产出: PBL 项目预案 (proposal)                      │
│                                                         │
│  [2] five-step — 五步教学法教案                         │
│      角色: 一线教师 | 周期: 单课时 | 4 个设计阶段         │
│      产出: 标准教案 (lesson-plan)                       │
│                                                         │
│  [3] thematic-curriculum — 幼儿园主题式课程             │
│      角色: 课研主任/教师 | 周期: 月度 | 4 个设计阶段      │
│      产出: 主题课程包 (thematic-package)                │
│                                                         │
│  ... (additional pipelines as registered)               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Step 4: Guide Next Steps

After displaying the list, suggest:

> **下一步 / Next steps:**
> - 使用 `/workshop-pipelines:pipeline-select {id}` 为当前项目中的下一个产物选择 pipeline
> - 选择后，系统会自动路由到对应的设计流水线

## Out of Scope

- This skill does NOT create or modify pipelines
- This skill does NOT set the active pipeline (use `pipeline-select` for that)
