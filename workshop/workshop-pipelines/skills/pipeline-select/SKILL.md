---
name: pipeline-select
description: Set the active teaching methodology pipeline for the next deliverable in the current project workspace. Preferred entrypoint for selecting a course-design pipeline.
allowed-tools: Read, Write, Glob
user-invocable: true
---

# Pipeline Select

Set the active teaching methodology pipeline for the next deliverable in the current project workspace. The selected pipeline determines which design stages to use, what output format to generate, and which coding convention to follow. A single project may use different pipelines for different deliverables over time.

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Determine the workspace path:
   - If `$ARGUMENTS` contains a recognized pipeline ID, use it directly
   - Otherwise, list available pipelines and ask the user to choose

## Step 1: Validate Pipeline ID

1. Read the user's requested pipeline ID from `$ARGUMENTS`
2. Check if `workshop-pipelines/references/templates/{id}/manifest.yaml` exists
3. If not found:
   - Run pipeline-list logic to show available pipeline options
   - Ask the user to pick one

## Step 2: Read Pipeline Manifest

Run:

```bash
python3 workshop-core/scripts/runtime_setup.py select-pipeline {id} {workspace} --theme "{theme}"
```

Use the returned manifest-derived fields:
- `id`
- `name`
- `pipeline_plugin`
- `document_type`
- `stages`

## Step 3: Determine Project Workspace

1. If a project workspace is already active (check `.workshop/projects/*/status.json` for `phase: "designing"`), use that workspace
2. If no active workspace, ask the user:

> **请指定项目：**
> - 输入一个主题名称创建新项目工作区（如"春天的花"）
> - 或输入已有项目工作区名称

## Step 4: Confirm Writeback

The helper has already:

1. created the project workspace if needed
2. written `.workshop/projects/{workspace}/config.yaml`
3. ensured `.workshop/projects/{workspace}/status.json`
4. requested `project-framing`

Clarify to the user that this sets the current default for the next deliverable, not an exclusive project-wide lock.

## Step 5: Confirm and Guide

Display confirmation:

```
✅ 已选择 pipeline: {name} ({id})

设计流水线: {pipeline.plugin}
  {stage-1-name} → {stage-2-name} → ... → {final-stage-name}

输出格式: {document_type}
编码前缀: {coding.prefix}

HIL:
- `project-framing` 已发起，等待人工确认项目范围

下一步:
- PBL 预案设计: /workshop-pbl:design {theme}
- 五步法教案设计: /workshop-5step:lesson {theme}
- 层级规划: /workshop-planner:semester-plan {semester}
```

## Out of Scope

- This skill does NOT run the design pipeline — it only sets the default pipeline for the next deliverable
- This skill does NOT create pipelines — it selects from existing registered pipelines
- This skill does NOT modify pipeline content
