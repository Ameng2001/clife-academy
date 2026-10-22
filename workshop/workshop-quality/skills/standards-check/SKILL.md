---
name: standards-check
description: Check a PBL proposal against curriculum standards, age-appropriateness rules, 4C mapping accuracy, and activity design constraints. Use after proposal is drafted, when reviewing quality, or when someone says "check the proposal". Produces a quality report with pass/fail items.
allowed-tools: Read, Write, Glob, Grep, Agent
user-invocable: true
---

# Standards Check

Automatically check a PBL proposal or its component artifacts against 8 quality rules. Produces a structured report with pass/warning/fail items and fix suggestions. Does NOT auto-fix -- only reports.

## Inputs

Accept one of:
- A workspace path via `$ARGUMENTS` (e.g., `.workshop/projects/spring-flowers/`)
- If no path given, scan the current working directory for `proposal.md` or `activities/`

Required artifacts (at least one must exist):
- `proposal.md` -- full proposal document
- `activities/clue-1.md`, `activities/clue-2.md`, `activities/clue-3.md` -- individual activity files
- `inquiry-clues.md` -- inquiry clue progression
- `competency-mapping.md` -- 4C and standards mapping

## Outputs

Write `quality-report.md` in the same workspace directory.
Also update `status.json` in the same workspace when present.

## Workflow

1. **Locate artifacts** -- find and read all available files
2. **Run 8 checks** -- execute each rule check sequentially
3. **Optional expert verification** -- age-appropriateness cross-check
4. **Compile report** -- assemble results into structured output
5. **Present and save** -- show summary to user, write full report

After writing `quality-report.md`, update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} standards-check \
  --phase reviewing \
  --notes "quality-report.md generated"
