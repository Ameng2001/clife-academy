# Skill Map: workshop-core

> Date: 2026-03-28

## Skills

### init
- **Description**: Initialize a course workshop workspace in the current project for PBL course development. Use when starting course design in a new repo, when someone says "set up workshop", or when the workspace is missing. Creates a git-tracked workspace for planning, designing, and shipping PBL proposals.
- **Inputs**: (none — interactive setup)
- **Outputs**: `studio/` directory with config.yaml, changes/, agents/, archive/
- **Out of scope**: 不做课程设计（workshop-pbl 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Bash, Glob
- **Preconditions**: none

### status
- **Description**: Show the current state of all PBL course design workspaces — which proposals are in progress, their phase, and what's next. Use when checking progress, when someone asks "what's the status", or when resuming work.
- **Inputs**: `studio/changes/*/status.json`
- **Outputs**: Terminal summary of all active workspaces
- **Out of scope**: 不修改状态（只读）
- **Complexity**: Simple
- **allowed-tools**: Read, Glob
- **Preconditions**: studio/ exists

### promote
- **Description**: Promote a completed PBL proposal from the workspace to the target plugin directory and archive the development records. Use when a proposal has been approved and is ready to ship.
- **Inputs**: plugin name, `studio/changes/{plugin}/status.json` (phase must be "approved")
- **Outputs**: Files copied to target, workspace moved to `studio/archive/`
- **Out of scope**: 不做质量检查（workshop-quality 的职责）
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Bash, Glob
- **Preconditions**: status.json phase = "approved"

## Data Flow

```
[init] → creates workspace
[status] → reads workspace (independent, anytime)
[promote] → moves workspace to archive (end of lifecycle)
```

All skills are independent — no dependencies between them.

## Complexity Summary

| Skill | Tier | Scripts needed | Agent needed | MCP needed |
|-------|------|---------------|-------------|------------|
| init | Simple | — | — | — |
| status | Simple | — | — | — |
| promote | Simple | — | — | — |

## Implementation Order

1. **init** — 第一个要建的 skill
2. **status** — 可与 init 并行
3. **promote** — 最后，生命周期末端
