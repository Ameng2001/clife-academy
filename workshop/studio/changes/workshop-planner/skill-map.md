# Skill Map: workshop-planner

> Date: 2026-03-29

## Skills

### semester-plan
- **Description**: Create a semester-level theme calendar with monthly topics, domain balance, and progression
- **Inputs**: semester name, age group
- **Outputs**: `studio/changes/{workspace}/semester-plan.md`
- **Complexity**: High
- **allowed-tools**: Read, Write, Glob, Agent

### month-plan
- **Description**: Break a monthly theme into weekly sub-themes with daily activity slots
- **Inputs**: semester-plan.md (optional), month + theme
- **Outputs**: `studio/changes/{workspace}/month-plan.md`
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob, Agent

### week-plan
- **Description**: Generate a detailed weekly schedule with daily activity slots
- **Inputs**: month-plan.md (recommended), week number
- **Outputs**: `studio/changes/{workspace}/week-plan.md`
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob, Agent

## Data Flow

```
semester-plan → month-plan → week-plan
     ↑               ↑            ↓
 (workshop-kb    (workshop-kb   (workshop-5step
  calendars)      textbooks)     lesson pipeline)
```

## Implementation Order

1. **semester-plan** — top-level planning
2. **month-plan** — depends on semester context
3. **week-plan** — depends on month breakdown
