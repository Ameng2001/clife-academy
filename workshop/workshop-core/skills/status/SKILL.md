---
name: status
description: Show the current state of all active project workspaces, shared planning records, and deliverables in progress. Use when checking progress, when someone asks "what's the status", or when resuming work.
allowed-tools: Read, Glob
user-invocable: true
---

# Workshop Status

Display a dashboard of active project workspaces, shared planning records, knowledge base status, and recent archives.

## Steps

### Step 1: Check runtime exists

If `.workshop/` doesn't exist, suggest running `/workshop-core:init`.

### Step 1b: Build Status Summary

Run:

```bash
python3 workshop-core/scripts/workspace_status.py summarize-status
```

This returns a structured summary containing:
- default methodology
- knowledge base counts
- planning workspaces
- project workspaces
- HIL overview and attention queue
- recent archives

For the user-facing dashboard, run:

```bash
python3 workshop-core/scripts/workspace_status.py render-status
```

If no active workspaces exist, show "No active work".

### Step 4: Display dashboard

Display the rendered dashboard. It should include:

```
Workshop Status
═══════════════

📋 Default Methodology: pbl-huamei (华美 PBL 五步法)

Runtime Root: `.workshop/`

📚 Knowledge Base (.workshop/kb/)
  区编教材: 3 | 园本理念: 1 | 历年教案: 12 | 教研记录: 5 | 学期日历: 2
  (Run /workshop-kb:kb-index to refresh)

📅 Planning Records
  2026-spring   semester   linked: 2 projects
  april-2026    month      linked: 1 project

Projects (.workshop/projects/)
┌──────────────────┬────────────┬──────────────┬────────────────┬────────────────────┬──────────────────┐
│ Project          │ Phase      │ Methodology  │ Skills         │ Deliverables       │ Plan Refs        │
├──────────────────┼────────────┼──────────────┼────────────────┼────────────────────┼──────────────────┤
│ spring-flowers   │ reviewing  │ five-step    │ 4/4 done       │ lesson-plan        │ week: week-2     │
│ weather-watch    │ approved   │ pbl-huamei   │ 7/7 done       │ proposal, review   │ month: april     │
│ garden-life      │ designing  │ pbl-huamei   │ 4/7 done       │ proposal draft     │ —                │
└──────────────────┴────────────┴──────────────┴────────────────┴────────────────────┴──────────────────┘

Recently Shipped (.workshop/archive/)
  2026-03-25-animal-friends → courses/animal-friends
  2026-03-18-color-lab      → courses/color-lab
```

HIL must be visible:
- global counts for `awaiting_review`, `changes_requested`, `approved`
- which projects currently need human attention

### Step 5: Suggest next actions

Based on current state, suggest what to do next:
- If a project is `approved`: "Run `/workshop-core:promote {name}` to ship its deliverables"
- If a project is `designing` with `pbl-huamei`: "Continue with `/workshop-pbl:design {name}`"
- If a project is `designing` with `five-step`: "Continue with `/workshop-5step:lesson {name}`"
- If a project is `reviewing`: "Complete the review, then set phase to approved"
- If a project is `planning`: "Choose the pipeline for the next deliverable with `/workshop-pipelines:pipeline-select`"
- If no active changes: "Run `/workshop-pipelines:pipeline-list` to see available pipelines, or `/workshop-planner:semester-plan` to plan a semester"
- If knowledge base is empty: "Run `/workshop-kb:kb-import <path>` to import school materials"

## Notes

- This skill is read-only — it does NOT modify any files or state
- Skill status breakdown reads the `skills` object from each workspace's `status.json`
- Phase values follow the lifecycle defined in `.workshop/config.yaml`: planning → designing → reviewing → approved → shipped
- Project workspaces are the primary unit of work; planning records are displayed as shared context
- `status.json.type` is authoritative when present; filename heuristics are fallback only
- `workspace_status.py summarize-status` is the canonical aggregation path for this dashboard
- `workspace_status.py render-status` is the canonical text dashboard for direct display
- `workspace_status.py` reads only `.workshop/`
