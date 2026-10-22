---
name: approve
description: Mark a reviewed project workspace as approved after checking required deliverables and skill completion. Use when a curriculum director or reviewer is ready to move a project from reviewing to approved.
allowed-tools: Read, Write, Bash, Glob
user-invocable: true
---

# Workshop Approve

Move a project workspace from `reviewing` to `approved` after verifying that its required deliverables and skill statuses are complete.

## Pre-check

1. Verify `.workshop/` exists.
2. Resolve the workspace name from `$ARGUMENTS`.
3. Read `.workshop/projects/{workspace}/status.json`.
4. Confirm `type == "project"`.
5. Confirm `phase == "reviewing"` or explain why approval is premature.
6. Check deliverables:
   - If `proposal.md` exists, require:
     - `driving-question`
     - `network-map`
     - `inquiry-scaffold`
     - `activity-design`
     - `proposal-generate`
   - If `lesson-plan.md` exists, require:
     - `lesson-objective`
     - `lesson-scaffold`
     - `lesson-detail`
     - `lesson-generate`
   - If neither exists, stop.

## Step 1: Summarize Approval Readiness

Run:

```bash
python3 workshop-core/scripts/workspace_status.py validate-project {workspace} --required-phase reviewing
```

Display the validation result:

- Current phase
- Deliverables present
- Required skills and whether each is `done` or `approved`
- Any optional review files present

If anything required is missing, stop and tell the user exactly what to complete first.

## Step 2: Mark Approved

Run:

```bash
python3 workshop-core/scripts/workspace_status.py approve-hil {workspace} approval-gate --approved-by curriculum-director
python3 workshop-core/scripts/workspace_status.py set-phase {workspace} approved --approved-by curriculum-director
```

This updates:

- `hil.checkpoint = "approval-gate"`
- `hil.status = "approved"`
- `hil.approved_at = {ISO-8601}`
- `hil.approved_by = "curriculum-director"`
- `phase = "approved"`
- `approved_at = {ISO-8601}`
- `approved_by = "curriculum-director"`

## Step 3: Report

Tell the user:

- The project is now approved
- The next step is `/workshop-core:promote {workspace}`

## Out of Scope

- Does NOT run promote
- Does NOT generate missing artifacts
- Does NOT approve planning workspaces
- This is the explicit human-in-the-loop command for the final approval gate
