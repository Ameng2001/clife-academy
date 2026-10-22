---
name: resource-check
description: Validate resource lists for completeness, category accuracy, and procurement feasibility. Use before finalizing a proposal, when checking if all materials are available, or when someone says "check the resources". Produces a resource validation report.
allowed-tools: Read, Write, Glob, Grep
user-invocable: true
---

# Resource Check

Validate resource lists for completeness, specificity, correct categorization, and procurement feasibility. Ensures no activity is missing resources, no items lack quantities, and PBL Box items are available in the standard catalog. Does NOT modify resources -- only reports issues.

## Inputs

Accept one of:
- A workspace path via `$ARGUMENTS` (e.g., `.workshop/projects/spring-flowers/`)
- If no path given, scan the current working directory

Required artifacts:
- `resource-plan.md` -- the resource plan to validate (produced by resource-planner)
- `activities/clue-1.md`, `activities/clue-2.md`, `activities/clue-3.md` -- original activity files (to cross-reference)

Optional:
- `references/pbl-box-catalog.md` -- PBL Box vendor catalog for availability checking

## Outputs

Write `resource-check-report.md` in the same workspace directory.
Also update `status.json` in the same workspace when present.

## Workflow

1. **Read all inputs** -- load resource plan, activity files, and catalog
2. **Run 5 checks** -- execute each validation rule
3. **Compile report** -- assemble results
4. **Present and save** -- show summary, write report

After writing `resource-check-report.md`, update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} resource-check \
  --phase reviewing \
  --notes "resource-check-report.md generated"
```

## Step 1: Read All Inputs

Use Glob to locate files:
```
{workspace}/resource-plan.md
{workspace}/activities/clue-*.md
```

For the PBL Box catalog, search in order:
1. `{workspace}/references/pbl-box-catalog.md`
2. `${CLAUDE_SKILL_DIR}/../../references/pbl-box-catalog.md`
3. If no catalog found, skip Check 3 (catalog availability) and note in the report

Parse `resource-plan.md` to extract:
- Per-activity resource tables (item, category, quantity, notes)
- PBL Box order summary
- Any "Needs Clarification" items

Parse activity files to extract:
- All activity codes (`PBL-C{x}-{y}`)
- Resource mentions within activity content (for cross-referencing)

## Step 2: Run 5 Checks

### Check 1: Activity Coverage / 活动资源覆盖

**Rule**: Every activity in the activity files must have at least 1 resource in the resource plan.

**Procedure**:
1. Collect all activity codes from activity files (`PBL-C{x}-{y}` patterns)
2. Collect all activity codes that appear in resource-plan.md
3. Find activities with zero resources

**Verdict** (per activity):
- Has 1+ resources: PASS
- Has 0 resources: FAIL

**Output**: Table of activities with resource counts, highlighting any with zero.

### Check 2: Quantity Specificity / 数量标注完整性

**Rule**: No resource may lack a numeric quantity. Reject vague quantities.

**Rejected quantity values**:
- Empty/missing quantity
- 若干 (several)
- 一些 (some)
- 适量 (appropriate amount)
- 足够 (enough)
- Just a category name without number (e.g., "水果" without "3个")

**Procedure**:
1. For each resource item in resource-plan.md, check the quantity field
2. Verify it contains a numeric value
3. Flag any vague or missing quantities

**Verdict** (per item):
- Has numeric quantity: PASS
- Vague or missing: FAIL

**Output**: List of items with problematic quantities and suggested fix format.

### Check 3: PBL Box Catalog Availability / 项目盒目录匹配

**Rule**: Items categorized as "PBL Box" should match items available from the vendor catalog.

**Procedure**:
1. Load the PBL Box catalog (if available)
2. For each PBL Box item in the resource plan, search for a match in the catalog
3. Matching uses fuzzy comparison: the item name should match or be a recognized variant of a catalog item

**Verdict** (per PBL Box item):
- Found in catalog: PASS
- Not found but similar item exists: WARNING (suggest the catalog alternative)
- Not found, no similar item: FAIL (may need to recategorize as Teacher's Supplies or find a vendor substitute)

**If no catalog available**: Skip this check entirely and note: "PBL Box catalog not available. Cannot verify item availability. Add `references/pbl-box-catalog.md` to enable this check."

**Output**: Table of PBL Box items with catalog match status.

### Check 4: Duplicate Detection / 重复资源检测

**Rule**: The same resource should not appear with different names, quantities, or categories across activities.

**Procedure**:
1. Collect all resource items across all activities
2. Detect duplicates by:
   - Exact name match with different categories (e.g., "彩色卡纸" listed as PBL Box in one activity and Teacher's Supplies in another)
   - Near-name match (e.g., "彩笔" vs "彩色水彩笔" -- may be the same item)
   - Same item with inconsistent quantities for the same usage pattern

**Near-name matching heuristics**:
- One name is a substring of the other
- Names differ only by a qualifier (大/小, 彩色/白色)
- Common synonyms: 画笔=彩笔, 胶棒=胶水, 卡纸=彩色卡纸

**Verdict** (per duplicate pair):
- Same name, same category, consistent quantities: PASS (not a duplicate issue)
- Same name, different categories: FAIL (must pick one category)
- Near-name match: WARNING (verify if these are the same item)
- Inconsistent quantities for same usage: WARNING

**Output**: List of detected duplicate pairs with reconciliation suggestions.

### Check 5: Category Correctness / 分类正确性

**Rule**: Resources must be in the correct category based on their nature.

**Category validation rules**:

| Item characteristic | Correct category | Wrong category (common mistake) |
|-------------------|-----------------|-------------------------------|
| Specialty science/craft supplies | PBL Box | Teacher's Supplies |
| Common classroom supplies (paper, markers, glue) | Teacher's Supplies | PBL Box |
| Worksheets, recording sheets, templates | My Journal | Teacher's Supplies |
| Videos, songs, digital images | Media | Teacher's Supplies |
| Natural materials (leaves, stones, water) | Teacher's Supplies | PBL Box |
| Food items for activities | Teacher's Supplies | PBL Box |
| Standardized assessment forms | My Journal | PBL Box |

**Procedure**:
1. For each resource, check if its category matches expected category based on the rules above
2. Use keyword matching to detect misclassification:
   - Media keywords in non-Media category: 视频, 歌曲, 音频, 图片集, 动画
   - Journal keywords in non-Journal category: 记录表, 模板, 工作单, 日记, 自评
   - Common supplies in PBL Box: 白纸, 彩笔, 胶水, 剪刀, 蜡笔

**Verdict** (per item):
- Category matches expected: PASS
- Likely miscategorized: WARNING (suggest correct category)

**Output**: Table of items with suspected miscategorizations.

## Step 3: Compile Report

Write `{workspace}/resource-check-report.md` with this structure:

```markdown
# Resource Check Report / 资源校验报告

