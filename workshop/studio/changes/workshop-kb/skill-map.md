# Skill Map: workshop-kb

> Date: 2026-03-29

## Skills

### kb-import
- **Description**: Import school-specific documents into the knowledge base with metadata extraction
- **Inputs**: file or directory path
- **Outputs**: tagged markdown files in `studio/kb/{category}/`
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob, Bash

### kb-index
- **Description**: Build or refresh the knowledge base index for fast querying
- **Inputs**: `studio/kb/**/*.md`
- **Outputs**: `studio/kb/index.yaml`
- **Complexity**: Medium
- **allowed-tools**: Read, Write, Glob

### kb-query
- **Description**: Search the knowledge base for relevant materials
- **Inputs**: query string, optional filters (category, age group, domain)
- **Outputs**: ranked list of matching documents with excerpts
- **Complexity**: Simple
- **allowed-tools**: Read, Glob

## Data Flow

```
kb-import → kb-index → kb-query
   ↑                      ↓
(user files)     (workshop-5step, workshop-pbl, etc.)
```

## Implementation Order

1. **kb-import** — data entry point
2. **kb-index** — depends on imported data
3. **kb-query** — depends on index
