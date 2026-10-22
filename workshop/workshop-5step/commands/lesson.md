---
name: lesson
description: Run the full lesson design pipeline — objectives → scaffold → detail → generate
argument-hint: [课题]
---

Run the full Five-Step lesson design pipeline for the specified topic. This chains all 4 lesson skills in sequence, pausing for user validation at each step.

Pass the lesson topic as `$ARGUMENTS` (e.g., "认识春天的花").

**Pipeline steps:**
1. `lesson-objective` — generate and validate learning objectives
2. `lesson-scaffold` — design the five-step teaching structure
3. `lesson-detail` — write detailed teacher scripts and materials
4. `lesson-generate` — compile the complete lesson plan

Each step pauses for your confirmation before proceeding to the next.

Use skill: "lesson-objective"
Then use skill: "lesson-scaffold"
Then use skill: "lesson-detail"
Then use skill: "lesson-generate"
