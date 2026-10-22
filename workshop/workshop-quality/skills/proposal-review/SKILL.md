---
name: proposal-review
description: Perform a comprehensive peer review of a PBL proposal from multiple expert perspectives — curriculum alignment, developmental appropriateness, and classroom feasibility. Use before submitting to the principal for approval, or when someone says "review the proposal". Produces expert review comments.
allowed-tools: Read, Write, Glob, Agent
user-invocable: true
---

# Proposal Review

Run a multi-expert peer review of a PBL proposal. Three domain expert agents review the proposal in parallel, each from their unique perspective. Produces consolidated feedback with specific recommendations and an overall quality score.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Required experts**: The following 3 experts must be resolved using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-quality/agents/`
   - `early-childhood-curriculum-expert.md`
   - `child-development-psychologist.md`
   - `instructional-designer.md`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-quality/agents/*.md`
5. **Skip template**: Do not load `_domain-expert-template.md`

If any of the 3 required experts cannot be found, warn the user and proceed with the available experts only.

## Inputs

Accept one of:
- A workspace path via `$ARGUMENTS` (e.g., `.workshop/projects/spring-flowers/`)
- If no path given, scan the current working directory for `proposal.md` or `activities/`

Required artifacts (at least one must exist):
- `proposal.md` -- full proposal document
- `activities/clue-1.md`, `activities/clue-2.md`, `activities/clue-3.md`
- `inquiry-clues.md`
- `competency-mapping.md`

Optional supporting artifacts:
- `quality-report.md` -- if standards-check has already run, include its findings for experts to reference
- `resource-plan.md` -- resource details for feasibility review

## Outputs

Write `review-comments.md` in the same workspace directory.
Also update `status.json` in the same workspace when present.

## Workflow

1. **Gather all artifacts** -- read every relevant file in the workspace
2. **Prepare review brief** -- assemble a context package for experts
3. **Invoke 3 experts in parallel** -- each reviews from their perspective
4. **Consolidate feedback** -- merge expert opinions, resolve conflicts
5. **Score and recommend** -- produce overall score and top 5 recommendations
6. **Write output** -- save review-comments.md

After writing `review-comments.md`, update workspace status with:

```bash
python3 workshop-core/scripts/workspace_status.py record-project-artifact \
  {workspace} proposal-review \
  --phase reviewing \
  --notes "review-comments.md generated"
```

## Step 1: Gather All Artifacts

Use Glob to find all markdown files in the workspace:

```
{workspace}/*.md
{workspace}/activities/*.md
{workspace}/personas/*.md
{workspace}/journeys/*.md
```

Read each file. Build a mental model of the complete proposal:
- What is the project theme and driving question?
- What age group is targeted?
- How many activities across how many clues?
- What standards and 4C skills are claimed?

## Step 2: Prepare Review Brief

Compose a review brief that will be sent to each expert. The brief contains:

```
## Proposal Under Review

**Project**: {title}
**Age Group**: {age group}
**Driving Question**: {driving question}
**Duration**: {number of activities} activities across {number of clues} inquiry clues

### Proposal Content

{Full text of proposal.md or assembled content from individual artifacts}

### Competency Mapping

{Content of competency-mapping.md if available}

### Inquiry Clue Structure

{Content of inquiry-clues.md or summary of clue-1/2/3}

### Prior Quality Check Results

{Content of quality-report.md if available, or "No prior quality check."}
```

## Step 3: Invoke 3 Experts in Parallel

Use the Agent tool to invoke all 3 experts. Each agent call runs independently and can execute in parallel.

### Expert 1: Early Childhood Curriculum Expert

**Agent file**: Load `early-childhood-curriculum-expert.md`

**Prompt**:
```
You are reviewing a PBL proposal as an early childhood curriculum expert.

{review brief}

Review this proposal and provide structured feedback on:

1. **PBL Methodology Quality** (评分 1-5):
   - Is the driving question authentic and age-appropriate?
   - Does the project follow genuine PBL principles (student-driven inquiry, real-world connection)?
   - Is the inquiry progression (concrete -> investigate -> integrate) well-structured?

2. **Curriculum Standards Alignment** (评分 1-5):
   - Are the claimed standards domains (五大领域) genuinely addressed?
   - Are the learning objectives clear, measurable, and developmentally appropriate?
   - Is the balance across domains reasonable for this project scope?

3. **Driving Question Quality** (评分 1-5):
   - Is it open-ended enough to sustain multi-week inquiry?
   - Is it meaningful to children of this age?
   - Does it connect to real-world experience?

For each section, provide:
- Score (1-5)
- Specific strengths (cite activity codes or sections)
- Specific concerns (cite activity codes or sections)
- Concrete fix suggestions

Format your response with clear headers and bullet points.
```

### Expert 2: Child Development Psychologist

**Agent file**: Load `child-development-psychologist.md`

**Prompt**:
```
You are reviewing a PBL proposal as a child development psychologist.

{review brief}

Review this proposal and provide structured feedback on:

1. **Age Appropriateness** (评分 1-5):
   - Are the activities within the Zone of Proximal Development for {age group}?
   - Are the cognitive demands realistic (attention span, abstract thinking level)?
   - Are fine/gross motor requirements appropriate?

2. **4C Skill Mapping Accuracy** (评分 1-5):
   - For each activity claiming a 4C skill, does the activity design genuinely develop that skill?
   - Are the 4C skills distributed across activities (not all the same)?
   - Are the ways children demonstrate these skills observable and age-appropriate?

3. **Social-Emotional Considerations** (评分 1-5):
   - Are group sizes and interaction patterns appropriate for the age?
   - Are there activities that might cause frustration or anxiety?
   - Is there scaffolding for children who struggle?

For each section, provide:
- Score (1-5)
- Specific strengths (cite activity codes or sections)
- Specific concerns (cite activity codes or sections, flag developmental red flags)
- Concrete fix suggestions

Format your response with clear headers and bullet points.
```

