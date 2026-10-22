# Skill Map: workshop-pipelines

> Date: 2026-03-29

## Skills

### pipeline-list
- **Description**: List all available teaching methodology pipelines with pipeline info
- **Inputs**: (none)
- **Outputs**: Terminal summary of all registered pipelines
- **Complexity**: Simple
- **allowed-tools**: Read, Glob

### pipeline-select
- **Description**: Select and activate a methodology pipeline for the current workspace
- **Inputs**: pipeline ID
- **Outputs**: Updates workspace config.yaml with selected methodology
- **Complexity**: Simple
- **allowed-tools**: Read, Write, Glob

## Data Flow

```
pipeline-list → (user picks) → pipeline-select → updates config
                                                       ↓
                                               (workshop-pbl or
                                                workshop-5step reads)
```

## Implementation Order

1. **pipeline-list** — discovery
2. **pipeline-select** — activation
