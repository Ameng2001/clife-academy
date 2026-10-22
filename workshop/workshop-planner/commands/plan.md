---
name: plan
description: Run the full curriculum planning pipeline — semester → month → week
argument-hint: [学期]
---

Run the full hierarchical curriculum planning pipeline. This chains all 3 planning skills in sequence, pausing for user validation at each step.

Pass the semester as `$ARGUMENTS` (e.g., "2026春季学期").

**Pipeline steps:**
1. `semester-plan` — create semester-level theme calendar
2. `month-plan` — break each month into weekly sub-themes
3. `week-plan` — generate weekly daily activity schedules

Each step pauses for your confirmation before proceeding to the next.

Use skill: "semester-plan"
Then use skill: "month-plan"
Then use skill: "week-plan"