### Expert 3: Instructional Designer

**Agent file**: Load `instructional-designer.md`

**Prompt**:
```
You are reviewing a PBL proposal as an instructional designer focused on classroom feasibility.

{review brief}

Review this proposal and provide structured feedback on:

1. **Classroom Feasibility** (评分 1-5):
   - Can the activities realistically be completed in 20-30 minutes?
   - Are the material/resource requirements practical?
   - Is the teacher preparation burden reasonable?

2. **Instruction Clarity** (评分 1-5):
   - Are the activity steps clear enough for a teacher to follow without guessing?
   - Are transition points between steps explicit?
   - Are differentiation strategies provided for advanced/struggling learners?

3. **Resource Completeness** (评分 1-5):
   - Is every activity's material list complete and specific?
   - Are digital/media resources properly described (title, duration, source)?
   - Is the PBL Box vs. teacher-prepared distinction clear?

For each section, provide:
- Score (1-5)
- Specific strengths (cite activity codes or sections)
- Specific concerns (cite activity codes or sections)
- Concrete fix suggestions

Format your response with clear headers and bullet points.
```

## Step 4: Consolidate Feedback

After all 3 experts return their reviews:

1. **Identify consensus issues**: Problems flagged by 2+ experts get highest priority
2. **Identify unique insights**: Issues only one expert caught (domain-specific concerns)
3. **Resolve conflicts**: If experts disagree (e.g., one says age-appropriate, another disagrees), note both perspectives and lean toward the more conservative assessment
4. **Calculate scores**: Average each expert's sub-scores for an overall score

Score calculation:
- Each expert provides 3 sub-scores (1-5)
- Overall score = average of all 9 sub-scores, rounded to nearest 0.5
- Scale: 1=unacceptable, 2=major issues, 3=needs revision, 4=good with minor fixes, 5=excellent

## Step 5: Score and Recommend

Produce a top 5 recommendations list, prioritized by:
1. Issues flagged by multiple experts (consensus)
2. FAIL-level severity items
3. Items affecting child safety or developmental appropriateness
4. Items affecting feasibility
5. Items affecting quality/polish

Each recommendation must be:
- Specific (cite activity code or section)
- Actionable (say exactly what to change)
- Justified (explain why, referencing expert reasoning)

## Step 6: Write Output

Write `{workspace}/review-comments.md` with this structure:

```markdown
# Expert Review Comments / 专家评审意见

> Generated: {date}
> Workspace: {workspace path}
> Reviewers: 3 domain experts

## Overall Score: {score}/5 -- {verdict}

| Verdict | Score range |
|---------|------------|
| Excellent -- ready for approval | 4.5-5.0 |
| Good -- minor revisions recommended | 3.5-4.4 |
| Needs revision -- address key issues | 2.5-3.4 |
| Major issues -- significant rework needed | 1.0-2.4 |

---

## Top 5 Recommendations

1. **{Title}** ({severity: critical/important/suggested})
   {Description with specific activity/section references}
   *Flagged by: {expert name(s)}*

2. ...

3. ...

4. ...

5. ...

---

## Expert 1: Early Childhood Curriculum Expert / 幼教课程专家

### PBL Methodology Quality: {score}/5

{Strengths, concerns, suggestions}

### Curriculum Standards Alignment: {score}/5

{Strengths, concerns, suggestions}

### Driving Question Quality: {score}/5

{Strengths, concerns, suggestions}

---

## Expert 2: Child Development Psychologist / 儿童发展心理学家

### Age Appropriateness: {score}/5

{Strengths, concerns, suggestions}

### 4C Skill Mapping Accuracy: {score}/5

{Strengths, concerns, suggestions}

### Social-Emotional Considerations: {score}/5

{Strengths, concerns, suggestions}

---

## Expert 3: Instructional Designer / 教学设计师

### Classroom Feasibility: {score}/5

{Strengths, concerns, suggestions}

### Instruction Clarity: {score}/5

{Strengths, concerns, suggestions}

### Resource Completeness: {score}/5

{Strengths, concerns, suggestions}

---

## Score Summary

| Dimension | Expert | Score |
|-----------|--------|-------|
| PBL Methodology | Curriculum Expert | {n}/5 |
| Standards Alignment | Curriculum Expert | {n}/5 |
| Driving Question | Curriculum Expert | {n}/5 |
| Age Appropriateness | Psychologist | {n}/5 |
| 4C Mapping | Psychologist | {n}/5 |
| Social-Emotional | Psychologist | {n}/5 |
| Feasibility | Instructional Designer | {n}/5 |
| Instruction Clarity | Instructional Designer | {n}/5 |
| Resource Completeness | Instructional Designer | {n}/5 |
| **Overall** | **Average** | **{n}/5** |

---

## Consensus Issues

{Issues flagged by 2+ experts, listed with all perspectives}

## Conflicting Opinions

{Issues where experts disagreed, with both sides presented}
```

After writing the file:
- Display the Overall Score and Top 5 Recommendations to the user
- If score >= 4.5: "Proposal is ready for principal approval."
- If score 3.5-4.4: "Proposal is good. Address the top recommendations and it's ready."
- If score 2.5-3.4: "Proposal needs revision. Focus on the critical and important recommendations."
- If score < 2.5: "Proposal needs significant rework. Start with the top 5 critical issues."

## Out of Scope

- Does NOT auto-fix issues -- only provides expert opinions and suggestions
- Does NOT run rule-based checks -- that is standards-check's responsibility
- Does NOT validate resources -- that is resource-check's responsibility