```

## Step 1: Locate Artifacts

Use Glob to find all relevant files in the workspace:

```
{workspace}/proposal.md
{workspace}/activities/clue-*.md
{workspace}/inquiry-clues.md
{workspace}/competency-mapping.md
{workspace}/resource-plan.md
```

Read each file found. If no artifacts exist at all, stop and tell the user: "No proposal artifacts found in {workspace}. Please run activity design first."

Extract from the artifacts:
- **Age group**: Look for PreK-3 / PreK-4 / K indicators in proposal.md or activity headers
- **Activities list**: Parse each `clue-*.md` for activity blocks (identified by `PBL-C{x}-{y}` codes)
- **Standards references**: Collect all mentions of curriculum standard domains (healthy/language/social/science/art)
- **4C claims**: For each activity, find the claimed 4C skill (Critical thinking, Communication, Collaboration, Creativity)
- **Resource annotations**: Collect resource/material mentions per activity

## Step 2: Run 8 Checks

Execute each check and record the result as: rule name, status, details, fix suggestion.

### Check 1: Curriculum Standards Coverage / 课标覆盖度

**Rule**: The five developmental domains (五大领域) must have at least 3 covered across all activities.

The five domains are:
| Domain | Chinese | Keywords to scan for |
|--------|---------|---------------------|
| Health | 健康 | 身体、运动、体能、安全、卫生、自理、情绪 |
| Language | 语言 | 表达、倾听、阅读、讲述、文字、词汇、对话 |
| Social | 社会 | 合作、分享、交往、规则、礼貌、轮流、关爱 |
| Science | 科学 | 观察、探索、实验、数学、比较、分类、测量 |
| Art | 艺术 | 绘画、音乐、手工、表演、创作、欣赏、节奏 |

**Procedure**:
1. Scan `competency-mapping.md` for explicit domain references
2. If not available, scan all activity files for domain keywords
3. Count distinct domains found

**Verdict**:
- 5 domains covered: PASS
- 3-4 domains covered: PASS (note which are missing)
- 2 or fewer: FAIL

**Fix suggestion**: "Add activities targeting {missing domains}. Consider: {domain} can be woven into existing activities by {specific suggestion}."

### Check 2: Learning Objective Verb Appropriateness / 学习目标动词适切性

**Rule**: Learning objective verbs must match the age group's developmental level.

Age-verb matrix:
| Age Group | Appropriate Verbs | Inappropriate Verbs |
|-----------|------------------|-------------------|
| PreK-3 (小班) | 感受、尝试、愿意、喜欢、发现、模仿 | 理解、分析、比较、评价、设计 |
| PreK-4 (中班) | 认识、了解、能够、学会、知道、区分 | 分析、评价、设计、综合、创造 |
| K (大班) | 理解、比较、分析、合作完成、独立完成、创作 | (all verbs acceptable) |

**Procedure**:
1. Extract the age group from proposal metadata
2. Scan all learning objectives (lines starting with "目标" or containing verb + noun patterns)
3. Check each verb against the matrix

**Verdict**:
- All verbs appropriate: PASS
- 1-2 inappropriate verbs: WARNING
- 3+ inappropriate verbs: FAIL

**Fix suggestion**: "Replace '{verb}' with '{age-appropriate alternative}' for {age group}. Example: change '理解颜色的混合' to '尝试混合颜色' for PreK-3."

### Check 3: 4C Mapping Accuracy / 4C映射准确性

**Rule**: Each activity's claimed 4C skill must actually match the activity content.

4C content indicators:
| 4C Skill | Content indicators |
|----------|-------------------|
| Critical thinking (批判性思维) | 比较、分类、提问、假设、推理、判断、解决问题 |
| Communication (沟通) | 表达、讲述、展示、分享、讨论、汇报、倾听 |
| Collaboration (协作) | 小组、合作、分工、轮流、共同完成、团队 |
| Creativity (创造力) | 设计、创作、想象、发明、改编、自由探索、开放式 |

**Procedure**:
1. For each activity, read the claimed 4C skill from `competency-mapping.md` or activity header
2. Scan the activity steps for content indicators
3. Determine which 4C skill the content actually demonstrates
4. Compare claimed vs. actual

**Verdict** (per activity):
- Claimed matches actual: PASS
- Claimed partially matches (indicators for both claimed and another skill): WARNING
- Claimed does not match at all: FAIL

**Fix suggestion**: "Activity {code} claims '{claimed}' but content shows '{actual}'. Either revise the activity to emphasize {claimed} or change the mapping to {actual}."

### Check 4: Activity Duration Reasonableness / 活动时长合理性

**Rule**: Each activity should take 20-30 minutes for the target age group.

Duration estimation formula:
- Count the number of distinct steps in the activity (numbered items, phases, or sections)
- Multiply by average time per step: 6-8 minutes (use 7 as midpoint)
- Add 3 minutes for transition/setup if materials are involved

**Procedure**:
1. For each activity, count steps
2. Estimate: `duration = steps * 7 + (3 if has_materials)`
3. Compare to 20-30 minute range

**Verdict** (per activity):
- 20-30 min: PASS
- 15-19 or 31-35 min: WARNING ("slightly short/long")
- < 15 or > 35 min: FAIL

**Fix suggestion**: If too short: "Activity {code} estimated at {n} min. Consider adding {suggestion: a reflection/discussion step, a hands-on exploration phase}." If too long: "Activity {code} estimated at {n} min. Consider splitting into two sessions or removing step {least essential step}."

### Check 5: Inquiry Clue Progression / 探究线索递进性

**Rule**: The three inquiry clues must follow a concrete-investigate-integrate progression.

Expected progression:
| Clue | Level | Characteristics | Keywords |
|------|-------|----------------|----------|
| Clue 1 | Concrete / 具象 | Sensory experience, direct observation, hands-on encounter | 观察、触摸、感受、看一看、闻一闻、尝一尝 |
| Clue 2 | Investigate / 探究 | Comparison, experimentation, deeper inquiry | 比较、实验、为什么、怎么样、如果...会 |
| Clue 3 | Integrate / 整合 | Synthesis, creation, presentation, application | 创作、展示、设计、总结、应用、分享成果 |

**Procedure**:
1. Read `inquiry-clues.md` or parse the clue structure from activity files
2. For each clue, scan for level-appropriate keywords
3. Check that the sequence is strictly Concrete -> Investigate -> Integrate

**Verdict**:
- Correct progression: PASS
- Correct levels but weak differentiation: WARNING
- Wrong order or missing a level: FAIL

**Fix suggestion**: "Clue {n} is at '{detected level}' but should be '{expected level}'. Rewrite to emphasize {expected characteristics}."

### Check 6: Activity Code Continuity / 活动编码连续性

**Rule**: Activity codes follow `PBL-C{clue}-{sequence}` format with no gaps and correct clue numbers.

**Procedure**:
1. Extract all activity codes matching the pattern `PBL-C\d+-\d+`
2. Group by clue number (C1, C2, C3)
3. Within each clue, check sequence numbers are consecutive starting from 1
4. Verify clue numbers match their parent clue file (activities in clue-1.md should be PBL-C1-*)

**Verdict**:
- All codes sequential, no gaps: PASS
- Gaps found: FAIL
- Mismatched clue numbers: FAIL

**Fix suggestion**: "Found gap: {existing codes}. Missing code PBL-C{x}-{y}. Either add the missing activity or renumber."

### Check 7: Resource List Completeness / 资源清单完整性

**Rule**: Every activity must have at least 1 resource item listed.

**Procedure**:
1. For each activity (identified by code), search for resource/material sections
2. Look for: "材料" "资源" "准备" "Materials" "Resources" headers or inline annotations
3. Count resource items per activity

**Verdict** (per activity):
- 1+ resources: PASS
- 0 resources: FAIL

**Fix suggestion**: "Activity {code} has no resources listed. Add a materials section specifying what the teacher and children need."

### Check 8: Bilingual Consistency / 双语一致性

**Rule**: Key elements must have both Chinese and English content present.

Elements to check:
- Project title (中英文标题)
- Driving question (驱动问题)
- Activity names (活动名称)
- Learning objectives (学习目标)

**Procedure**:
1. For each element, scan for Chinese text (contains CJK characters)
2. For each element, scan for English text (contains Latin characters forming words)
3. Flag any element that is monolingual

**Verdict**:
- All key elements bilingual: PASS
- Some missing translations: WARNING (list which ones)
- Title or driving question monolingual: FAIL

**Fix suggestion**: "Missing English translation for: {element}. Add the translation to maintain bilingual consistency."

## Step 3: Optional Expert Verification

If any of Check 2 (verb appropriateness) or Check 3 (4C mapping) produced WARNING or FAIL results, use the Agent tool to invoke the child-development-psychologist for a second opinion.

**Agent lookup**:
1. Resolve `child-development-psychologist.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-quality/agents/`
3. If no agent file found, skip this step

**Agent prompt**:
```
You are reviewing a PBL proposal for age group {age_group}.

