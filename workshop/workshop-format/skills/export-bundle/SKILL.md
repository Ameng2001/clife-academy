---
name: export-bundle
description: Prepare a release bundle for delivery targets such as local handoff, Word/PDF packaging, or future MCP-backed publishing. Use after a project is approved or shipped, or when someone says "prepare the client package".
allowed-tools: Read, Write, Glob, Bash
user-invocable: true
---

# Export Bundle

Prepare a delivery-oriented export bundle without altering the runtime source-of-truth files.

## Pre-check

1. If the workspace is active, read `.workshop/projects/{workspace}/status.json`
2. If the workspace is archived, read `.workshop/archive/{archive}/status.json`
3. Read `docs/architecture/runtime-architecture.md`
4. Read `workshop-format/references/export-targets.md`

## Step 1: Determine Source

Prefer the following source files when present:

- `lesson-plan.formatted.md`
- `lesson-plan.md`
- `proposal.md`
- `resource-plan.md`
- `quality-report.md`
- `review-comments.md`
- `resource-check-report.md`

If a formatted source exists, use it as the export input.

## Step 2: Select Export Target

Supported target modes:

- `local-markdown-bundle`
- `word-ready-bundle`
- `pdf-ready-bundle`
- `remote-bundle-placeholder`

Default:
- `local-markdown-bundle`

## Step 3: Prepare Export Directory

Run:

```bash
python3 workshop-format/scripts/export_tools.py export-bundle \
  {workspace} \
  --target local-markdown-bundle
```

Write into a delivery-oriented directory under:

- `.workshop/exports/{workspace}/{target}/`

Include:
- `manifest.yaml`
- exported markdown sources
- optional assets placeholder directory

## Step 4: Preserve Release Semantics

Do not move or delete:
- `.workshop/projects/*`
- `.workshop/archive/*`
- `courses/*`

This skill is additive. It prepares export packaging, but does not replace `promote`.

## Step 5: Report

Return:
- export target mode
- output path
- next recommended step

## Out of Scope

- This skill does NOT render real `.docx` or `.pdf` files yet
- It does NOT publish to COS/S3 directly
- It does NOT change project approval status
