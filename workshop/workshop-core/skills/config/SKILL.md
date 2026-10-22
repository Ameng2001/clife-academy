---
name: config
description: View or update course workshop runtime configuration such as paths, default methodology, model choices, and publishing targets. Use when someone wants to inspect settings, switch defaults, configure remote publishing, or adjust runtime behavior.
allowed-tools: Read, Write, Bash, Glob
user-invocable: true
---

# Workshop Config

Manage `.workshop/config.yaml` as the single runtime settings file.

`config` is a system-level settings command. It does not create projects, does not import knowledge, and does not start a design workflow.

## Responsibilities

- Show the current runtime configuration
- Update default methodology and governance settings
- Configure model selection by workflow
- Configure publishing targets such as local output paths or future remote targets
- Configure runtime path settings when a team needs custom structure

## Does NOT

- Create `.workshop/` from scratch — use `/workshop-core:init`
- Walk the team through first-use setup — use `/workshop-core:onboarding`
- Create or modify project deliverables

## Pre-check

1. Verify `.workshop/config.yaml` exists. If not, tell the user to run `/workshop-core:init` first.
2. Parse `$ARGUMENTS`:
   - empty or `show` → display current config
   - `set <key> <value>` → update one config key
   - `edit` → present the full structure and ask which section to change

## Config Structure

The recommended runtime structure is:

```yaml
schema: course-workshop

defaults:
  methodology: pbl-huamei
  target_collection: courses
  governance:
    approval_required: true
    approver_role: curriculum-director

models:
  planning: gpt-5
  review: gpt-5
  resource_check: gpt-5-mini

publishing:
  default_target:
    kind: local
    path: courses

runtime:
  projects_dir: .workshop/projects
  plans_dir: .workshop/plans
  kb_dir: .workshop/kb
  archive_dir: .workshop/archive

experts:
  custom_dir: .workshop/agents/custom
  shared_dir: experts

remote:
  cos:
    enabled: false
    bucket: ""
    base_path: ""
```

## Step 1: Show Current Config

If action is `show`, run:

```bash
python3 workshop-core/scripts/runtime_setup.py config-show
```

Then summarize:

- default methodology
- publishing target
- configured model choices
- runtime paths
- remote publishing state

## Step 2: Update One Setting

If action is `set <key> <value>`:

Run:

```bash
python3 workshop-core/scripts/runtime_setup.py config-set <key> <value>
```

This updates the requested key and preserves unrelated settings.

Examples:

```text
/workshop-core:config show
/workshop-core:config set defaults.methodology five-step
/workshop-core:config set publishing.default_target.kind cos
/workshop-core:config set remote.cos.bucket kindergarten-courses
```

## Step 3: Report

After any update, print:

- changed key
- previous value
- new value
- any downstream implication

Example:

```text
Updated `.workshop/config.yaml`

- defaults.methodology: pbl-huamei -> five-step

Effect:
- New projects will default to five-step until changed again.
```

## Notes

- `config` is for runtime settings, not project content
- Per-project methodology still belongs in `.workshop/projects/{workspace}/config.yaml`
- Future remote shipping should be controlled through `publishing` and `remote` sections here