The automated check flagged these issues:
{list of WARNING/FAIL items from Check 2 and Check 3}

Here are the relevant activity excerpts:
{activity content}

Please verify:
1. Are the flagged verb concerns valid? Are there cases where the verb is acceptable for this age group in context?
2. Are the 4C mapping concerns valid? Does the activity content truly demonstrate the claimed skill?

Provide your professional assessment for each flagged item: AGREE with flag / DISAGREE (explain why).
```

Incorporate the expert's assessment into the report as an "Expert Note" column alongside the automated check results.

## Step 4: Compile Report

Write `quality-report.md` with this structure:

```markdown
# Quality Report / 质量检查报告

> Generated: {date}
> Workspace: {workspace path}
> Age Group: {detected age group}

## Summary

| Metric | Count |
|--------|-------|
| Total checks | {n} |
| Passed | {n} |
| Warnings | {n} |
| Failed | {n} |

**Overall verdict**: {READY FOR REVIEW / NEEDS FIXES}

A verdict of READY FOR REVIEW requires: 0 FAIL items and <= 2 WARNING items.

---

## Detailed Results

### 1. 课标覆盖度 — Curriculum Standards Coverage

**Status**: {PASS/WARNING/FAIL}

{Details: which domains covered, which missing}

{Fix suggestion if not PASS}

---

### 2. 学习目标动词适切性 — Learning Objective Verb Appropriateness

**Status**: {PASS/WARNING/FAIL}

| Objective | Verb | Age-appropriate? | Suggested replacement |
|-----------|------|-----------------|----------------------|
| {objective text} | {verb} | {yes/no} | {replacement or --} |

{Expert note if applicable}

---

### 3. 4C映射准确性 — 4C Mapping Accuracy

**Status**: {PASS/WARNING/FAIL}

| Activity | Claimed 4C | Detected 4C | Match? |
|----------|-----------|-------------|--------|
| {code} | {claimed} | {detected} | {yes/partial/no} |

{Expert note if applicable}

---

### 4. 活动时长合理性 — Activity Duration

**Status**: {PASS/WARNING/FAIL}

| Activity | Steps | Est. Duration | Range? |
|----------|-------|--------------|--------|
| {code} | {n} | {m} min | {ok/short/long} |

---

### 5. 探究线索递进性 — Inquiry Clue Progression

**Status**: {PASS/WARNING/FAIL}

| Clue | Expected Level | Detected Level | Match? |
|------|---------------|---------------|--------|
| 1 | Concrete | {detected} | {yes/no} |
| 2 | Investigate | {detected} | {yes/no} |
| 3 | Integrate | {detected} | {yes/no} |

---

### 6. 活动编码连续性 — Activity Code Continuity

**Status**: {PASS/WARNING/FAIL}

Found codes: {list}
Expected codes: {list}
Gaps: {list or "none"}

---

### 7. 资源清单完整性 — Resource List Completeness

**Status**: {PASS/WARNING/FAIL}

| Activity | Resource count | Status |
|----------|---------------|--------|
| {code} | {n} | {ok/missing} |

---

### 8. 双语一致性 — Bilingual Consistency

**Status**: {PASS/WARNING/FAIL}

| Element | Chinese | English | Status |
|---------|---------|---------|--------|
| Project title | {yes/no} | {yes/no} | {ok/missing} |
| Driving question | {yes/no} | {yes/no} | {ok/missing} |
| Activity names | {yes/no} | {yes/no} | {ok/missing} |

---

## Action Items

{Numbered list of all FAIL and WARNING items with their fix suggestions, ordered by severity (FAIL first)}
```

## Step 5: Present and Save

1. Write the report to `{workspace}/quality-report.md`
2. Display the Summary section to the user
3. If there are FAIL items, say: "Found {n} issues that must be fixed before review. See quality-report.md for details."
4. If only warnings, say: "Proposal passes with {n} warnings. See quality-report.md for details and optional improvements."
5. If all pass, say: "All 8 checks passed. Proposal is ready for expert review (/workshop-quality:proposal-review)."

## Out of Scope

- Does NOT auto-fix any issues -- only reports them with suggestions
- Does NOT perform expert peer review -- that is proposal-review's responsibility
- Does NOT validate resource procurement feasibility -- that is resource-check's responsibility
