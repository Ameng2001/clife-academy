---
name: onboarding
description: Guide a team through first-use setup after init by checking configuration, knowledge base readiness, planning vs project entry strategy, and recommended next steps. Use when someone is new to the system, when a school is adopting the workflow, or when someone asks how to get started.
allowed-tools: Read, Write, Bash, Glob
user-invocable: true
---

# Workshop Onboarding

Guide a team from an initialized runtime to a usable starting point.

`onboarding` is a first-use workflow. It explains the system, checks what is missing, and recommends the right next action for this team.

## Responsibilities

- Explain the relationship between `init`, `config`, and real project work
- Inspect current readiness of `.workshop/`
- Check whether kb, plans, and projects already exist
- Collect the team's starting preferences
- Recommend the next command to run
- explain where the first HIL checkpoint will occur

## Does NOT

- Create `.workshop/` — use `/workshop-core:init`
- Change low-level runtime settings by default — use `/workshop-core:config`
- Generate project content directly

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Read:
   - `.workshop/config.yaml`
   - `.workshop/kb/`
   - `.workshop/plans/`
   - `.workshop/projects/`

## Step 1: Assess Readiness

Run:

```bash
python3 workshop-core/scripts/runtime_setup.py onboarding-summary
```

Summarize the current state:

- Is config present?
- Is knowledge base empty or populated?
- Are there existing plans?
- Are there existing projects?
- Is the team starting from planning or from a concrete course theme?

## Step 2: Ask Minimal First-Use Questions

Ask only the minimum required:

1. Main role:
   - curriculum director
   - classroom teacher
   - mixed team
2. Usual starting point:
   - start from semester/month/week planning
   - start from a concrete course theme
   - both, depending on context
3. Preferred default methodology:
   - pbl-huamei
   - five-step
   - mixed
4. Whether school materials should be imported now
5. Whether publishing will remain local for now

## Step 3: Recommend Setup Actions

Based on answers, recommend the next step:

- If default methodology is unclear:
  - suggest `/workshop-core:config set defaults.methodology ...`
- If kb is empty and the team has school materials:
  - suggest `/workshop-kb:kb-import <path>`
- If the team starts from planning:
  - suggest `/workshop-planner:semester-plan <semester>`
- If the team starts from a concrete course:
  - suggest `/workshop-pipelines:pipeline-select <id>` to choose the first pipeline
- If the team is unsure:
  - suggest creating one pilot project first

Also explain the first human review gate:

- planning-first teams usually hit `project-framing` after the first project is created and linked to a plan
- project-first teams usually hit `project-framing` right after pipeline selection and basic project setup

## Step 4: Print Next-Step Guide

Use the helper output as the base, then print a short tailored guide such as:

```text
Onboarding summary

- Role: curriculum director
- Starting mode: planning-first
- Default methodology: pbl-huamei
- KB status: empty
- Publishing: local

Recommended next steps:
1. /workshop-kb:kb-import <path>
2. /workshop-planner:semester-plan 2026春季学期
3. /workshop-pipelines:pipeline-select pbl-huamei
```

## Relationship to Other Core Commands

- `init` = create the runtime skeleton
- `config` = set system-level runtime parameters
- `onboarding` = guide the first real use of the system
- major workflow handoffs should pause at explicit HIL checkpoints
