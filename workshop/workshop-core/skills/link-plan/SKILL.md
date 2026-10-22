---
name: link-plan
description: Link a project workspace to a semester, month, or week planning workspace by updating project plan_refs and planning linked_projects. Use when a course project should be associated with an existing plan.
allowed-tools: Read, Write, Bash, Glob
user-invocable: true
---

# Link Plan

Create a lightweight relationship between a project workspace and a planning workspace.

## Inputs

Expect:

```text
{project} {plan} {plan-level}
```

Example:

```text
spring-flowers 2026-april-week-2 week
```

## Pre-check

1. Verify `.workshop/` exists.
2. Read `.workshop/projects/{project}/status.json` if present. If missing, create a minimal project status first.
3. Read `.workshop/plans/{plan}/status.json` if present.
4. If the planning status is missing, initialize it with `type = "planning"` and the provided `plan-level`.
5. If the planning status exists with a conflicting `plan_level`, stop and ask the user to resolve it.

## Step 1: Write Both Sides

Run:

```bash
python3 workshop-core/scripts/workspace_status.py link-plan {project} {plan} --plan-level {plan-level}
```

This updates:

- project side:
  - `plan_refs.{plan-level} = {plan}`
- planning side:
  - append `{project}` to `linked_projects`

If this link completes the initial framing context, request the first HIL checkpoint:

```bash
python3 workshop-core/scripts/workspace_status.py request-hil \
  {project} project-framing \
  --notes "plan linked; confirm project framing against planning context"
```

## Step 2: Report

Summarize:

- project linked
- plan linked
- updated `plan_refs`
- whether `project-framing` is now ready for human approval

## Out of Scope

- Does NOT create or edit plan documents
- Does NOT create proposal or lesson deliverables
- Does NOT enforce that every project must have a plan