> Generated: {date}
> Workspace: {workspace path}
> Resource plan: resource-plan.md
> Activities checked: {count}

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Activity Coverage | {PASS/FAIL} | {n}/{total} activities have resources |
| Quantity Specificity | {PASS/FAIL} | {n} items missing quantities |
| PBL Box Catalog | {PASS/FAIL/SKIPPED} | {n} items not in catalog |
| Duplicate Detection | {PASS/WARNING} | {n} potential duplicates found |
| Category Correctness | {PASS/WARNING} | {n} suspected miscategorizations |

**Overall**: {ALL CLEAR / HAS ISSUES}

All Clear requires: 0 FAIL items across all checks.

---

## Check 1: Activity Coverage / 活动资源覆盖

| Activity Code | Activity Name | Resource Count | Status |
|--------------|--------------|---------------|--------|
| PBL-C1-1 | {name} | {n} | {PASS/FAIL} |

{Fix suggestions for any FAIL items}

---

## Check 2: Quantity Specificity / 数量标注完整性

| Activity | Item | Current Quantity | Status | Suggested Fix |
|----------|------|-----------------|--------|--------------|
| PBL-C1-1 | {item} | {current or "missing"} | {PASS/FAIL} | {e.g., "Specify: 苹果 3个"} |

---

## Check 3: PBL Box Catalog / 项目盒目录匹配

{If catalog not available: "Skipped -- no catalog file found."}

| PBL Box Item | Catalog Match | Status | Suggestion |
|-------------|--------------|--------|-----------|
| {item} | {matched catalog item or "not found"} | {PASS/WARNING/FAIL} | {suggestion} |

---

## Check 4: Duplicate Detection / 重复资源检测

| Item A | Activity A | Item B | Activity B | Issue | Suggestion |
|--------|-----------|--------|-----------|-------|-----------|
| {name} | PBL-C1-1 | {name variant} | PBL-C2-1 | {category mismatch / near-name / qty inconsistency} | {reconciliation suggestion} |

---

## Check 5: Category Correctness / 分类正确性

| Activity | Item | Current Category | Expected Category | Status |
|----------|------|-----------------|------------------|--------|
| PBL-C1-1 | {item} | {current} | {expected} | {PASS/WARNING} |

---

## Action Items

{Numbered list of all issues, ordered by severity}

### Must Fix (FAIL)

1. {issue description + specific fix instruction}

### Recommended (WARNING)

1. {issue description + specific fix instruction}
```

## Step 4: Present and Save

1. Write the report to `{workspace}/resource-check-report.md`
2. Display the Summary table to the user
3. If there are FAIL items: "Found {n} resource issues that must be fixed. See resource-check-report.md for details."
4. If only warnings: "Resources pass with {n} warnings. See resource-check-report.md for recommended improvements."
5. If all clear: "All resource checks passed. Resource plan is ready for use."

## Out of Scope

- Does NOT modify the resource plan -- only reports issues with suggested fixes
- Does NOT design activities or extract resources -- that is resource-planner's responsibility
- Does NOT place procurement orders
- Does NOT check activity quality or standards -- that is standards-check's responsibility
